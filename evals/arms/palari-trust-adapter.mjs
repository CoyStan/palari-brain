// Palari's adapter for the five-case trust benchmark.
//
// The reducer here is a scripted cooperative stand-in for the live model,
// governed by two generic rules only — no per-case knowledge:
//
//   - every user statement becomes one digest item, quoted verbatim;
//   - if a prior item shares the derived topic, supersede it; otherwise add.
//
// That deliberately caps the stand-in's cleverness at "ordinary". The cases
// this benchmark exists for — deletion, source boundary, isolation — are
// host-enforced walls that no reducer, cooperative or malicious, is able to
// breach; the correction case is scored on host chronology, not on the
// stand-in guessing that two sentences share a topic.
//
// `retrieve` exposes every surface an answering model would see, because
// hiding one is cheating: ready digest items, ranked journal search, and
// the full text of every search hit.

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  createPalariBrain,
  forgetMemories,
  ingestChatTurn,
} from '../../src/index.mjs'
import { extractMemoryQueryKeywords } from '../../src/memory-store.mjs'

const PALARI_ID = 'palari-trust-bench'
const USERS = Object.freeze({ A: 'trust-user-a', B: 'trust-user-b' })

function derivedTopic(text) {
  const keywords = extractMemoryQueryKeywords(text, { limit: 2 })
  return keywords.join(' ') || 'general'
}

function scriptedReducer({ request }) {
  const priorByTopic = new Map(request.input.prior.map((item) => [
    item.topic,
    item,
  ]))
  const actions = []
  const used = new Set()
  for (const evidence of request.input.evidence) {
    if (evidence.speaker !== 'user') continue
    const topic = derivedTopic(evidence.text)
    const prior = priorByTopic.get(topic)
    used.add(evidence.id)
    actions.push({
      basis: [
        { id: evidence.id, kind: 'evidence', quote: evidence.text.slice(0, 500) },
        ...(prior ? [{ id: prior.id, kind: 'memory', quote: '' }] : []),
      ],
      epistemic: 'asserted',
      op: prior ? 'replace' : 'add',
      relation: prior ? 'supersedes' : null,
      statement: evidence.text.slice(0, 500),
      targetIds: prior ? [prior.id] : [],
      timeBasis: null,
      topic,
    })
    if (prior) priorByTopic.delete(topic)
  }
  return {
    actions,
    baseRevision: request.input.baseRevision,
    dispositions: request.input.evidence.map((item) => ({
      evidenceId: item.id,
      outcome: used.has(item.id) ? 'used' : 'no_memory',
    })),
  }
}

export function createPalariTrustAdapter() {
  return {
    name: 'palari-brain',

    async open() {
      const root = await mkdtemp(join(tmpdir(), 'palari-trust-'))
      const brain = await createPalariBrain({
        memoryEnabled: true,
        statePath: join(root, 'workspace-state.json'),
        workspaceId: 'trust-benchmark',
      })
      return { brain, root }
    },

    async ingest(session, { eventAt, scope, turn }) {
      await ingestChatTurn(session.brain, {
        assistantMessage: turn.assistant ?? 'Noted.',
        eventAt,
        palariId: PALARI_ID,
        retention: 'durable',
        sourceMessageId: turn.id,
        ...(turn.sourceTexts ? { sourceTexts: turn.sourceTexts } : {}),
        userId: USERS[scope],
        userMessage: turn.user ?? '',
      }, { reducer: scriptedReducer, reducerId: 'trust-bench-scripted/v1' })
    },

    async forget(session, { containing, scope }) {
      const scoped = { palariId: PALARI_ID, userId: USERS[scope] }
      const found = session.brain.exploreFind(scoped, {
        limit: 200,
        phrase: containing,
      })
      const ids = found.matches.map((match) => match.evidenceId)
      if (ids.length) await forgetMemories(session.brain, ids, scoped)
    },

    async retrieve(session, { question, scope }) {
      const scoped = { palariId: PALARI_ID, userId: USERS[scope] }
      const items = []

      const digest = session.brain.digestStatus(scoped)
      if (digest?.ready) {
        for (const memory of session.brain.listActiveMemories(scoped)) {
          items.push({
            observedAt: memory.observedAt ?? null,
            origin: 'memory',
            speaker: memory.speaker ?? null,
            superseded: false,
            text: `${memory.statement}`,
          })
        }
      }

      const found = session.brain.exploreFind(scoped, {
        phrase: question,
        ranked: true,
      })
      const ids = found.matches.map((match) => match.evidenceId)
      if (ids.length) {
        const read = session.brain.exploreRead(scoped, { evidenceIds: ids })
        for (const row of read.messages) {
          items.push({
            observedAt: row.observedAt,
            origin: 'journal',
            speaker: row.speaker,
            superseded: false,
            text: row.text,
          })
        }
      }
      return items
    },

    async close(session) {
      session.brain.close()
      await rm(session.root, { force: true, recursive: true })
    },
  }
}
