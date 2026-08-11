#!/usr/bin/env node
// Offline scale probe: what does recall look like at a 5,000-message
// back-and-forth? No provider, no spend, deterministic.
//
// Shape of the corpus: 2,500 turns (5,000 messages) of mundane dialogue,
// with 25 distinctive planted facts scattered through it. Each planted fact
// is later queried two ways:
//   - a SHARED-TOKEN paraphrase (different words, some overlap after
//     stemming) — the case ranked BM25 should win;
//   - a ZERO-OVERLAP paraphrase (no shared vocabulary at all) — the case
//     lexical search cannot win, recorded honestly as the boundary that
//     the semantic finding aid exists to close.
//
// The digest reducer deliberately keeps nothing, so every recall must come
// from journal search — this measures the exploration floor, the worst
// case, not the digest-assisted common case.
//
//   npm run scale-probe            # 2,500 turns
//   npm run scale-probe -- --turns 500
//   npm run scale-probe -- --tiers 50,500,2500
//   npm run scale-probe -- --lifetime-tokens 100000000
//   npm run scale-probe -- --turns 500 --synthetic-vectors 64
//   npm run scale-probe -- --tiers 250,1000 --scan-dimensions 384,768,1536
//   npm run scale-probe -- --tiers 1000,2500 --scan-dimensions 768,1536 \
//     --derived-locator
//   npm run scale-probe -- --embedder ./my-embedder.mjs
//
// The lifetime-token envelope is arithmetic over explicit message/chunk
// assumptions, not a tokenizer measurement or benchmark grade. Multi-tier
// runs use fresh databases so each row is an independently repeatable local
// diagnostic.
//
// `--embedder <path>` re-measures BOTH paraphrase columns through the
// semantic surface as well. The module must export `createEmbedder()`
// (or default-export it) returning an `embed(texts) -> number[][]`
// function — e.g. a few lines wiring `createGeminiEmbedder` from
// `evals/arms/embedder-gemini.mjs` to a metered transport. Without the
// flag the probe stays exactly what it always was: offline, no spend.

import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  createPalariBrain,
  ingestChatTurn,
} from '../src/index.mjs'
import { workspaceMemoryDbPath } from '../src/store.mjs'
import { openDerivedVectorSnapshot } from './derived-vector-locator.mjs'
import { FILLER, PLANTED } from './scale-recall-fixture.mjs'

export { PLANTED } from './scale-recall-fixture.mjs'

const SCOPE = { palariId: 'scale-palari', userId: 'scale-user' }
const WORKSPACE_ID = 'scale'

export const DEFAULT_LIFETIME_TOKENS = 100_000_000
export const SCALE_MESSAGE_TOKEN_RANGE = Object.freeze([50, 200])
export const SCALE_CHUNK_TOKEN_RANGE = Object.freeze([256, 512])
export const DEFAULT_EXACT_SCAN_DIMENSIONS = Object.freeze([384, 768, 1_536])
export const DEFAULT_EXACT_SCAN_REVIEW_P95_MS = 100

const FLOAT32_BYTES = Float32Array.BYTES_PER_ELEMENT
const MAX_EXACT_SCAN_DIMENSION_COUNT = 8
const MAX_EXACT_SCAN_DIMENSIONS = 4_096

function keepNothing({ request }) {
  return {
    actions: [],
    baseRevision: request.input.baseRevision,
    dispositions: request.input.evidence.map((item) => ({
      evidenceId: item.id,
      outcome: 'no_memory',
    })),
  }
}

function positiveSafeInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError(`${label} must be a positive integer.`)
  }
  return number
}

export function estimateLifetimeEnvelope({
  lifetimeTokens = DEFAULT_LIFETIME_TOKENS,
} = {}) {
  const tokens = positiveSafeInteger(lifetimeTokens, 'lifetimeTokens')
  const [messageMinTokens, messageMaxTokens] = SCALE_MESSAGE_TOKEN_RANGE
  const [chunkMinTokens, chunkMaxTokens] = SCALE_CHUNK_TOKEN_RANGE
  return Object.freeze({
    chunkTokens: SCALE_CHUNK_TOKEN_RANGE,
    chunkVectors: Object.freeze({
      max: Math.ceil(tokens / chunkMinTokens),
      min: Math.ceil(tokens / chunkMaxTokens),
    }),
    lifetimeTokens: tokens,
    messageTokens: SCALE_MESSAGE_TOKEN_RANGE,
    messageVectors: Object.freeze({
      max: Math.ceil(tokens / messageMinTokens),
      min: Math.ceil(tokens / messageMaxTokens),
    }),
  })
}

function normalizedDimensions(values) {
  if (!Array.isArray(values) || values.length < 1 ||
    values.length > MAX_EXACT_SCAN_DIMENSION_COUNT) {
    throw new TypeError(
      `dimensions must contain 1 to ` +
        `${MAX_EXACT_SCAN_DIMENSION_COUNT} values.`,
    )
  }
  const dimensions = values.map((value) =>
    positiveSafeInteger(value, 'dimension'))
  if (dimensions.some((value) => value > MAX_EXACT_SCAN_DIMENSIONS)) {
    throw new TypeError(
      `each dimension must be at most ${MAX_EXACT_SCAN_DIMENSIONS}.`,
    )
  }
  return [...new Set(dimensions)].sort((left, right) => left - right)
}

function safeProduct(values, label) {
  const product = values.reduce((total, value) => total * value, 1)
  if (!Number.isSafeInteger(product)) {
    throw new TypeError(`${label} exceeds safe integer arithmetic.`)
  }
  return product
}

export function estimateExactScanEnvelope({
  dimensions = DEFAULT_EXACT_SCAN_DIMENSIONS,
  lifetimeTokens = DEFAULT_LIFETIME_TOKENS,
} = {}) {
  const lifetime = estimateLifetimeEnvelope({ lifetimeTokens })
  const scans = normalizedDimensions(dimensions).map((size) => {
    const vectorComponents = Object.freeze({
      max: safeProduct(
        [lifetime.messageVectors.max, size],
        'maximum vector components',
      ),
      min: safeProduct(
        [lifetime.messageVectors.min, size],
        'minimum vector components',
      ),
    })
    return Object.freeze({
      dimensions: size,
      rawVectorBytes: Object.freeze({
        max: safeProduct(
          [vectorComponents.max, FLOAT32_BYTES],
          'maximum raw vector bytes',
        ),
        min: safeProduct(
          [vectorComponents.min, FLOAT32_BYTES],
          'minimum raw vector bytes',
        ),
      }),
      vectorComponents,
    })
  })
  return Object.freeze({
    floatBytes: FLOAT32_BYTES,
    lifetimeTokens: lifetime.lifetimeTokens,
    messageTokens: lifetime.messageTokens,
    messageVectors: lifetime.messageVectors,
    scans: Object.freeze(scans),
  })
}

function positiveFiniteNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`${label} must be a positive finite number.`)
  }
  return number
}

export function summarizeExactScanThreshold(measurements, {
  p95BudgetMs = DEFAULT_EXACT_SCAN_REVIEW_P95_MS,
} = {}) {
  if (!Array.isArray(measurements) || measurements.length < 1) {
    throw new TypeError('measurements must contain at least one scan cell.')
  }
  const budget = positiveFiniteNumber(p95BudgetMs, 'p95BudgetMs')
  const grouped = new Map()
  for (const measurement of measurements) {
    const dimensions = positiveSafeInteger(
      measurement?.vectorDimensions,
      'measurement.vectorDimensions',
    )
    const messages = positiveSafeInteger(
      measurement?.messages,
      'measurement.messages',
    )
    const shared = Number(measurement?.semanticSharedP95Ms)
    const zero = Number(measurement?.semanticZeroP95Ms)
    if (!Number.isFinite(shared) || shared < 0 ||
      !Number.isFinite(zero) || zero < 0) {
      throw new TypeError('measurement semantic p95 values must be finite.')
    }
    const cells = grouped.get(dimensions) ?? []
    cells.push({ messages, p95Ms: Math.max(shared, zero) })
    grouped.set(dimensions, cells)
  }

  const byDimension = [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([dimensions, cells]) => {
      cells.sort((left, right) => left.messages - right.messages)
      const firstIndex = cells.findIndex((cell) => cell.p95Ms > budget)
      const first = firstIndex < 0 ? null : cells[firstIndex]
      const lastWithin = (firstIndex < 0
        ? cells
        : cells.slice(0, firstIndex))
        .filter((cell) => cell.p95Ms <= budget)
        .at(-1) ?? null
      return Object.freeze({
        dimensions,
        firstObservedOverBudgetMessages: first?.messages ?? null,
        firstObservedP95Ms: first?.p95Ms ?? null,
        lastObservedWithinBudgetMessages: lastWithin?.messages ?? null,
        measuredThroughMessages: cells.at(-1).messages,
        status: first ? 'comparison_justified' : 'not_observed',
      })
    })
  return Object.freeze({
    byDimension: Object.freeze(byDimension),
    p95BudgetMs: budget,
    status: byDimension.some(({ status }) =>
      status === 'comparison_justified')
      ? 'comparison_justified'
      : 'not_observed',
  })
}

function fnv1a(value) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function normalizedSyntheticVector(key, dimensions) {
  let state = fnv1a(key) || 0x9e3779b9
  const vector = []
  let squaredMagnitude = 0
  for (let index = 0; index < dimensions; index += 1) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    const value = ((state >>> 0) / 0xffffffff) * 2 - 1
    vector.push(value)
    squaredMagnitude += value * value
  }
  const magnitude = Math.sqrt(squaredMagnitude) || 1
  return Object.freeze(vector.map((value) => value / magnitude))
}

// Deterministic vector plumbing for capacity/latency diagnostics only. The
// three texts in each planted row intentionally share a vector so the probe
// can still verify canonical ID read-back. This is not an embedding-quality
// result and the CLI labels it accordingly.
export function createSyntheticScaleEmbedder({ dimensions = 64 } = {}) {
  const size = positiveSafeInteger(dimensions, 'dimensions')
  const plantedKeys = new Map()
  for (const [index, row] of PLANTED.entries()) {
    for (const text of row) plantedKeys.set(text, `planted:${index}`)
  }
  const vectors = new Map()
  return (texts) => texts.map((raw) => {
    const text = String(raw)
    const key = plantedKeys.get(text) ?? `literal:${text}`
    if (!vectors.has(key)) {
      vectors.set(key, normalizedSyntheticVector(key, size))
    }
    return vectors.get(key)
  })
}

function normalizedTiers(values) {
  if (!Array.isArray(values) || values.length < 1) {
    throw new TypeError('tiers must contain at least one turn count.')
  }
  const tiers = values.map((value) => positiveSafeInteger(value, 'tier'))
  if (tiers.some((value) => value < 50)) {
    throw new TypeError('each tier must contain at least 50 turns.')
  }
  return [...new Set(tiers)].sort((left, right) => left - right)
}

function parseTiers(value) {
  const raw = String(value ?? '').trim()
  if (!raw) throw new TypeError('--tiers requires comma-separated turns.')
  return normalizedTiers(raw.split(',').map((item) => Number(item.trim())))
}

function parseDimensions(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    throw new TypeError('--scan-dimensions requires comma-separated values.')
  }
  return normalizedDimensions(
    raw.split(',').map((item) => Number(item.trim())),
  )
}

function latencyStats(latencies) {
  const sorted = [...latencies].sort((left, right) => left - right)
  return {
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
  }
}

async function sqliteFootprintBytes(dbPath) {
  let bytes = 0
  for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      bytes += (await stat(path)).size
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  return bytes
}

function formatInteger(value) {
  return Number(value).toLocaleString('en-US')
}

function logEnvelope(log, envelope) {
  log(`${formatInteger(envelope.lifetimeTokens)}-token lifetime envelope ` +
    `(assumptions, not measured):`)
  log(`  one vector per ${envelope.messageTokens[0]}–` +
    `${envelope.messageTokens[1]}-token message: ` +
    `${formatInteger(envelope.messageVectors.min)}–` +
    `${formatInteger(envelope.messageVectors.max)} message vectors`)
  log(`  fixed ${envelope.chunkTokens[0]}–${envelope.chunkTokens[1]}-token ` +
    `chunks: ${formatInteger(envelope.chunkVectors.min)}–` +
    `${formatInteger(envelope.chunkVectors.max)} chunk vectors`)
}

function decimalGigabytes(bytes) {
  return Number((Number(bytes) / 1e9).toFixed(2))
}

function logExactScanEnvelope(log, envelope) {
  log('current one-vector-per-message exact-scan envelope ' +
    '(arithmetic, no latency extrapolation):')
  for (const scan of envelope.scans) {
    log(`  ${formatInteger(scan.dimensions)}d: ` +
      `${decimalGigabytes(scan.rawVectorBytes.min)}–` +
      `${decimalGigabytes(scan.rawVectorBytes.max)} GB raw Float32 payload; ` +
      `${formatInteger(scan.vectorComponents.min)}–` +
      `${formatInteger(scan.vectorComponents.max)} ` +
      `component visits/query; ` +
      `${formatInteger(envelope.messageVectors.min)}–` +
      `${formatInteger(envelope.messageVectors.max)} candidates fully ranked`)
  }
}

function parseArgs(argv) {
  const options = {
    lifetimeTokens: DEFAULT_LIFETIME_TOKENS,
    turns: 2_500,
  }
  let turnsSelected = false
  let tiersSelected = false
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--turns') {
      options.turns = Number(argv[index + 1])
      turnsSelected = true
      index += 1
      continue
    }
    if (argv[index] === '--tiers') {
      options.tiers = parseTiers(argv[index + 1])
      tiersSelected = true
      index += 1
      continue
    }
    if (argv[index] === '--lifetime-tokens') {
      options.lifetimeTokens = Number(argv[index + 1])
      index += 1
      continue
    }
    if (argv[index] === '--synthetic-vectors') {
      options.syntheticVectorDimensions = Number(argv[index + 1])
      index += 1
      continue
    }
    if (argv[index] === '--scan-dimensions') {
      options.scanDimensions = parseDimensions(argv[index + 1])
      index += 1
      continue
    }
    if (argv[index] === '--scan-p95-budget-ms') {
      options.scanP95BudgetMs = Number(argv[index + 1])
      index += 1
      continue
    }
    if (argv[index] === '--derived-locator') {
      options.compareDerivedLocator = true
      continue
    }
    if (argv[index] === '--embedder') {
      options.embedderPath = String(argv[index + 1] ?? '')
      index += 1
      continue
    }
    throw new TypeError(`Unknown scale-probe flag: ${argv[index]}`)
  }
  if (turnsSelected && tiersSelected) {
    throw new TypeError('--turns and --tiers are mutually exclusive.')
  }
  const semanticModes = [
    Boolean(options.embedderPath),
    options.syntheticVectorDimensions !== undefined,
    options.scanDimensions !== undefined,
  ].filter(Boolean).length
  if (semanticModes > 1) {
    throw new TypeError(
      '--embedder, --synthetic-vectors, and --scan-dimensions are ' +
        'mutually exclusive.',
    )
  }
  if (options.scanP95BudgetMs !== undefined && !options.scanDimensions) {
    throw new TypeError(
      '--scan-p95-budget-ms requires --scan-dimensions.',
    )
  }
  if (options.compareDerivedLocator && !options.scanDimensions) {
    throw new TypeError('--derived-locator requires --scan-dimensions.')
  }
  if (!Number.isSafeInteger(options.turns) || options.turns < 50) {
    throw new TypeError('--turns must be an integer of at least 50.')
  }
  positiveSafeInteger(options.lifetimeTokens, '--lifetime-tokens')
  if (options.syntheticVectorDimensions !== undefined) {
    positiveSafeInteger(
      options.syntheticVectorDimensions,
      '--synthetic-vectors',
    )
  }
  if (options.scanP95BudgetMs !== undefined) {
    positiveFiniteNumber(
      options.scanP95BudgetMs,
      '--scan-p95-budget-ms',
    )
  }
  return options
}

async function loadEmbedder(embedderPath) {
  const path = String(embedderPath ?? '').trim()
  if (!path) throw new TypeError('--embedder requires a module path.')
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path)
  const module = await import(pathToFileURL(absolute).href)
  const factory = module.createEmbedder ?? module.default
  if (typeof factory !== 'function') {
    throw new TypeError(
      'The embedder module must export createEmbedder() ' +
      '(or default-export it) returning embed(texts) -> number[][].',
    )
  }
  const embed = await factory()
  if (typeof embed !== 'function') {
    throw new TypeError('createEmbedder() must return an embed function.')
  }
  return embed
}

export async function runScaleProbe({
  compareDerivedLocator = false,
  embedder = null,
  log = console.log,
  semanticLabel = 'embedder supplied',
  turns = 2_500,
} = {}) {
  if (compareDerivedLocator && typeof embedder !== 'function') {
    throw new TypeError('A derived-locator comparison requires an embedder.')
  }
  const root = await mkdtemp(join(tmpdir(), 'palari-scale-'))
  const statePath = join(root, 'state.json')
  const dbPath = workspaceMemoryDbPath({ statePath, workspaceId: WORKSPACE_ID })
  const brain = await createPalariBrain({
    embedder,
    memoryEnabled: true,
    statePath,
    workspaceId: WORKSPACE_ID,
  })

  const plantEvery = Math.floor(turns / (PLANTED.length + 1))
  const ingestStart = performance.now()
  let contentChars = 0
  let planted = 0
  for (let index = 0; index < turns; index += 1) {
    const isPlant = planted < PLANTED.length &&
      index === (planted + 1) * plantEvery
    const userMessage = isPlant
      ? PLANTED[planted][0]
      : FILLER[index % FILLER.length]
    if (isPlant) planted += 1
    contentChars += userMessage.length + 'Done.'.length
    await ingestChatTurn(brain, {
      assistantMessage: 'Done.',
      eventAt: new Date(Date.UTC(2025, 0, 1) + index * 600_000).toISOString(),
      palariId: SCOPE.palariId,
      retention: 'durable',
      sourceMessageId: `s${Math.floor(index / 40)}:${index % 40}`,
      userId: SCOPE.userId,
      userMessage,
    }, { reducer: keepNothing, reducerId: 'scale/v1' })
  }
  const ingestMs = performance.now() - ingestStart

  // Warm the index once, then measure query latency separately.
  brain.exploreFind(SCOPE, { phrase: 'warmup', ranked: true })

  function recallRate(column) {
    let hits = 0
    const latencies = []
    for (const row of PLANTED) {
      const started = performance.now()
      const found = brain.exploreFind(SCOPE, {
        phrase: row[column],
        ranked: true,
      })
      latencies.push(performance.now() - started)
      const target = row[0]
      if (found.matches.some((match) => {
        const read = brain.exploreRead(SCOPE, {
          evidenceIds: [match.evidenceId],
        })
        return read.messages[0]?.text === target
      })) hits += 1
    }
    return {
      hits,
      ...latencyStats(latencies),
      total: PLANTED.length,
    }
  }

  const shared = recallRate(1)
  const zero = recallRate(2)

  // With an embedder, measure the same two columns through the semantic
  // surface. Same hit criterion as the lexical columns: the planted
  // canonical row appears among the returned rows (top-20 parity), and
  // the hit is verified by reading the byte-exact text back — the index
  // locates; the journal testifies.
  let semantic = null
  if (embedder) {
    const indexStart = performance.now()
    let vectorIndexCalls = 0
    let vectorRowsIndexed = 0
    // Historical catch-up is explicit and bounded. Repeat the one-batch
    // maintenance primitive here because this diagnostic intentionally wants
    // a complete bank before measuring steady-state query latency.
    for (;;) {
      const progress = await brain.indexSemantic(SCOPE)
      vectorIndexCalls += 1
      vectorRowsIndexed += progress.indexed
      if (progress.complete) break
    }
    const vectorIndexMs = performance.now() - indexStart
    // Warm query embedding and the exact scoped scan outside catch-up timing.
    await brain.exploreSemantic(SCOPE, { phrase: 'warmup' })

    async function semanticRecall(column) {
      let hits = 0
      const latencies = []
      const rankings = []
      for (const row of PLANTED) {
        const started = performance.now()
        const found = await brain.exploreSemantic(SCOPE, {
          phrase: row[column],
        })
        latencies.push(performance.now() - started)
        rankings.push(found.map(({ evidenceId }) => evidenceId))
        if (found.some((match) => {
          const read = brain.exploreRead(SCOPE, {
            evidenceIds: [match.evidenceId],
          })
          return read.messages[0]?.text === row[0]
        })) hits += 1
      }
      return {
        hits,
        ...latencyStats(latencies),
        rankings,
        total: PLANTED.length,
      }
    }

    semantic = {
      shared: await semanticRecall(1),
      vectorIndexCalls,
      vectorIndexMs,
      vectorRowsIndexed,
      zero: await semanticRecall(2),
    }
    if (compareDerivedLocator) {
      const snapshot = openDerivedVectorSnapshot({
        databasePath: dbPath,
        scope: SCOPE,
      })
      try {
        const [warmVector] = await embedder(['warmup'])
        snapshot.search(warmVector)

        async function locatorRecall(column, exactRankings) {
          let exactIds = 0
          let exactIdsFound = 0
          let hits = 0
          const candidateCounts = []
          const latencies = []
          for (const [index, row] of PLANTED.entries()) {
            const started = performance.now()
            const [queryVector] = await embedder([row[column]])
            const found = snapshot.search(queryVector)
            latencies.push(performance.now() - started)
            candidateCounts.push(found.scoredCount)
            if (found.matches.some((match) => match.text === row[0])) hits += 1
            const actual = new Set(found.matches.map(({ evidenceId }) =>
              evidenceId))
            for (const evidenceId of exactRankings[index]) {
              exactIds += 1
              if (actual.has(evidenceId)) exactIdsFound += 1
            }
          }
          const candidates = latencyStats(candidateCounts)
          const latency = latencyStats(latencies)
          const meanCandidates = candidateCounts.reduce(
            (total, value) => total + value,
            0,
          ) / candidateCounts.length
          return Object.freeze({
            exactTop20IdRecall: Number(
              (exactIdsFound / Math.max(1, exactIds)).toFixed(3),
            ),
            maxCandidates: Math.max(...candidateCounts),
            meanCandidates: Number(meanCandidates.toFixed(1)),
            medianCandidates: Number(candidates.medianMs.toFixed(1)),
            medianMs: Number(latency.medianMs.toFixed(1)),
            p95Candidates: Number(candidates.p95Ms.toFixed(1)),
            p95Ms: Number(latency.p95Ms.toFixed(1)),
            targetRecall: `${hits}/${PLANTED.length}`,
          })
        }

        semantic.derivedLocator = Object.freeze({
          ...snapshot.stats,
          buildMs: Number(snapshot.stats.buildMs.toFixed(1)),
          shared: await locatorRecall(1, semantic.shared.rankings),
          zero: await locatorRecall(2, semantic.zero.rankings),
        })
      } finally {
        snapshot.close()
      }
    }
  }

  brain.close()
  const dbBytes = await sqliteFootprintBytes(dbPath)

  const summary = {
    contentChars,
    contentCharsPerMessage: Number((contentChars / (turns * 2)).toFixed(1)),
    dbBytes,
    dbBytesPerMessage: Number((dbBytes / (turns * 2)).toFixed(1)),
    dbMb: Number((dbBytes / 1e6).toFixed(2)),
    ingestMsPerTurn: Number((ingestMs / turns).toFixed(2)),
    messages: turns * 2,
    sharedTokenRecall: `${shared.hits}/${shared.total}`,
    sharedMedianMs: Number(shared.medianMs.toFixed(1)),
    sharedP95Ms: Number(shared.p95Ms.toFixed(1)),
    turns,
    zeroOverlapRecall: `${zero.hits}/${zero.total}`,
    zeroMedianMs: Number(zero.medianMs.toFixed(1)),
    zeroP95Ms: Number(zero.p95Ms.toFixed(1)),
  }
  log(`scale probe — ${summary.messages} messages (${turns} turns)`)
  log(`  ingest: ${summary.ingestMsPerTurn} ms/turn`)
  log(`  storage: ${summary.dbMb} MB, ${summary.dbBytesPerMessage} ` +
    `bytes/message (${summary.contentCharsPerMessage} content chars/message)`)
  log(`  shared-token paraphrase recall: ${summary.sharedTokenRecall} ` +
    `(median/p95 find ${summary.sharedMedianMs}/${summary.sharedP95Ms} ms)`)
  log(`  zero-overlap paraphrase recall: ${summary.zeroOverlapRecall} ` +
    `(median/p95 find ${summary.zeroMedianMs}/${summary.zeroP95Ms} ms) — ` +
    `the lexical boundary; ` +
    `the semantic finding aid exists to close this`)
  if (semantic) {
    summary.semanticSharedRecall =
      `${semantic.shared.hits}/${semantic.shared.total}`
    summary.semanticZeroRecall =
      `${semantic.zero.hits}/${semantic.zero.total}`
    summary.vectorIndexMs = Number(semantic.vectorIndexMs.toFixed(0))
    summary.vectorIndexMsPerMessage =
      Number((semantic.vectorIndexMs / summary.messages).toFixed(3))
    summary.vectorIndexCalls = semantic.vectorIndexCalls
    summary.vectorRowsIndexed = semantic.vectorRowsIndexed
    summary.semanticSharedMedianMs =
      Number(semantic.shared.medianMs.toFixed(1))
    summary.semanticSharedP95Ms = Number(semantic.shared.p95Ms.toFixed(1))
    summary.semanticZeroMedianMs = Number(semantic.zero.medianMs.toFixed(1))
    summary.semanticZeroP95Ms = Number(semantic.zero.p95Ms.toFixed(1))
    log(`  semantic surface (${semanticLabel}): vector catch-up ` +
      `${summary.vectorIndexMs} ms ` +
      `(${summary.vectorIndexMsPerMessage} ms/message) in ` +
      `${summary.vectorIndexCalls} bounded calls`)
    log(`    shared-token via semantic: ${summary.semanticSharedRecall} ` +
      `(median/p95 ${summary.semanticSharedMedianMs}/` +
      `${summary.semanticSharedP95Ms} ms)`)
    log(`    zero-overlap via semantic: ${summary.semanticZeroRecall} ` +
      `(median/p95 ${summary.semanticZeroMedianMs}/` +
      `${summary.semanticZeroP95Ms} ms)`)
    if (semantic.derivedLocator) {
      summary.derivedLocator = semantic.derivedLocator
      const locator = semantic.derivedLocator
      log(`  private derived locator; plumbing-only recall ` +
        `(${locator.strategy}): ${locator.entries} scoped IDs, ` +
        `${locator.buildMs} ms build, ${locator.logicalSketchBytes} ` +
        `logical sketch bytes, ${locator.bucketReferences} bucket refs`)
      log(`    shared-token locator: ${locator.shared.targetRecall} target ` +
        `recall, ${locator.shared.exactTop20IdRecall} exact top-20 ID ` +
        `recall, ${locator.shared.meanCandidates} mean candidates, ` +
        `${locator.shared.p95Ms} ms p95`)
      log(`    zero-overlap locator: ${locator.zero.targetRecall} target ` +
        `recall, ${locator.zero.exactTop20IdRecall} exact top-20 ID ` +
        `recall, ${locator.zero.meanCandidates} mean candidates, ` +
        `${locator.zero.p95Ms} ms p95`)
    }
  }

  await rm(root, { force: true, recursive: true })
  return summary
}

export async function runScaleCurve({
  compareDerivedLocator = false,
  embedder = null,
  lifetimeTokens = DEFAULT_LIFETIME_TOKENS,
  log = console.log,
  semanticLabel = 'embedder supplied',
  tiers = [2_500],
} = {}) {
  const envelope = estimateLifetimeEnvelope({ lifetimeTokens })
  const normalized = normalizedTiers(tiers)
  logEnvelope(log, envelope)
  const measurements = []
  for (const turns of normalized) {
    measurements.push(await runScaleProbe({
      compareDerivedLocator,
      embedder,
      log,
      semanticLabel,
      turns,
    }))
  }
  return Object.freeze({ envelope, measurements })
}

export async function runSemanticScanMatrix({
  compareDerivedLocator = false,
  dimensions = DEFAULT_EXACT_SCAN_DIMENSIONS,
  lifetimeTokens = DEFAULT_LIFETIME_TOKENS,
  log = console.log,
  p95BudgetMs = DEFAULT_EXACT_SCAN_REVIEW_P95_MS,
  tiers = [2_500],
} = {}) {
  const sizes = normalizedDimensions(dimensions)
  const normalized = normalizedTiers(tiers)
  const budget = positiveFiniteNumber(p95BudgetMs, 'p95BudgetMs')
  const envelope = estimateExactScanEnvelope({
    dimensions: sizes,
    lifetimeTokens,
  })
  logEnvelope(log, estimateLifetimeEnvelope({ lifetimeTokens }))
  logExactScanEnvelope(log, envelope)
  log(`exact-scan p95 review budget: ${budget} ms ` +
    '(diagnostic assumption, not a product SLO)')

  const measurements = []
  for (const vectorDimensions of sizes) {
    for (const turns of normalized) {
      const measured = await runScaleProbe({
        compareDerivedLocator,
        embedder: createSyntheticScaleEmbedder({
          dimensions: vectorDimensions,
        }),
        log,
        semanticLabel: `synthetic ${vectorDimensions}d exact-scan fixture; ` +
          `recall is plumbing-only`,
        turns,
      })
      const vectorComponents = safeProduct(
        [measured.messages, vectorDimensions],
        'measured vector components',
      )
      const exactScanP95Ms = Math.max(
        measured.semanticSharedP95Ms,
        measured.semanticZeroP95Ms,
      )
      measurements.push(Object.freeze({
        ...measured,
        exactScanP95Ms,
        rawVectorBytes: safeProduct(
          [vectorComponents, FLOAT32_BYTES],
          'measured raw vector bytes',
        ),
        reviewBudgetExceeded: exactScanP95Ms > budget,
        vectorComponents,
        vectorDimensions,
      }))
    }
  }
  const threshold = summarizeExactScanThreshold(measurements, {
    p95BudgetMs: budget,
  })
  for (const observed of threshold.byDimension) {
    if (observed.status === 'comparison_justified') {
      const first = formatInteger(
        observed.firstObservedOverBudgetMessages,
      )
      if (observed.lastObservedWithinBudgetMessages === null) {
        log(`  ${observed.dimensions}d locator comparison justified at ` +
          `the first measured ${first}-message cell ` +
          `(${observed.firstObservedP95Ms} ms p95)`)
      } else {
        log(`  ${observed.dimensions}d locator comparison bracket: ` +
          `${formatInteger(
            observed.lastObservedWithinBudgetMessages,
          )}–${first} messages; first over-budget cell ` +
          `${observed.firstObservedP95Ms} ms p95`)
      }
    } else {
      log(`  ${observed.dimensions}d review threshold not observed through ` +
        `${formatInteger(observed.measuredThroughMessages)} messages`)
    }
  }
  return Object.freeze({
    envelope,
    measurements: Object.freeze(measurements),
    threshold,
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.scanDimensions) {
      await runSemanticScanMatrix({
        compareDerivedLocator: options.compareDerivedLocator ?? false,
        dimensions: options.scanDimensions,
        lifetimeTokens: options.lifetimeTokens,
        p95BudgetMs: options.scanP95BudgetMs ??
          DEFAULT_EXACT_SCAN_REVIEW_P95_MS,
        tiers: options.tiers ?? [options.turns],
      })
    } else {
      let embedder = null
      let semanticLabel = 'embedder supplied'
      if (options.embedderPath) {
        embedder = await loadEmbedder(options.embedderPath)
      } else if (options.syntheticVectorDimensions !== undefined) {
        embedder = createSyntheticScaleEmbedder({
          dimensions: options.syntheticVectorDimensions,
        })
        semanticLabel = `synthetic ${options.syntheticVectorDimensions}d ` +
          `capacity fixture; recall is plumbing-only`
      }
      await runScaleCurve({
        embedder,
        lifetimeTokens: options.lifetimeTokens,
        semanticLabel,
        tiers: options.tiers ?? [options.turns],
      })
    }
  } catch (error) {
    console.error(`SCALE_PROBE_FAILED: ${error?.message ?? error}`)
    process.exitCode = 1
  }
}
