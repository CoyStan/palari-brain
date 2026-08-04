import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
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
  scoreEttinHiddenStates,
} from '../src/reranker-ettin.mjs'

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
})

test('adapter is lazy, pair-batched, base-model only, and loads once', async () => {
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
    cacheDir: '/private/cache',
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
  assert.equal(calls.factories[0][1], ETTIN_RERANKER_MODEL.id)
  assert.equal(calls.factories[1][1], ETTIN_RERANKER_MODEL.id)
  assert.equal(calls.factories[0][2].dtype, undefined)
  assert.equal(calls.factories[1][2].dtype, 'fp32')
  assert.deepEqual(calls.tokenizer[0], [
    ['which?', 'which?'],
    { padding: true, text_pair: ['first', 'second'], truncation: true },
  ])
})

test('adapter and artifact cache reject bounds, bad shape, and corrupt bytes', async () => {
  assert.throws(() => createEttinReranker({ cacheDir: 'relative' }), /absolute/)
  const rerank = createEttinReranker({
    cacheDir: '/private/cache',
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
})
