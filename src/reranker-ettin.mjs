import { createHash } from 'node:crypto'
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import { TRANSFORMERS_RERANKER_LIMITS } from './reranker-transformers.mjs'

export const ETTIN_RERANKER_MODEL = Object.freeze({
  dtype: 'fp32',
  hiddenSize: 256,
  id: 'cross-encoder/ettin-reranker-17m-v1',
  language: 'en',
  layerNormEpsilon: 1e-5,
  license: 'Apache-2.0',
  pooling: 'cls',
  revision: '9e4aa35321a6dd1a43ca313f500c4b4f7cfb5cc6',
})

const artifactBase =
  `https://huggingface.co/${ETTIN_RERANKER_MODEL.id}/resolve/` +
  `${ETTIN_RERANKER_MODEL.revision}/`

export const ETTIN_HEAD_ARTIFACTS = Object.freeze([
  Object.freeze({
    bytes: 262_232,
    path: '2_Dense/model.safetensors',
    sha256: '85e9596d9250a871deb159fb5db6979e910b4cf181d05c806733c49bc43d47c8',
    tensors: Object.freeze({
      'linear.weight': Object.freeze([256, 256]),
    }),
    url: `${artifactBase}2_Dense/model.safetensors`,
  }),
  Object.freeze({
    bytes: 2_200,
    path: '3_LayerNorm/model.safetensors',
    sha256: 'de99fa351fb4badb74b56e85fa70b5bbd3fcf4d0e74de79eb749dba1e9e28b4a',
    tensors: Object.freeze({
      'norm.bias': Object.freeze([256]),
      'norm.weight': Object.freeze([256]),
    }),
    url: `${artifactBase}3_LayerNorm/model.safetensors`,
  }),
  Object.freeze({
    bytes: 1_172,
    path: '4_Dense/model.safetensors',
    sha256: '654827171b89c76d19d663162243f38d63d1ba812ac1ec9c1b36512f1a8e9ce8',
    tensors: Object.freeze({
      'linear.bias': Object.freeze([1]),
      'linear.weight': Object.freeze([1, 256]),
    }),
    url: `${artifactBase}4_Dense/model.safetensors`,
  }),
])

function bytesView(value, label = 'artifact') {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  throw new TypeError(`${label} must be an ArrayBuffer or Uint8Array.`)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sameShape(left, right) {
  return Array.isArray(left) && left.length === right.length &&
    left.every((value, index) => value === right[index])
}

export function parseEttinSafetensors(value, artifact) {
  const bytes = bytesView(value)
  if (!artifact || typeof artifact !== 'object' || !artifact.tensors) {
    throw new TypeError('A frozen Ettin artifact specification is required.')
  }
  if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) {
    throw new Error(`Ettin artifact integrity mismatch: ${artifact.path}`)
  }
  if (bytes.length < 10) throw new TypeError('Safetensors file is truncated.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerLengthBig = view.getBigUint64(0, true)
  if (headerLengthBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new TypeError('Safetensors header length is unsafe.')
  }
  const headerLength = Number(headerLengthBig)
  const dataStart = 8 + headerLength
  if (headerLength < 2 || dataStart > bytes.length) {
    throw new TypeError('Safetensors header length is invalid.')
  }
  let header
  try {
    const text = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes.subarray(8, dataStart)).trimEnd()
    header = JSON.parse(text)
  } catch (error) {
    throw new TypeError('Safetensors header is not valid UTF-8 JSON.', {
      cause: error,
    })
  }
  if (!header || typeof header !== 'object' || Array.isArray(header)) {
    throw new TypeError('Safetensors header must be an object.')
  }
  const expectedNames = Object.keys(artifact.tensors).sort()
  const actualNames = Object.keys(header).filter((name) => name !== '__metadata__')
    .sort()
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new TypeError(`Unexpected tensors in ${artifact.path}.`)
  }
  const ranges = []
  const result = {}
  for (const name of expectedNames) {
    const descriptor = header[name]
    const shape = artifact.tensors[name]
    if (!descriptor || descriptor.dtype !== 'F32' ||
      !sameShape(descriptor.shape, shape) ||
      !Array.isArray(descriptor.data_offsets) ||
      descriptor.data_offsets.length !== 2) {
      throw new TypeError(`Invalid tensor descriptor: ${name}.`)
    }
    const [start, end] = descriptor.data_offsets
    const elements = shape.reduce((product, size) => product * size, 1)
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || end < start || end - start !== elements * 4 ||
      dataStart + end > bytes.length) {
      throw new TypeError(`Invalid tensor offsets: ${name}.`)
    }
    ranges.push([start, end, name])
    const tensorView = new DataView(
      bytes.buffer,
      bytes.byteOffset + dataStart + start,
      end - start,
    )
    const values = new Float32Array(elements)
    for (let index = 0; index < elements; index += 1) {
      const number = tensorView.getFloat32(index * 4, true)
      if (!Number.isFinite(number)) {
        throw new TypeError(`Nonfinite tensor value: ${name}.`)
      }
      values[index] = number
    }
    result[name] = values
  }
  ranges.sort((left, right) => left[0] - right[0])
  let cursor = 0
  for (const [start, end, name] of ranges) {
    if (start !== cursor) {
      throw new TypeError(`Non-contiguous tensor data before ${name}.`)
    }
    cursor = end
  }
  if (dataStart + cursor !== bytes.length) {
    throw new TypeError('Safetensors file has trailing tensor ambiguity.')
  }
  return Object.freeze(result)
}

async function existingPathIsSafe(path) {
  try {
    const status = await lstat(path)
    if (status.isSymbolicLink()) {
      throw new TypeError(`Ettin cache path contains a symlink: ${path}`)
    }
    return status
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

async function assertSafeCachePath(root, target) {
  const suffix = relative(root, target)
  if (suffix === '' || suffix === '..' || suffix.startsWith(`..${sep}`) ||
    isAbsolute(suffix)) {
    throw new TypeError('Ettin artifact path escaped cacheDir.')
  }
  let current = root
  const rootStatus = await existingPathIsSafe(current)
  if (rootStatus && !rootStatus.isDirectory()) {
    throw new TypeError('Ettin cacheDir must be a directory.')
  }
  if (!rootStatus) return
  for (const component of suffix.split(sep)) {
    current = join(current, component)
    const status = await existingPathIsSafe(current)
    if (!status) return
  }
  const canonicalRoot = await realpath(root)
  const canonicalTarget = await realpath(target)
  if (!canonicalTarget.startsWith(`${canonicalRoot}${sep}`)) {
    throw new TypeError('Ettin artifact path escaped cacheDir.')
  }
}

function requestedModelDirectory(cacheDir, modelDir) {
  if (typeof cacheDir !== 'string' || !isAbsolute(cacheDir)) {
    throw new TypeError('cacheDir must be an absolute application-owned path.')
  }
  const root = resolve(cacheDir)
  if (modelDir === undefined) {
    return {
      root,
      target: join(
        root,
        ...ETTIN_RERANKER_MODEL.id.split('/'),
        ETTIN_RERANKER_MODEL.revision,
      ),
    }
  }
  if (typeof modelDir !== 'string' || !isAbsolute(modelDir) ||
    resolve(modelDir) !== modelDir) {
    throw new TypeError(
      'modelDir must be a normalized absolute path inside cacheDir.',
    )
  }
  return { root, target: modelDir }
}

export async function resolveEttinModelDirectory(cacheDir, modelDir) {
  const { root, target } = requestedModelDirectory(cacheDir, modelDir)
  const suffix = relative(root, target)
  if (suffix === '' || suffix === '..' || suffix.startsWith(`..${sep}`) ||
    isAbsolute(suffix)) {
    throw new TypeError('Ettin modelDir must stay strictly inside cacheDir.')
  }
  const rootStatus = await existingPathIsSafe(root)
  if (!rootStatus?.isDirectory()) {
    throw new TypeError('Ettin cacheDir must be an existing non-symlink directory.')
  }
  let current = root
  for (const component of suffix.split(sep)) {
    current = join(current, component)
    const status = await existingPathIsSafe(current)
    if (!status?.isDirectory()) {
      throw new TypeError(
        `Ettin modelDir component must be an existing directory: ${current}`,
      )
    }
  }
  const canonicalRoot = await realpath(root)
  const canonicalTarget = await realpath(target)
  if (!canonicalTarget.startsWith(`${canonicalRoot}${sep}`)) {
    throw new TypeError('Ettin modelDir escaped canonical cacheDir.')
  }
  return canonicalTarget
}

async function ensurePrivateDirectory(root, directory) {
  await mkdir(root, { recursive: true, mode: 0o700 })
  const rootStatus = await existingPathIsSafe(root)
  if (!rootStatus?.isDirectory()) {
    throw new TypeError('Ettin cacheDir must be a non-symlink directory.')
  }
  const suffix = relative(root, directory)
  if (suffix === '..' || suffix.startsWith(`..${sep}`) || isAbsolute(suffix)) {
    throw new TypeError('Ettin artifact path escaped cacheDir.')
  }
  let current = root
  for (const component of suffix.split(sep).filter(Boolean)) {
    current = join(current, component)
    await mkdir(current, { mode: 0o700 }).catch((error) => {
      if (error?.code !== 'EEXIST') throw error
    })
    const status = await existingPathIsSafe(current)
    if (!status?.isDirectory()) {
      throw new TypeError(`Ettin cache path is not a safe directory: ${current}`)
    }
  }
  const canonicalRoot = await realpath(root)
  const canonicalDirectory = await realpath(directory)
  if (canonicalDirectory !== canonicalRoot &&
    !canonicalDirectory.startsWith(`${canonicalRoot}${sep}`)) {
    throw new TypeError('Ettin artifact path escaped cacheDir.')
  }
}

async function privateAtomicWrite(root, path, bytes) {
  await ensurePrivateDirectory(root, dirname(path))
  const temporary = `${path}.${process.pid}.tmp`
  let handle
  try {
    handle = await open(temporary, 'wx', 0o600)
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(temporary, path)
  } finally {
    await handle?.close().catch(() => {})
    await unlink(temporary).catch(() => {})
  }
}

export async function loadEttinArtifact(artifact, {
  cacheDir,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!ETTIN_HEAD_ARTIFACTS.includes(artifact)) {
    throw new TypeError('Only frozen Ettin head artifacts may be loaded.')
  }
  if (typeof cacheDir !== 'string' || !isAbsolute(cacheDir)) {
    throw new TypeError('cacheDir must be an absolute application-owned path.')
  }
  const root = resolve(cacheDir)
  const target = resolve(root, 'ettin-head', artifact.path)
  if (!target.startsWith(`${root}${sep}`)) {
    throw new TypeError('Ettin artifact path escaped cacheDir.')
  }
  await assertSafeCachePath(root, target)
  let bytes
  try {
    bytes = new Uint8Array(await readFile(target))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('fetchImpl must load a missing Ettin artifact.')
    }
    const response = await fetchImpl(artifact.url, {
      headers: { accept: 'application/octet-stream' },
      method: 'GET',
      redirect: 'follow',
    })
    if (!response?.ok || typeof response.arrayBuffer !== 'function') {
      throw new Error(`Ettin artifact download failed: ${artifact.path}`)
    }
    bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) {
      throw new Error(`Ettin artifact integrity mismatch: ${artifact.path}`)
    }
    await privateAtomicWrite(root, target, bytes)
  }
  if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) {
    throw new Error(`Ettin artifact integrity mismatch: ${artifact.path}`)
  }
  return bytes
}

export async function loadEttinHead({
  cacheDir,
  fetchImpl = globalThis.fetch,
  loadArtifact = loadEttinArtifact,
} = {}) {
  if (typeof loadArtifact !== 'function') {
    throw new TypeError('loadArtifact must be a function.')
  }
  const bytes = await Promise.all(ETTIN_HEAD_ARTIFACTS.map((artifact) =>
    loadArtifact(artifact, { cacheDir, fetchImpl })))
  return Object.freeze({
    dense: parseEttinSafetensors(bytes[0], ETTIN_HEAD_ARTIFACTS[0]),
    norm: parseEttinSafetensors(bytes[1], ETTIN_HEAD_ARTIFACTS[1]),
    final: parseEttinSafetensors(bytes[2], ETTIN_HEAD_ARTIFACTS[2]),
  })
}

// Abramowitz-Stegun 7.1.26; maximum absolute error is approximately 1.5e-7.
function erf(value) {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * x)
  const polynomial = (((((1.061405429 * t - 1.453152027) * t) +
    1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return sign * (1 - polynomial * Math.exp(-x * x))
}

export function ettinGelu(value) {
  return 0.5 * value * (1 + erf(value / Math.SQRT2))
}

export function scoreEttinHiddenStates(hiddenState, head, expectedBatch) {
  const dims = hiddenState?.dims
  const data = hiddenState?.data
  if (!Array.isArray(dims) || dims.length !== 3 ||
    dims[0] !== expectedBatch || !Number.isSafeInteger(dims[1]) || dims[1] < 1 ||
    dims[2] !== ETTIN_RERANKER_MODEL.hiddenSize ||
    !(data instanceof Float32Array) ||
    data.length !== dims[0] * dims[1] * dims[2]) {
    throw new TypeError('Ettin runtime returned invalid last_hidden_state.')
  }
  const dense = head?.dense?.['linear.weight']
  const normBias = head?.norm?.['norm.bias']
  const normWeight = head?.norm?.['norm.weight']
  const finalBias = head?.final?.['linear.bias']
  const finalWeight = head?.final?.['linear.weight']
  if (dense?.length !== 256 * 256 || normBias?.length !== 256 ||
    normWeight?.length !== 256 || finalBias?.length !== 1 ||
    finalWeight?.length !== 256) {
    throw new TypeError('Ettin native head is incomplete.')
  }
  const scores = []
  const activated = new Float64Array(256)
  const normalized = new Float64Array(256)
  for (let batch = 0; batch < expectedBatch; batch += 1) {
    const clsOffset = batch * dims[1] * 256
    for (let output = 0; output < 256; output += 1) {
      let sum = 0
      const weightOffset = output * 256
      for (let input = 0; input < 256; input += 1) {
        sum += data[clsOffset + input] * dense[weightOffset + input]
      }
      activated[output] = ettinGelu(sum)
    }
    let mean = 0
    for (const value of activated) mean += value
    mean /= 256
    let variance = 0
    for (const value of activated) variance += (value - mean) ** 2
    variance /= 256
    const denominator = Math.sqrt(
      variance + ETTIN_RERANKER_MODEL.layerNormEpsilon,
    )
    for (let index = 0; index < 256; index += 1) {
      normalized[index] = ((activated[index] - mean) / denominator) *
        normWeight[index] + normBias[index]
    }
    let score = finalBias[0]
    for (let index = 0; index < 256; index += 1) {
      score += normalized[index] * finalWeight[index]
    }
    if (!Number.isFinite(score)) {
      throw new TypeError('Ettin native head returned a nonfinite score.')
    }
    scores.push(score)
  }
  return scores
}

async function defaultRuntimeLoader() {
  try {
    return await import('@huggingface/transformers')
  } catch (error) {
    const failure = new Error(
      'The optional @huggingface/transformers runtime is not installed. ' +
      'Install and audit it in the consuming application, or provide loadRuntime.',
      { cause: error },
    )
    failure.code = 'RERANKER_RUNTIME_MISSING'
    throw failure
  }
}

function boundedText(value, label, maximum) {
  if (typeof value !== 'string' || value.length < 1) {
    throw new TypeError(`${label} must be a non-empty string.`)
  }
  if (value.length > maximum) {
    throw new TypeError(`${label} must be at most ${maximum} characters.`)
  }
  return value
}

export function createEttinReranker({
  cacheDir,
  fetchImpl = globalThis.fetch,
  loadArtifact = loadEttinArtifact,
  loadHead = loadEttinHead,
  loadRuntime = defaultRuntimeLoader,
  modelDir,
} = {}) {
  requestedModelDirectory(cacheDir, modelDir)
  if (typeof loadArtifact !== 'function' || typeof loadHead !== 'function' ||
    typeof loadRuntime !== 'function') {
    throw new TypeError(
      'loadArtifact, loadHead, and loadRuntime must be functions.',
    )
  }
  let loading
  const load = async () => {
    if (!loading) {
      loading = (async () => {
        const localModelDir = await resolveEttinModelDirectory(
          cacheDir,
          modelDir,
        )
        const runtime = await loadRuntime()
        if (typeof runtime?.AutoTokenizer?.from_pretrained !== 'function' ||
          typeof runtime?.AutoModel?.from_pretrained !== 'function') {
          throw new TypeError(
            'Ettin runtime must expose tokenizer and base-model factories.',
          )
        }
        const options = {
          local_files_only: true,
        }
        const [tokenizer, transformer, head] = await Promise.all([
          runtime.AutoTokenizer.from_pretrained(localModelDir, options),
          runtime.AutoModel.from_pretrained(localModelDir, {
            ...options,
            dtype: ETTIN_RERANKER_MODEL.dtype,
          }),
          loadHead({ cacheDir, fetchImpl, loadArtifact }),
        ])
        if (typeof tokenizer !== 'function' || typeof transformer !== 'function') {
          throw new TypeError('Ettin runtime loaded invalid model components.')
        }
        return {
          head,
          tokenizer,
          transformer,
        }
      })()
    }
    return loading
  }

  const rerank = async (query, candidateTexts) => {
    const normalizedQuery = boundedText(
      query,
      'query',
      TRANSFORMERS_RERANKER_LIMITS.queryChars,
    )
    if (!Array.isArray(candidateTexts)) {
      throw new TypeError('candidateTexts must be an array.')
    }
    if (candidateTexts.length > TRANSFORMERS_RERANKER_LIMITS.candidates) {
      throw new TypeError(
        `candidateTexts may contain at most ` +
        `${TRANSFORMERS_RERANKER_LIMITS.candidates} entries.`,
      )
    }
    if (candidateTexts.length === 0) return []
    const documents = candidateTexts.map((text, index) => boundedText(
      text,
      `candidateTexts[${index}]`,
      TRANSFORMERS_RERANKER_LIMITS.documentChars,
    ))
    const { head, tokenizer, transformer } = await load()
    const encoded = await tokenizer(
      documents.map(() => normalizedQuery),
      { padding: true, text_pair: documents, truncation: true },
    )
    const output = await transformer(encoded)
    return scoreEttinHiddenStates(
      output?.last_hidden_state,
      head,
      documents.length,
    )
  }
  Object.defineProperties(rerank, {
    model: { value: ETTIN_RERANKER_MODEL },
    warm: { value: load },
  })
  return Object.freeze(rerank)
}
