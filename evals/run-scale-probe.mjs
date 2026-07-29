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

import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  createPalariBrain,
  ingestChatTurn,
} from '../src/index.mjs'

const SCOPE = { palariId: 'scale-palari', userId: 'scale-user' }

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

function parseArgs(argv) {
  const options = { turns: 2_500 }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--turns') {
      options.turns = Number(argv[index + 1])
      index += 1
      continue
    }
    throw new TypeError(`Unknown scale-probe flag: ${argv[index]}`)
  }
  if (!Number.isSafeInteger(options.turns) || options.turns < 50) {
    throw new TypeError('--turns must be an integer of at least 50.')
  }
  return options
}

export async function runScaleProbe({ log = console.log, turns = 2_500 } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'palari-scale-'))
  const statePath = join(root, 'state.json')
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath,
    workspaceId: 'scale',
  })

  const plantEvery = Math.floor(turns / (PLANTED.length + 1))
  const ingestStart = performance.now()
  let planted = 0
  for (let index = 0; index < turns; index += 1) {
    const isPlant = planted < PLANTED.length &&
      index === (planted + 1) * plantEvery
    const userMessage = isPlant
      ? PLANTED[planted][0]
      : FILLER[index % FILLER.length]
    if (isPlant) planted += 1
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
    latencies.sort((left, right) => left - right)
    return {
      hits,
      medianMs: latencies[Math.floor(latencies.length / 2)],
      total: PLANTED.length,
    }
  }

  const shared = recallRate(1)
  const zero = recallRate(2)
  const files = (await import('node:fs')).readdirSync(root)
  let dbBytes = 0
  for (const name of files) {
    dbBytes += (await stat(join(root, name))).size
  }

  const summary = {
    dbMb: Number((dbBytes / 1e6).toFixed(2)),
    ingestMsPerTurn: Number((ingestMs / turns).toFixed(2)),
    messages: turns * 2,
    sharedTokenRecall: `${shared.hits}/${shared.total}`,
    sharedMedianMs: Number(shared.medianMs.toFixed(1)),
    turns,
    zeroOverlapRecall: `${zero.hits}/${zero.total}`,
    zeroMedianMs: Number(zero.medianMs.toFixed(1)),
  }
  log(`scale probe — ${summary.messages} messages (${turns} turns)`)
  log(`  ingest: ${summary.ingestMsPerTurn} ms/turn, db ${summary.dbMb} MB`)
  log(`  shared-token paraphrase recall: ${summary.sharedTokenRecall} ` +
    `(median find ${summary.sharedMedianMs} ms)`)
  log(`  zero-overlap paraphrase recall: ${summary.zeroOverlapRecall} ` +
    `(median find ${summary.zeroMedianMs} ms) — the lexical boundary; ` +
    `the semantic finding aid exists to close this`)

  brain.close()
  await rm(root, { force: true, recursive: true })
  return summary
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await runScaleProbe(parseArgs(process.argv.slice(2)))
  } catch (error) {
    console.error(`SCALE_PROBE_FAILED: ${error?.message ?? error}`)
    process.exitCode = 1
  }
}
