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

const SCOPE = { palariId: 'scale-palari', userId: 'scale-user' }
const WORKSPACE_ID = 'scale'

export const DEFAULT_LIFETIME_TOKENS = 100_000_000
export const SCALE_MESSAGE_TOKEN_RANGE = Object.freeze([50, 200])
export const SCALE_CHUNK_TOKEN_RANGE = Object.freeze([256, 512])

const FILLER = [
  'Can you check the weather for tomorrow morning?',
  'Remind me to reply to the vendor thread later today.',
  'What was on my calendar for Thursday afternoon?',
  'Draft a short thank-you note for the team meeting.',
  'Move my afternoon review earlier if there is space.',
  'Summarize the last three updates from the project channel.',
  'What time does the pharmacy on the corner close?',
  'Add milk and coffee beans to the shopping list.',
]

// [planted statement, shared-token paraphrase, zero-overlap paraphrase]
export const PLANTED = [
  ['I keep the spare key inside the blue ceramic pot on the balcony.',
    'where is the spare key hidden', 'how do I get into my flat'],
  ['The wifi password at the cabin is trout-river-42.',
    'what is the cabin wifi password', 'how do I get online at the lake house'],
  ['My accountant is Beatriz Fonseca at Almeida & Costa.',
    'who does my accounting', 'which firm handles my taxes'],
  ['The storage unit is number 217 at the Alcântara facility.',
    'which storage unit number is mine', 'where are my boxes kept'],
  ['My daughter Ana is allergic to hazelnuts.',
    'what is Ana allergic to', 'which food should my kid avoid'],
  ['The landlord agreed to freeze the rent until January.',
    'what did the landlord agree about rent', 'what happens with my monthly housing cost'],
  ['My license plate is AB-12-XY.',
    'what is my license plate', 'the registration on my car'],
  ['The server backup runs every Sunday at 03:00.',
    'when does the server backup run', 'the weekly data safety job schedule'],
  ['Dr. Peixoto moved my appointment to the 14th.',
    'when is my appointment with Dr. Peixoto', 'my next medical visit date'],
  ['The conference badge pickup is at Hall C, desk 12.',
    'where is the conference badge pickup', 'where do I collect my event pass'],
  ['My gym locker combination is 30-22-14.',
    'what is my gym locker combination', 'the code for the box at the fitness club'],
  ['The contractor quoted 4,800 euros for the bathroom.',
    'what did the contractor quote for the bathroom', 'the renovation price estimate'],
  ['Grandma’s stew needs smoked paprika, not sweet.',
    'what paprika does grandma’s stew need', 'the secret ingredient in the family recipe'],
  ['My frequent flyer number is TP-9982031.',
    'what is my frequent flyer number', 'my airline loyalty account'],
  ['The office door code changes to 7391 on Friday.',
    'what does the office door code change to', 'the new entry PIN at work'],
  ['Rex the beagle gets his heartworm pill on the first of the month.',
    'when does Rex get his heartworm pill', 'the dog medication day'],
  ['The venue deposit of 600 euros is refundable until March 3rd.',
    'when is the venue deposit refundable until', 'the last day to cancel the party hall'],
  ['My blood type is O negative.',
    'what is my blood type', 'which donor group am I'],
  ['The spare printer toner is in the bottom drawer of the file cabinet.',
    'where is the spare printer toner', 'replacement ink location'],
  ['Aunt Marta arrives on the 19:40 train from Coimbra.',
    'which train does Aunt Marta arrive on', 'when does my relative get here'],
  ['The insurance claim reference is CLM-88412.',
    'what is the insurance claim reference', 'the case number for my damages file'],
  ['The rooftop garden watering is Tuesdays and Saturdays.',
    'when is the rooftop garden watering', 'the plant care days upstairs'],
  ['My preferred seat is 11C, aisle, never the middle.',
    'what is my preferred seat', 'where do I like to sit on a plane'],
  ['The book club moved to the second Wednesday of the month.',
    'when did the book club move to', 'the new date for our reading group'],
  ['The tax deadline extension was approved until October 15th.',
    'when was the tax deadline extension approved until', 'how long do I have for the fiscal filing'],
]

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
  if (options.embedderPath && options.syntheticVectorDimensions !== undefined) {
    throw new TypeError(
      '--embedder and --synthetic-vectors are mutually exclusive.',
    )
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
  embedder = null,
  log = console.log,
  semanticLabel = 'embedder supplied',
  turns = 2_500,
} = {}) {
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
    // The first semantic call pays for embedding every journal row
    // (batched, incremental); time it apart from query latency.
    await brain.exploreSemantic(SCOPE, { phrase: 'warmup' })
    const vectorIndexMs = performance.now() - indexStart

    async function semanticRecall(column) {
      let hits = 0
      const latencies = []
      for (const row of PLANTED) {
        const started = performance.now()
        const found = await brain.exploreSemantic(SCOPE, {
          phrase: row[column],
        })
        latencies.push(performance.now() - started)
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
        total: PLANTED.length,
      }
    }

    semantic = {
      shared: await semanticRecall(1),
      vectorIndexMs,
      zero: await semanticRecall(2),
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
    summary.semanticSharedMedianMs =
      Number(semantic.shared.medianMs.toFixed(1))
    summary.semanticSharedP95Ms = Number(semantic.shared.p95Ms.toFixed(1))
    summary.semanticZeroMedianMs = Number(semantic.zero.medianMs.toFixed(1))
    summary.semanticZeroP95Ms = Number(semantic.zero.p95Ms.toFixed(1))
    log(`  semantic surface (${semanticLabel}): vector indexing ` +
      `${summary.vectorIndexMs} ms ` +
      `(${summary.vectorIndexMsPerMessage} ms/message)`)
    log(`    shared-token via semantic: ${summary.semanticSharedRecall} ` +
      `(median/p95 ${summary.semanticSharedMedianMs}/` +
      `${summary.semanticSharedP95Ms} ms)`)
    log(`    zero-overlap via semantic: ${summary.semanticZeroRecall} ` +
      `(median/p95 ${summary.semanticZeroMedianMs}/` +
      `${summary.semanticZeroP95Ms} ms)`)
  }

  await rm(root, { force: true, recursive: true })
  return summary
}

export async function runScaleCurve({
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
      embedder,
      log,
      semanticLabel,
      turns,
    }))
  }
  return Object.freeze({ envelope, measurements })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArgs(process.argv.slice(2))
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
  } catch (error) {
    console.error(`SCALE_PROBE_FAILED: ${error?.message ?? error}`)
    process.exitCode = 1
  }
}
