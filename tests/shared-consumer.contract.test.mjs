import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  answerWithRetrieval,
  createPalariBrain,
  forgetWithReport,
  ingestChatTurn,
  recallMemory,
} from '../src/index.mjs'
import { createPalariMemoryStore } from '../src/memory-store.mjs'
import { createKernelStore } from '../src/store.mjs'

const SHARED_SCOPE = Object.freeze({
  palariId: 'palari-shared',
  userId: 'shared-journal',
})
const OTHER_SCOPE = Object.freeze({
  palariId: 'palari-shared',
  userId: 'other-journal',
})
const FIXED_NOW = '2026-08-01T00:00:00.000Z'

async function openBrain(t, label, options = {}) {
  const root = await mkdtemp(join(tmpdir(), `palari-shared-${label}-`))
  const brain = await createPalariBrain({
    clock: () => new Date(FIXED_NOW),
    memoryEnabled: true,
    statePath: join(root, 'state.json'),
    workspaceId: label,
    ...options,
  })
  t.after(async () => {
    brain.close()
    await rm(root, { force: true, recursive: true })
  })
  return brain
}

function turn({
  assistantMessage = '',
  authorId,
  eventAt = FIXED_NOW,
  id,
  scope = SHARED_SCOPE,
  userMessage,
}) {
  return {
    assistantMessage,
    ...(authorId === undefined ? {} : { authorId }),
    eventAt,
    palariId: scope.palariId,
    retention: 'durable',
    sourceMessageId: id,
    userId: scope.userId,
    userMessage,
  }
}

async function flatEmbed(texts) {
  return texts.map(() => [1, 0, 0])
}

async function attributedGraphExtractor({ evidence }) {
  assert.ok(evidence.every((row) => !Object.hasOwn(row, 'authorId')))
  return {
    assertions: evidence.map((row) => ({
      evidenceRef: row.ref,
      object: row.text.includes('indigo') ? 'shelf seven' : 'shelf nine',
      predicate: 'keeps notebook on',
      quote: row.text,
      subject: row.text.includes('Alice') ? 'Alice' : 'Bob',
    })),
  }
}

test('omitting authorId preserves the prior observable row shape',
  async (t) => {
    const omitted = await openBrain(t, 'author-omitted')
    const explicit = await openBrain(t, 'author-undefined')
    const input = turn({
      assistantMessage: 'Recorded.',
      id: 'compat:0',
      userMessage: 'The compatibility row keeps its old bytes.',
    })

    await ingestChatTurn(omitted, input)
    await ingestChatTurn(explicit, { ...input, authorId: undefined })

    const omittedRows = omitted.listStatements(SHARED_SCOPE)
    const explicitRows = explicit.listStatements(SHARED_SCOPE)
    assert.deepEqual(explicitRows, omittedRows)
    assert.ok(omittedRows.every((row) => !Object.hasOwn(row, 'author_id')))
    assert.ok(omitted.exploreRead(SHARED_SCOPE, { session: 'compat' })
      .messages.every((row) => !Object.hasOwn(row, 'authorId')))
    assert.ok(recallMemory(omitted, SHARED_SCOPE).included
      .every((row) => !Object.hasOwn(row, 'authorId')))
  })

test('an existing canonical journal gains nullable attribution additively',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-author-migration-'))
    const store = await createPalariMemoryStore({
      memoryEnabled: true,
      statePath: join(root, 'state.json'),
      workspaceId: 'author-migration',
    })
    store.db.exec(`
      CREATE TABLE dialogue_evidence (
        id TEXT PRIMARY KEY,
        turn_id TEXT,
        palari_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        source_message_id TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        content TEXT NOT NULL,
        content_sha256 TEXT NOT NULL,
        event_at TEXT NOT NULL,
        dialogue_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        evidence_kind TEXT NOT NULL
      )
    `)
    store.db.prepare(`
      INSERT INTO dialogue_evidence (
        id, turn_id, palari_id, user_id, source_message_id, source_kind,
        content, content_sha256, event_at, dialogue_order, created_at,
        evidence_kind
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'pre-attribution-row',
      SHARED_SCOPE.palariId,
      SHARED_SCOPE.userId,
      'migration:0:user',
      'user_message',
      'This row predates author attribution.',
      'preexisting-content-hash',
      FIXED_NOW,
      0,
      FIXED_NOW,
      'canonical_message',
    )

    const brain = await createPalariBrain({
      clock: () => new Date(FIXED_NOW),
      store,
    })
    t.after(async () => {
      brain.close()
      await rm(root, { force: true, recursive: true })
    })

    assert.ok(store.db.prepare('PRAGMA table_info(dialogue_evidence)').all()
      .some((column) => column.name === 'author_id' && column.notnull === 0))
    const [row] = brain.listStatements(SHARED_SCOPE)
    assert.equal(row.id, 'pre-attribution-row')
    assert.equal(row.content, 'This row predates author attribution.')
    assert.equal(Object.hasOwn(row, 'author_id'), false)
  })

test('one shared scope preserves two host-stamped authors on every read surface',
  async (t) => {
    const brain = await openBrain(t, 'two-authors', {
      embedder: flatEmbed,
      graphExtractor: attributedGraphExtractor,
    })
    await ingestChatTurn(brain, turn({
      authorId: 'member-alice',
      id: 'alice-session:0',
      userMessage: 'Alice keeps the indigo notebook on shelf seven.',
    }))
    await ingestChatTurn(brain, turn({
      authorId: 'member-bob',
      eventAt: '2026-08-01T00:01:00.000Z',
      id: 'bob-session:0',
      userMessage: 'Bob keeps the copper notebook on shelf nine.',
    }))
    await ingestChatTurn(brain, turn({
      authorId: 'member-eve',
      id: 'other-session:0',
      scope: OTHER_SCOPE,
      userMessage: 'Eve keeps the silver notebook outside this journal.',
    }))

    const rows = brain.listStatements(SHARED_SCOPE)
    assert.deepEqual(rows.map((row) => row.author_id), [
      'member-alice',
      'member-bob',
    ])

    const found = brain.exploreFind(SHARED_SCOPE, { phrase: 'notebook' })
    assert.deepEqual(found.matches.map((row) => row.authorId), [
      'member-alice',
      'member-bob',
    ])
    assert.equal(JSON.stringify(found).includes('member-eve'), false)

    const read = brain.exploreRead(SHARED_SCOPE, {
      evidenceIds: found.matches.map((row) => row.evidenceId),
    })
    assert.deepEqual(read.messages.map((row) => [row.speaker, row.authorId]), [
      ['user', 'member-alice'],
      ['user', 'member-bob'],
    ])

    const timeline = brain.exploreTimeline(SHARED_SCOPE)
    assert.deepEqual(
      timeline.sessions.flatMap((session) => session.participants ?? [])
        .map(({ authorId, speaker }) => [speaker, authorId]),
      [
        ['user', 'member-alice'],
        ['user', 'member-bob'],
      ],
    )

    const semantic = await brain.exploreSemantic(SHARED_SCOPE, {
      limit: 10,
      phrase: 'where are the journals',
    })
    assert.deepEqual(
      new Set(semantic.map((row) => row.authorId)),
      new Set(['member-alice', 'member-bob']),
    )

    const briefing = recallMemory(brain, SHARED_SCOPE)
    assert.deepEqual(briefing.included.map((row) => row.authorId), [
      'member-alice',
      'member-bob',
    ])

    const indexed = await brain.indexGraph(SHARED_SCOPE)
    assert.equal(indexed, 2)
    const graph = brain.exploreGraph(SHARED_SCOPE, { entity: 'Alice' })
    assert.equal(graph.edges[0].speaker, 'user')
    assert.equal(graph.edges[0].authorId, 'member-alice')

    let search
    await answerWithRetrieval(brain, {
      ...SHARED_SCOPE,
      async provider({ retrieve }) {
        search = await retrieve({
          input: { limit: 10, phrase: 'notebook locations' },
          tool: 'memory_search',
        })
        return { text: 'done' }
      },
      question: 'Where are the notebooks?',
    })
    assert.deepEqual(
      new Set(search.matches.map((row) => row.authorId)),
      new Set(['member-alice', 'member-bob']),
    )

    assert.deepEqual(
      brain.exploreRead(OTHER_SCOPE, {
        evidenceIds: found.matches.map((row) => row.evidenceId),
      }).messages,
      [],
    )
  })

test('author attribution is immutable host provenance, not model output',
  async (t) => {
    const brain = await openBrain(t, 'author-boundary')
    const result = await ingestChatTurn(brain, turn({
      authorId: 'trusted-member',
      id: 'boundary:0',
      userMessage: 'I prefer the blue conference room.',
    }), {
      extractor({ request, turn: extractorTurn }) {
        assert.equal(JSON.stringify(request).includes('trusted-member'), false)
        assert.equal(Object.hasOwn(extractorTurn, 'authorId'), false)
        return {
          memories: [{
            authorId: 'forged-member',
            confidence: 1,
            fictional: false,
            importance: 1,
            quote: 'I prefer the blue conference room.',
            type: 'preference',
          }],
        }
      },
      extractorId: 'forging-extractor/v1',
      reducer({ request }) {
        assert.equal(JSON.stringify(request).includes('trusted-member'), false)
        return {
          actions: [{
            authorId: 'forged-member',
            basis: [{
              id: request.input.evidence[0].id,
              kind: 'evidence',
              quote: request.input.evidence[0].text,
            }],
            epistemic: 'asserted',
            op: 'add',
            relation: 'adds',
            speaker: 'user',
            statement: 'The user prefers the blue conference room.',
            targetIds: [],
            topic: 'conference room preference',
          }],
          baseRevision: request.input.baseRevision,
          dispositions: request.input.evidence.map(({ id }) => ({
            evidenceId: id,
            outcome: 'used',
          })),
        }
      },
      reducerId: 'forging-reducer/v1',
    })

    assert.equal(result.indexStatus, 'failed')
    assert.equal(result.indexReason, 'invalid_payload')
    assert.equal(result.reductionStatus, 'failed')
    assert.deepEqual(
      brain.exploreRead(SHARED_SCOPE, { session: 'boundary' })
        .messages.map(({ authorId }) => authorId),
      ['trusted-member'],
    )

    await assert.rejects(
      ingestChatTurn(brain, turn({
        authorId: 'different-member',
        id: 'boundary:0',
        userMessage: 'I prefer the blue conference room.',
      })),
      (error) => error?.code === 'SOURCE_MESSAGE_CONFLICT',
    )
    assert.equal(brain.listStatements(SHARED_SCOPE)[0].author_id,
      'trusted-member')
  })

test('shared-scope forget reports surviving authors without applying policy',
  async (t) => {
    const brain = await openBrain(t, 'forget-authors')
    await ingestChatTurn(brain, turn({
      authorId: 'member-alice',
      id: 'delete-session:0',
      userMessage:
        'Erase cobalt-only; its shared residue marker is willowarchive.',
    }))
    await ingestChatTurn(brain, turn({
      authorId: 'member-bob',
      eventAt: '2026-08-01T00:01:00.000Z',
      id: 'keep-session:0',
      userMessage: 'Keep willowarchive in the shared history.',
    }))

    const report = forgetWithReport(brain, SHARED_SCOPE, {
      phrase: 'cobalt-only',
    })
    assert.equal(report.deletedCount, 1)
    assert.ok(report.residual.some((row) =>
      row.authorId === 'member-bob' && row.speaker === 'user'))
  })

test('WAL plus bounded busy waiting protects concurrent same-scope ingests',
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'palari-concurrent-'))
    const options = {
      clock: () => new Date(FIXED_NOW),
      memoryEnabled: true,
      statePath: join(root, 'state.json'),
      workspaceId: 'concurrent',
    }
    const first = await createPalariBrain(options)
    const second = await createPalariBrain(options)
    t.after(async () => {
      first.close()
      second.close()
      await rm(root, { force: true, recursive: true })
    })

    const outcomes = await Promise.all([
      ingestChatTurn(first, turn({
        authorId: 'member-alice',
        id: 'concurrent:0',
        userMessage: 'Alice wrote concurrently.',
      })),
      ingestChatTurn(second, turn({
        authorId: 'member-bob',
        id: 'concurrent:1',
        userMessage: 'Bob wrote concurrently.',
      })),
      Promise.resolve().then(() => first.exploreTimeline(SHARED_SCOPE)),
    ])
    assert.equal(outcomes[0].evidenceWritten, 1)
    assert.equal(outcomes[1].evidenceWritten, 1)
    assert.deepEqual(
      first.listStatements(SHARED_SCOPE).map((row) => row.author_id),
      ['member-alice', 'member-bob'],
    )

    const store = await createKernelStore(options)
    const inspectionBrain = await createPalariBrain({ store })
    t.after(() => inspectionBrain.close())
    assert.equal(store.db.prepare('PRAGMA journal_mode').get().journal_mode,
      'wal')
    assert.equal(store.db.prepare('PRAGMA busy_timeout').get().timeout, 5_000)

    const conflicting = await Promise.allSettled([
      ingestChatTurn(first, turn({
        authorId: 'member-alice',
        id: 'conflict:0',
        userMessage: 'The first immutable version.',
      })),
      ingestChatTurn(second, turn({
        authorId: 'member-bob',
        id: 'conflict:0',
        userMessage: 'A conflicting replacement.',
      })),
    ])
    assert.equal(conflicting.filter(({ status }) => status === 'fulfilled')
      .length, 1)
    const rejected = conflicting.find(({ status }) => status === 'rejected')
    assert.equal(rejected.reason.code, 'SOURCE_MESSAGE_CONFLICT')
    assert.equal(first.exploreRead(SHARED_SCOPE, { session: 'conflict' })
      .messages.length, 1)
  })
