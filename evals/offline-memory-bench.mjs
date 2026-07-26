// Offline memory bench — the memory test you can actually run.
//
// This replays a long conversation through the real product write path with
// a deterministic, provider-free reducer. It costs nothing, needs no
// credentials, and creates no live identity.
//
// What it measures: whether the incremental digest SURVIVES a long
// conversation. Does the reduction queue stall? Does the digest hit its item
// or character cap and start rejecting? Does compaction stay inside the
// lineage limit? For the real LongMemEval population it also measures
// whether evidence from the answer-bearing turns is still in the digest at
// the end — the question the whole architecture rides on.
//
// What it does NOT measure: answer quality. There is no model here. A real
// reducer makes better topic and statement choices than this one. Treat the
// retention number as a structural floor, not a score, and never publish it
// as a benchmark result.

import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { renderActiveMemoryDigest } from '../src/memory-reducer.mjs'
import {
  ACTIVE_MEMORY_MAX_ACTIONS,
  ACTIVE_MEMORY_MAX_BASIS,
  ACTIVE_MEMORY_MAX_DIGEST_CHARS,
  ACTIVE_MEMORY_MAX_ITEMS,
  ACTIVE_MEMORY_MAX_QUOTE_CHARS,
  ACTIVE_MEMORY_MAX_STATEMENT_CHARS,
  ACTIVE_MEMORY_MAX_TOPIC_CHARS,
  createPalariBrain,
  ingestChatTurn,
  recallMemory,
  reducePendingTurns,
} from '../src/index.mjs'

export const OFFLINE_BENCH_REDUCER_ID = 'offline-memory-bench/v1'

// Leave room to compact before the cap rather than discovering it by
// failing a reduction.
const COMPACTION_HEADROOM_ITEMS = 4
// Each summarize carries its targets' full evidence lineage, and that
// lineage is capped. Compacting too many at once fails REDUCER_BASIS_CAPACITY.
const MAX_SUMMARIZE_TARGETS = 4
// Opening estimate for one rendered item before any exist to measure. An
// item costs roughly this much even with a single short support, because
// each support repeats a 73-character evidence ID, a source message ID, an
// observation time, and a speaker label.
const ESTIMATED_ITEM_CHARS = 700
// A real reducer writes a compact summary, not a transcription. The
// contract permits 500-character statements and quotes, but spending the
// maximum on every item exhausts the 24,000-character digest in ~16 items.
// These budgets model a disciplined reducer.
const BENCH_STATEMENT_CHARS = 140
const BENCH_QUOTE_CHARS = 160

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function exactQuote(text) {
  const source = String(text ?? '')
  // A prefix slice is always an exact contiguous substring. Trim only the
  // right side so the result stays a genuine substring of the original.
  const sliced = source.slice(0, BENCH_QUOTE_CHARS).trimEnd()
  return sliced || source.slice(0, BENCH_QUOTE_CHARS)
}

// Deterministic topic bucket. Real reducers pick topics semantically; this
// approximates the property that matters for capacity — that a long
// conversation revisits subjects, so supersession gets exercised.
export function benchTopic(text) {
  const words = String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word.length > 3)
    .slice(0, 3)
  const topic = words.join(' ').slice(0, ACTIVE_MEMORY_MAX_TOPIC_CHARS)
  return topic || 'general'
}

function benchStatement(speaker, text) {
  const subject = speaker === 'user' ? 'The user' : 'Palari'
  const body = String(text ?? '').replace(/\s+/gu, ' ').trim()
  const statement = `${subject}: ${body}`
  return statement.slice(0, BENCH_STATEMENT_CHARS)
}

function addAction(evidence, topic) {
  return {
    basis: [{
      id: evidence.id,
      kind: 'evidence',
      quote: exactQuote(evidence.text),
    }],
    epistemic: 'asserted',
    op: 'add',
    relation: null,
    statement: benchStatement(evidence.speaker, evidence.text),
    targetIds: [],
    timeBasis: null,
    topic,
  }
}

function supersedeAction(evidence, target) {
  return {
    basis: [
      {
        id: evidence.id,
        kind: 'evidence',
        quote: exactQuote(evidence.text),
      },
      { id: target.id, kind: 'memory', quote: '' },
    ],
    epistemic: 'asserted',
    op: 'replace',
    relation: 'supersedes',
    statement: benchStatement(evidence.speaker, evidence.text),
    targetIds: [target.id],
    timeBasis: null,
    // Must resolve to the target's topic. Normalized comparison means
    // formatting need not match, but the subject must.
    topic: target.topic,
  }
}

function summarizeAction(evidence, targets) {
  return {
    basis: [
      {
        id: evidence.id,
        kind: 'evidence',
        quote: exactQuote(evidence.text),
      },
      ...targets.map((target) => ({
        id: target.id,
        kind: 'memory',
        quote: '',
      })),
    ],
    epistemic: 'asserted',
    op: 'replace',
    relation: 'summarizes',
    statement: `${
      evidence.speaker === 'user' ? 'The user' : 'Palari'
    } covered: ${
      targets.map((target) => target.topic).join('; ')
    }`.slice(0, BENCH_STATEMENT_CHARS),
    targetIds: targets.map((target) => target.id),
    timeBasis: null,
    topic: `consolidated: ${
      targets.map((target) => target.topic).join('; ')
    }`.slice(0, ACTIVE_MEMORY_MAX_TOPIC_CHARS),
  }
}

function sameSpeakerPrior(prior, speaker) {
  return prior.filter((item) => item.speaker === speaker)
}

// One provider-free reduction step. Same contract a live reducer must
// satisfy: exact quotes, one disposition per evidence item, speaker purity,
// at most 8 actions.
export function offlineBenchReducer({ request }) {
  const { evidence, prior, utilization } = request.input
  const actions = []
  const used = new Set()
  const projected = [...prior]

  // The binding constraint is characters, not items. A reducer cannot see
  // support lineage in `prior`, but it can derive the mean rendered cost of
  // an item from the utilization counters and budget against that.
  const meanItemChars = utilization.items > 0
    ? Math.ceil(utilization.digestChars / utilization.items)
    : ESTIMATED_ITEM_CHARS
  const charBudgetItems = Math.floor(
    utilization.digestCharsRemaining / Math.max(meanItemChars, 1),
  )

  // Consolidate the batch before proposing anything. One reduction may carry
  // at most 8 actions no matter how many interactions it covers, so a
  // batched reducer must summarise a span of dialogue into a few facts
  // rather than emit one memory per message. That consolidation is the point
  // of batching, not a workaround for the limit.
  const groups = new Map()
  for (const item of evidence) {
    const topic = benchTopic(item.text)
    const key = `${item.speaker}\u0000${topic.trim().toLowerCase()}`
    if (!groups.has(key)) {
      groups.set(key, { items: [], speaker: item.speaker, topic })
    }
    // Newest evidence last: the group's statement describes its latest state.
    groups.get(key).items.push(item)
  }

  for (const group of groups.values()) {
    if (actions.length >= ACTIVE_MEMORY_MAX_ACTIONS) break
    const latest = group.items.at(-1)
    const mine = sameSpeakerPrior(projected, group.speaker)
    const existing = mine.find((candidate) =>
      candidate.topic.trim().toLowerCase() ===
        group.topic.trim().toLowerCase())

    if (existing) {
      actions.push(supersedeAction(latest, existing))
      used.add(latest.id)
      continue
    }

    const itemsRemaining = ACTIVE_MEMORY_MAX_ITEMS - projected.length
    const roomToGrow = itemsRemaining > COMPACTION_HEADROOM_ITEMS &&
      charBudgetItems > actions.length + 1

    if (!roomToGrow) {
      if (mine.length >= MAX_SUMMARIZE_TARGETS) {
        const targets = mine.slice(0, MAX_SUMMARIZE_TARGETS)
        actions.push(summarizeAction(latest, targets))
        used.add(latest.id)
        for (const target of targets) {
          const index = projected.indexOf(target)
          if (index >= 0) projected.splice(index, 1)
        }
        projected.push({
          id: `projected-${projected.length}`,
          speaker: group.speaker,
          topic: group.topic,
        })
        continue
      }
      // Nothing safe to do for this group. Record no memory rather than
      // propose an action that fails the whole reduction. Canonical evidence
      // is unaffected either way.
      continue
    }

    actions.push(addAction(latest, group.topic))
    used.add(latest.id)
    projected.push({
      id: `projected-${projected.length}`,
      speaker: group.speaker,
      topic: group.topic,
    })
  }

  return {
    actions,
    baseRevision: request.input.baseRevision,
    dispositions: evidence.map((item) => ({
      evidenceId: item.id,
      outcome: used.has(item.id) ? 'used' : 'no_memory',
    })),
  }
}

// Deterministic stand-in population so the bench always runs, dataset or
// not. Shaped like LongMemEval: many short sessions, recurring subjects,
// one late fact the final question depends on.
export function syntheticPopulation({ interactions = 240 } = {}) {
  const subjects = [
    'weekend hiking plans', 'coffee brewing method', 'apartment lease terms',
    'physiotherapy appointments', 'sourdough starter care', 'commute route',
    'guitar practice routine', 'travel vaccination records',
  ]
  const exchanges = []
  for (let index = 0; index < interactions; index += 1) {
    const subject = subjects[index % subjects.length]
    const day = String((index % 27) + 1).padStart(2, '0')
    const month = String((Math.floor(index / 27) % 12) + 1).padStart(2, '0')
    exchanges.push({
      assistantMessage:
        `Noted about ${subject}. I have recorded revision ${index} of that.`,
      eventAt: `2025-${month}-${day}T${
        String(index % 24).padStart(2, '0')
      }:00:00.000Z`,
      hasAnswer: index === interactions - 12,
      representedTurns: 2,
      sourceMessageId: `synthetic:${index}`,
      userMessage: index === interactions - 12
        ? 'Important: my emergency locker code is 7731 and it is on level B2.'
        : `About my ${subject}: revision ${index} is what matters now.`,
    })
  }
  return {
    answer: '7731',
    exchanges,
    label: 'synthetic-long-conversation',
    question: 'What is my emergency locker code?',
    questionId: 'synthetic-0001',
  }
}

function retentionReport(population, memories) {
  const answerBearing = population.exchanges.filter(
    (exchange) => exchange.hasAnswer,
  )
  if (!answerBearing.length) {
    return { checked: 0, retained: 0, retainedIds: [] }
  }
  const retainedIds = []
  for (const exchange of answerBearing) {
    const needle = exchange.userMessage.trim()
    const hit = memories.some((memory) =>
      memory.supports.some((support) =>
        needle.includes(support.quote) || support.quote.includes(needle)))
    if (hit) retainedIds.push(exchange.sourceMessageId)
  }
  return {
    checked: answerBearing.length,
    retained: retainedIds.length,
    retainedIds,
  }
}

export async function runOfflineMemoryBench({
  interactionLimit = Number.POSITIVE_INFINITY,
  onProgress,
  population,
  reduceEvery = 1,
  workspaceDir,
} = {}) {
  const scope = { palariId: 'offline-bench', userId: 'offline-bench-user' }
  const root = workspaceDir ??
    await mkdtemp(join(tmpdir(), 'palari-offline-bench-'))
  const owned = !workspaceDir
  const brain = await createPalariBrain({
    memoryEnabled: true,
    statePath: join(root, 'workspace-state.json'),
    workspaceId: 'offline-memory-bench',
  })

  const failures = new Map()
  let applied = 0
  let processed = 0
  let canonicalChars = 0
  // The number that actually drives ingestion cost: one provider request per
  // reducer invocation, regardless of how many interactions it covers.
  let reducerCalls = 0

  try {
    const planned = population.exchanges.slice(
      0,
      Number.isFinite(interactionLimit)
        ? interactionLimit
        : population.exchanges.length,
    )
    for (const exchange of planned) {
      const result = await ingestChatTurn(brain, {
        assistantMessage: exchange.assistantMessage,
        eventAt: exchange.eventAt,
        palariId: scope.palariId,
        retention: 'durable',
        sourceMessageId: exchange.sourceMessageId,
        userId: scope.userId,
        userMessage: exchange.userMessage,
      }, {
        reduceEvery,
        reducer(payload) {
          reducerCalls += 1
          return offlineBenchReducer(payload)
        },
        reducerId: OFFLINE_BENCH_REDUCER_ID,
      })
      processed += 1
      canonicalChars +=
        exchange.userMessage.length + exchange.assistantMessage.length
      applied += Number(result.reductionApplied ?? 0)
      if (result.reductionStatus === 'failed') {
        const category = String(result.reduction?.errorCategory ?? 'unknown')
        failures.set(category, (failures.get(category) ?? 0) + 1)
      }
      onProgress?.({
        blocked: Number(result.reductionBlocked ?? 0),
        processed,
        total: planned.length,
      })
    }

    // A cadence above 1 leaves a tail of deferred interactions. Drain it so
    // the reported digest reflects the whole population.
    if (reduceEvery > 1) {
      await reducePendingTurns(brain, {
        ...scope,
        maxTurns: 10_000,
        reducer(payload) {
          reducerCalls += 1
          return offlineBenchReducer(payload)
        },
        reducerId: OFFLINE_BENCH_REDUCER_ID,
      })
    }

    const status = brain.digestStatus(scope)
    const memories = brain.listActiveMemories(scope)
    const briefing = recallMemory(brain, scope, { maxChars: 100_000 })
    const blockedUnits = brain.listBlockedReductions(scope)

    return {
      blocked: blockedUnits.map((unit) => ({
        category: unit.blockedCategory,
        unitOrder: unit.unitOrder,
      })),
      briefingChars: briefing.requiredChars,
      briefingMode: briefing.briefingMode,
      briefingStatus: briefing.status,
      canonicalChars,
      canonicalRows: status.canonicalRows,
      // Measured from the digest itself. `briefing.requiredChars` describes
      // whatever recall actually returned, which is the canonical journal
      // when the digest is not ready — a very different number.
      digestChars: renderActiveMemoryDigest(memories).text.length,
      digestItems: memories.length,
      maxSupportsPerItem: memories.reduce(
        (maximum, memory) => Math.max(maximum, memory.supports.length),
        0,
      ),
      digestReady: status.ready,
      digestStatus: status.status,
      failures: Object.fromEntries([...failures].sort()),
      pending: status.pending,
      population: population.label,
      populationSha256: sha256(JSON.stringify(
        population.exchanges.map((exchange) => exchange.sourceMessageId),
      )),
      processed,
      questionId: population.questionId,
      reduceEvery,
      reducerCalls,
      reductionsApplied: applied,
      retention: retentionReport(population, memories),
    }
  } finally {
    brain.close()
    if (owned) await rm(root, { force: true, recursive: true })
  }
}

export function formatOfflineBenchReport(result) {
  const ratio = result.digestChars > 0
    ? (result.canonicalChars / result.digestChars).toFixed(1)
    : 'n/a'
  const lines = [
    `population        ${result.population} (${result.questionId})`,
    `interactions      ${result.processed}`,
    `canonical rows    ${result.canonicalRows}`,
    `reductions        ${result.reductionsApplied} applied, ` +
      `${result.pending} still actionable`,
    `provider calls    ${result.reducerCalls} reducer requests ` +
      `(cadence: reduce every ${result.reduceEvery} interaction(s))`,
    `quarantined       ${result.blocked.length}`,
    `digest            ${result.digestItems}/${ACTIVE_MEMORY_MAX_ITEMS} items, ` +
      `${result.digestChars}/${ACTIVE_MEMORY_MAX_DIGEST_CHARS} chars, ` +
      `max ${result.maxSupportsPerItem}/${ACTIVE_MEMORY_MAX_BASIS} supports ` +
      'on one item',
    `compression       ${result.canonicalChars} canonical chars -> ` +
      `${result.digestChars} digest chars (${ratio}x)`,
    `digest status     ${result.digestStatus} (ready=${result.digestReady})`,
    `recall            ${result.briefingStatus} via ${result.briefingMode} ` +
      `(${result.briefingChars} chars)`,
  ]
  if (result.retention.checked > 0) {
    lines.push(
      `answer evidence   ${result.retention.retained}/` +
      `${result.retention.checked} answer-bearing interactions still ` +
      'supported in the digest',
    )
  }
  if (Object.keys(result.failures).length) {
    lines.push('reduction failures:')
    for (const [category, count] of Object.entries(result.failures)) {
      lines.push(`  ${category}: ${count}`)
    }
  }
  if (result.blocked.length) {
    const byCategory = new Map()
    for (const unit of result.blocked) {
      byCategory.set(unit.category, (byCategory.get(unit.category) ?? 0) + 1)
    }
    lines.push('quarantined units:')
    for (const [category, count] of [...byCategory].sort()) {
      lines.push(`  ${category}: ${count}`)
    }
  }
  lines.push(
    `lineage limit     ${ACTIVE_MEMORY_MAX_BASIS} supports per item`,
  )
  return lines.join('\n')
}
