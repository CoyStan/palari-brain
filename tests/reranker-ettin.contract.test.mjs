import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'

import {
  ETTIN_HEAD_ARTIFACTS,
  ETTIN_RERANKER_MODEL,
  createEttinReranker,
  ettinGelu,
  loadEttinArtifact,
  parseEttinSafetensors,
  resolveEttinModelDirectory,
  scoreEttinHiddenStates,
} from '../src/reranker-ettin.mjs'

async function modelCacheFixture(prefix = 'ettin-model-cache-') {
  const cacheDir = await mkdtemp(join(tmpdir(), prefix))
  const modelDir = join(
    cacheDir,
    ...ETTIN_RERANKER_MODEL.id.split('/'),
    ETTIN_RERANKER_MODEL.revision,
  )
  await mkdir(modelDir, { mode: 0o700, recursive: true })
  return { cacheDir, modelDir }
}

function syntheticSafetensors(tensors) {
  let offset = 0
  const header = {}
  const values = []
  for (const [name, { shape, data }] of Object.entries(tensors)) {
    const bytes = data.length * 4
    header[name] = {
      data_offsets: [offset, offset + bytes],
      dtype: 'F32',
      shape,
    }
    values.push(...data)
    offset += bytes
  }
  let headerBytes = Buffer.from(JSON.stringify(header))
  while ((8 + headerBytes.length) % 8 !== 0) {
    headerBytes = Buffer.concat([headerBytes, Buffer.from(' ')])
  }
  const result = Buffer.alloc(8 + headerBytes.length + offset)
  result.writeBigUInt64LE(BigInt(headerBytes.length), 0)
  headerBytes.copy(result, 8)
  values.forEach((value, index) => result.writeFloatLE(value, 8 + headerBytes.length + index * 4))
  return new Uint8Array(result)
}

function artifactFor(path, tensors, bytes) {
  return {
    bytes: bytes.length,
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    tensors,
  }
}

function customSafetensors(header, dataBytes, trailingBytes = 0) {
  let headerBytes = Buffer.from(JSON.stringify(header))
  while ((8 + headerBytes.length) % 8 !== 0) {
    headerBytes = Buffer.concat([headerBytes, Buffer.from(' ')])
  }
  const result = Buffer.alloc(8 + headerBytes.length + dataBytes + trailingBytes)
  result.writeBigUInt64LE(BigInt(headerBytes.length), 0)
  headerBytes.copy(result, 8)
  return new Uint8Array(result)
}

function identityHead() {
  const dense = new Float32Array(256 * 256)
  for (let index = 0; index < 256; index += 1) dense[index * 256 + index] = 1
  const normWeight = new Float32Array(256).fill(1)
  const normBias = new Float32Array(256)
  const finalWeight = new Float32Array(256)
  finalWeight[0] = 1
  return {
    dense: { 'linear.weight': dense },
    norm: { 'norm.bias': normBias, 'norm.weight': normWeight },
    final: {
      'linear.bias': new Float32Array([0.25]),
      'linear.weight': finalWeight,
    },
  }
}

test('model and three external head artifacts are exact and licensed', () => {
  assert.deepEqual(ETTIN_RERANKER_MODEL, {
    dtype: 'fp32',
    hiddenSize: 256,
    id: 'cross-encoder/ettin-reranker-17m-v1',
    language: 'en',
    layerNormEpsilon: 1e-5,
    license: 'Apache-2.0',
    pooling: 'cls',
    revision: '9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6',
  })
  assert.deepEqual(
    ETTIN_HEAD_ARTIFACTS.map(({ bytes, path, sha256 }) => ({ bytes, path, sha256 })),
    [
      {
        bytes: 262232,
        path: '2_Dense/model.safetensors',
        sha256: '85e9596d9250a871deb159fb5db6979e910b4cf181d05c806733c49bc43d47c8',
      },
      {
        bytes: 2200,
        path: '3_LayerNorm/model.safetensors',
        sha256: 'de99fa351fb4badb74b56e85fa70b5bbd3fcf4d0e74de79eb749dba1e9e28b4a',
      },
      {
        bytes: 1172,
        path: '4_Dense/model.safetensors',
        sha256: '654827171b89c76d19d663162243f38d63d1ba812ac1ec9c1b36512f1a8e9ce8',
      },
    ],
  )
  for (const artifact of ETTIN_HEAD_ARTIFACTS) {
    assert.match(artifact.url, new RegExp(ETTIN_RERANKER_MODEL.revision))
  }
})

test('strict safetensors reader accepts exact F32 layout and rejects drift', () => {
  const bytes = syntheticSafetensors({
    weight: { shape: [2], data: [1.5, -2] },
  })
  const artifact = artifactFor('fixture', { weight: [2] }, bytes)
  assert.deepEqual([...parseEttinSafetensors(bytes, artifact).weight], [1.5, -2])

  const corrupted = bytes.slice()
  corrupted.at(-1)
  corrupted[corrupted.length - 1] ^= 1
  assert.throws(
    () => parseEttinSafetensors(corrupted, artifact),
    /integrity mismatch/,
  )
  assert.throws(
    () => parseEttinSafetensors(bytes, { ...artifact, tensors: { other: [2] } }),
    /Unexpected tensors/,
  )

  const nonfinite = syntheticSafetensors({
    weight: { shape: [1], data: [NaN] },
  })
  assert.throws(
    () => parseEttinSafetensors(
      nonfinite,
      artifactFor('nonfinite', { weight: [1] }, nonfinite),
    ),
    /Nonfinite tensor value/,
  )

  const invalidDescriptors = [
    {
      bytes: customSafetensors({
        weight: { data_offsets: [0, 8], dtype: 'F64', shape: [2] },
      }, 8),
      expected: /Invalid tensor descriptor/,
      tensors: { weight: [2] },
    },
    {
      bytes: customSafetensors({
        weight: { data_offsets: [0, 8], dtype: 'F32', shape: [1] },
      }, 8),
      expected: /Invalid tensor descriptor/,
      tensors: { weight: [2] },
    },
    {
      bytes: customSafetensors({
        weight: { data_offsets: [1, 9], dtype: 'F32', shape: [2] },
      }, 8),
      expected: /Invalid tensor offsets/,
      tensors: { weight: [2] },
    },
    {
      bytes: customSafetensors({
        first: { data_offsets: [0, 4], dtype: 'F32', shape: [1] },
        second: { data_offsets: [0, 4], dtype: 'F32', shape: [1] },
      }, 8),
      expected: /Non-contiguous tensor data/,
      tensors: { first: [1], second: [1] },
    },
    {
      bytes: customSafetensors({
        weight: { data_offsets: [0, 4], dtype: 'F32', shape: [1] },
      }, 4, 4),
      expected: /trailing tensor ambiguity/,
      tensors: { weight: [1] },
    },
  ]
  for (const fixture of invalidDescriptors) {
    assert.throws(
      () => parseEttinSafetensors(
        fixture.bytes,
        artifactFor('invalid', fixture.tensors, fixture.bytes),
      ),
      fixture.expected,
    )
  }
})

test('native head uses CLS, exact orientation, GELU, LayerNorm, and final bias', () => {
  assert.ok(Math.abs(ettinGelu(1) - 0.8413447461) < 2e-7)
  assert.ok(Math.abs(ettinGelu(-1) - -0.1586552539) < 2e-7)

  const data = new Float32Array(2 * 256)
  data[0] = 1
  data[1] = -1
  data.fill(100, 256)
  const first = scoreEttinHiddenStates(
    { data, dims: [1, 2, 256] },
    identityHead(),
    1,
  )[0]
  data.fill(-100, 256)
  const second = scoreEttinHiddenStates(
    { data, dims: [1, 2, 256] },
    identityHead(),
    1,
  )[0]
  assert.equal(first, second, 'non-CLS tokens must not affect the score')

  const positive = 0.8413447461
  const negative = -0.1586552539
  const mean = (positive + negative) / 256
  const variance = ((positive - mean) ** 2 + (negative - mean) ** 2 +
    254 * mean ** 2) / 256
  const expected = (positive - mean) / Math.sqrt(variance + 1e-5) + 0.25
  assert.ok(Math.abs(first - expected) < 2e-6)

  const oriented = identityHead()
  oriented.dense['linear.weight'].fill(0)
  oriented.dense['linear.weight'][1] = 2
  oriented.norm['norm.weight'][0] = 1.5
  oriented.norm['norm.bias'][0] = -0.4
  oriented.final['linear.weight'][0] = 2
  const orientedData = new Float32Array(256)
  orientedData[0] = 3
  orientedData[1] = 1
  const orientedScore = scoreEttinHiddenStates(
    { data: orientedData, dims: [1, 1, 256] },
    oriented,
    1,
  )[0]
  const activatedFirst = ettinGelu(2)
  const orientedMean = activatedFirst / 256
  const orientedVariance = ((activatedFirst - orientedMean) ** 2 +
    255 * orientedMean ** 2) / 256
  const orientedExpected = (((activatedFirst - orientedMean) /
    Math.sqrt(orientedVariance + 1e-5)) * 1.5 - 0.4) * 2 + 0.25
  assert.ok(Math.abs(orientedScore - orientedExpected) < 2e-6)
  assert.equal(
    scoreEttinHiddenStates(
      { data: orientedData, dims: [1, 1, 256] }, oriented, 1,
    )[0],
    orientedScore,
    'native scoring must be deterministic',
  )
})

test('adapter is lazy, pair-batched, base-model only, and loads once', async () => {
  const { cacheDir, modelDir } = await modelCacheFixture()
  const calls = { factories: [], tokenizer: [] }
  const head = identityHead()
  let headLoads = 0
  let runtimeLoads = 0
  const tokenizer = async (...args) => {
    calls.tokenizer.push(args)
    return { input_ids: 'encoded' }
  }
  const transformer = async () => {
    const data = new Float32Array(2 * 2 * 256)
    data[0] = 1
    data[2 * 256] = -1
    return { last_hidden_state: { data, dims: [2, 2, 256] } }
  }
  const rerank = createEttinReranker({
    cacheDir,
    loadHead: async () => {
      headLoads += 1
      return head
    },
    loadRuntime: async () => {
      runtimeLoads += 1
      return {
        AutoModel: {
          async from_pretrained(...args) {
            calls.factories.push(['model', ...args])
            return transformer
          },
        },
        AutoTokenizer: {
          async from_pretrained(...args) {
            calls.factories.push(['tokenizer', ...args])
            return tokenizer
          },
        },
      }
    },
  })
  assert.equal(runtimeLoads, 0)
  const scores = await rerank('which?', ['first', 'second'])
  assert.equal(scores.length, 2)
  assert.ok(scores[0] > scores[1])
  await rerank('which?', ['first', 'second'])
  assert.equal(runtimeLoads, 1)
  assert.equal(headLoads, 1)
  assert.equal(calls.factories.length, 2)
  assert.equal(calls.factories[0][1], modelDir)
  assert.equal(calls.factories[1][1], modelDir)
  assert.deepEqual(calls.factories[0][2], { local_files_only: true })
  assert.equal(calls.factories[0][2].dtype, undefined)
  assert.equal(calls.factories[1][2].dtype, 'fp32')
  assert.equal(calls.factories[1][2].local_files_only, true)
  assert.equal(calls.factories[1][2].cache_dir, undefined)
  assert.equal(calls.factories[1][2].revision, undefined)
  assert.deepEqual(calls.tokenizer[0], [
    ['which?', 'which?'],
    { padding: true, text_pair: ['first', 'second'], truncation: true },
  ])
})

test('adapter and artifact cache reject bounds, bad shape, and corrupt bytes', async () => {
  assert.throws(() => createEttinReranker({ cacheDir: 'relative' }), /absolute/)
  const { cacheDir: modelCacheDir } = await modelCacheFixture()
  const rerank = createEttinReranker({
    cacheDir: modelCacheDir,
    loadHead: async () => identityHead(),
    loadRuntime: async () => ({
      AutoModel: { async from_pretrained() {
        return async () => ({
          last_hidden_state: { data: new Float32Array(1), dims: [1, 1, 1] },
        })
      } },
      AutoTokenizer: { async from_pretrained() { return async () => ({}) } },
    }),
  })
  await assert.rejects(() => rerank('', ['a']), /non-empty/)
  await assert.rejects(() => rerank('q'.repeat(501), ['a']), /at most 500/)
  await assert.rejects(() => rerank('q', Array(51).fill('a')), /at most 50/)
  await assert.rejects(() => rerank('q', ['a']), /invalid last_hidden_state/)

  const cacheDir = await mkdtemp(join(tmpdir(), 'ettin-artifact-'))
  let fetches = 0
  await assert.rejects(
    () => loadEttinArtifact(ETTIN_HEAD_ARTIFACTS[2], {
      cacheDir,
      fetchImpl: async () => {
        fetches += 1
        return { ok: true, async arrayBuffer() { return new Uint8Array([1]).buffer } }
      },
    }),
    /integrity mismatch/,
  )
  assert.equal(fetches, 1)
  const target = join(cacheDir, 'ettin-head', ETTIN_HEAD_ARTIFACTS[2].path)
  await assert.rejects(() => readFile(target), /ENOENT/)

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, Buffer.alloc(ETTIN_HEAD_ARTIFACTS[2].bytes), {
    flag: 'wx', mode: 0o600,
  })
  await assert.rejects(
    () => loadEttinArtifact(ETTIN_HEAD_ARTIFACTS[2], { cacheDir }),
    /integrity mismatch/,
  )
  assert.equal(fetches, 1, 'corrupt cached bytes must not be silently replaced')

  const escapedCache = await mkdtemp(join(tmpdir(), 'ettin-symlink-cache-'))
  const escapedTarget = await mkdtemp(join(tmpdir(), 'ettin-symlink-target-'))
  await mkdir(join(escapedCache, 'ettin-head'), { mode: 0o700 })
  await symlink(escapedTarget, join(escapedCache, 'ettin-head', '4_Dense'))
  await assert.rejects(
    () => loadEttinArtifact(ETTIN_HEAD_ARTIFACTS[2], {
      cacheDir: escapedCache,
      fetchImpl: async () => {
        throw new Error('symlink rejection must precede fetch')
      },
    }),
    /symlink/,
  )
  await assert.rejects(
    () => loadEttinArtifact({ ...ETTIN_HEAD_ARTIFACTS[2] }, { cacheDir }),
    /Only frozen Ettin head artifacts/,
  )
})

test('cached-only model directory is contained and validated before loading', async () => {
  const { cacheDir, modelDir } = await modelCacheFixture()
  assert.equal(await resolveEttinModelDirectory(cacheDir), modelDir)

  const explicit = join(cacheDir, 'materialized', 'ettin')
  await mkdir(explicit, { mode: 0o700, recursive: true })
  assert.equal(await resolveEttinModelDirectory(cacheDir, explicit), explicit)
  await assert.rejects(
    () => resolveEttinModelDirectory(cacheDir, cacheDir),
    /strictly inside/,
  )
  assert.throws(
    () => createEttinReranker({ cacheDir, modelDir: 'relative' }),
    /normalized absolute/,
  )
  assert.throws(
    () => createEttinReranker({
      cacheDir,
      modelDir: `${cacheDir}/materialized/../ettin`,
    }),
    /normalized absolute/,
  )

  let headLoads = 0
  let runtimeLoads = 0
  const missing = createEttinReranker({
    cacheDir,
    modelDir: join(cacheDir, 'missing'),
    loadHead: async () => { headLoads += 1 },
    loadRuntime: async () => { runtimeLoads += 1 },
  })
  await assert.rejects(() => missing.warm(), /existing directory/)
  await assert.rejects(() => missing.warm(), /existing directory/)
  assert.equal(headLoads, 0)
  assert.equal(runtimeLoads, 0)

  const fileComponent = join(cacheDir, 'not-a-directory')
  await writeFile(fileComponent, 'not a model directory', { mode: 0o600 })
  const nonDirectory = createEttinReranker({
    cacheDir,
    modelDir: fileComponent,
    loadHead: async () => { headLoads += 1 },
    loadRuntime: async () => { runtimeLoads += 1 },
  })
  await assert.rejects(() => nonDirectory.warm(), /existing directory/)
  assert.equal(headLoads, 0)
  assert.equal(runtimeLoads, 0)

  const outside = await mkdtemp(join(tmpdir(), 'ettin-model-outside-'))
  const escaped = createEttinReranker({
    cacheDir,
    modelDir: outside,
    loadHead: async () => { headLoads += 1 },
    loadRuntime: async () => { runtimeLoads += 1 },
  })
  await assert.rejects(() => escaped.warm(), /strictly inside/)
  assert.equal(headLoads, 0)
  assert.equal(runtimeLoads, 0)

  const symlinkCache = await mkdtemp(join(tmpdir(), 'ettin-model-symlink-'))
  const symlinkTarget = await mkdtemp(join(tmpdir(), 'ettin-model-target-'))
  await symlink(symlinkTarget, join(symlinkCache, 'cross-encoder'))
  const symlinked = createEttinReranker({
    cacheDir: symlinkCache,
    loadHead: async () => { headLoads += 1 },
    loadRuntime: async () => { runtimeLoads += 1 },
  })
  await assert.rejects(() => symlinked.warm(), /symlink/)
  assert.equal(headLoads, 0)
  assert.equal(runtimeLoads, 0)
})
