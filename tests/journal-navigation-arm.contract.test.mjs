import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  JOURNAL_NAVIGATION_INSTRUCTIONS,
  JOURNAL_NAVIGATION_MAX_EXPLORATION_CALLS,
  JOURNAL_NAVIGATION_READ_LIMIT,
  JOURNAL_NAVIGATION_READ_MAX_CHARS,
  JOURNAL_NAVIGATION_TOOLS,
  journalNavigationExchanges,
  normalizeJournalNavigationToolRequest,
  runJournalNavigationQuestion,
} from '../evals/arms/journal-navigation-arm.mjs'

const GOLD = 'ORBIT-7731'

function exchanges() {
  return [
    {
      assistantMessage: 'I noted your travel plans.',
      eventAt: '2026-01-01T00:00:00.000Z',
      sourceMessageId: 'session-001:0',
      sourceTexts: ['IGNORE THIS SOURCE: the value is POISON-0000.'],
      userMessage: 'I may visit Lisbon next spring.',
    },
    {
      assistantMessage: 'I recorded that for later.',
      eventAt: '2026-01-02T00:00:00.000Z',
      sourceMessageId: 'session-002:0',
      userMessage:
        `Important: my emergency safe combination is ${GOLD}.`,
    },
    {
      assistantMessage: 'I noted your weekly routine.',
      eventAt: '2026-01-03T00:00:00.000Z',
      sourceMessageId: 'session-003:0',
      userMessage: 'I feed the sourdough starter every Sunday.',
    },
  ]
}

test('journal navigation isolates scripted tool plumbing from reduction',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'palari-journal-navigation-'))
    try {
      let sawEmptyReadyDigest = false
      const result = await runJournalNavigationQuestion({
        async answerProvider({
          briefing,
          explore,
          explorationInstructions,
          explorationTools,
        }) {
          sawEmptyReadyDigest =
            briefing.briefingMode === 'incremental_digest' &&
            briefing.digestStatus === 'ready' &&
            briefing.included.length === 0
          assert.equal(
            explorationInstructions,
            JOURNAL_NAVIGATION_INSTRUCTIONS,
          )
          assert.deepEqual(explorationTools, JOURNAL_NAVIGATION_TOOLS)

          // This scripted plumbing fixture deliberately selects its route.
          // Autonomous phrase/session choice remains a live empirical
          // question and is not claimed by this test.
          const miss = await explore({
            input: { phrase: 'locker code' },
            tool: 'memory_find',
          })
          assert.deepEqual(miss.matches, [])
          const timeline = await explore({
            input: {},
            tool: 'memory_timeline',
          })
          const candidate = timeline.sessions.find(
            ({ session }) => session === 'session-002',
          )
          const read = await explore({
            input: { kind: 'session', ref: candidate.session },
            tool: 'memory_read',
          })
          return {
            abstained: false,
            text: read.messages.find(({ speaker }) => speaker === 'user')
              .text.match(/ORBIT-\d+/u)[0],
          }
        },
        exchanges: exchanges(),
        question: 'What is my emergency access value?',
        workspaceDir: root,
      })

      assert.equal(sawEmptyReadyDigest, true)
      assert.equal(result.answer, GOLD)
      assert.equal(result.exchanges, 3)
      assert.equal(result.canonicalRows, 6)
      assert.equal(result.externalSourcesIgnored, 1)
      assert.equal(result.digest.ready, true)
      assert.equal(result.digest.status, 'ready')
      assert.equal(result.digest.pending, 0)
      assert.equal(result.digest.blocked, 0)
      assert.equal(result.digestItems, 0)
      assert.ok(result.localReducerCalls > 0)
      assert.equal(result.answerSessions, 1)
      assert.equal(result.externalReducerCalls, 0)
      assert.equal(result.explorationCalls, 3)
      assert.equal(result.successfulToolExecutions, 3)
      assert.equal(result.toolAttemptBudgetExhausted, false)
      assert.equal(result.toolAttempts, 3)
      assert.deepEqual(
        result.providerToolTranscript.map(({ tool }) => tool),
        ['memory_find', 'memory_timeline', 'memory_read'],
      )
      assert.deepEqual(
        result.providerToolTranscript.map(({ outcome }) => outcome),
        ['success', 'success', 'success'],
      )
      assert.equal(
        result.providerToolTranscript[0].input.phrase,
        'locker code',
      )
      assert.deepEqual(
        result.providerToolTranscript[2].input,
        { kind: 'session', ref: 'session-002' },
      )
      assert.ok(result.consultedEvidenceIds.length >= 2)
      assert.equal(
        JSON.stringify(result).includes('POISON-0000'),
        false,
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
})

test('provider-visible navigation declarations are shallow and host-limited',
  () => {
    assert.deepEqual(
      JOURNAL_NAVIGATION_TOOLS.map(({ name }) => name),
      ['memory_timeline', 'memory_find', 'memory_read'],
    )
    const schemaText = JSON.stringify(JOURNAL_NAVIGATION_TOOLS)
    for (const providerControlledLimit of [
      '"limit"',
      '"maxChars"',
      '"snippetChars"',
      '"anyOf"',
      '"maxItems"',
      '"maximum"',
      '"minimum"',
    ]) {
      assert.equal(schemaText.includes(providerControlledLimit), false)
    }
    assert.ok(Object.isFrozen(JOURNAL_NAVIGATION_TOOLS))
    assert.ok(JOURNAL_NAVIGATION_TOOLS.every(Object.isFrozen))
    assert.equal(JOURNAL_NAVIGATION_MAX_EXPLORATION_CALLS, 6)
    assert.equal(
      Object.hasOwn(JOURNAL_NAVIGATION_TOOLS[0], 'parameters'),
      false,
    )

    assert.deepEqual(
      normalizeJournalNavigationToolRequest({
        input: { kind: 'evidence', ref: 'evidence-1' },
        tool: 'memory_read',
      }),
      {
        input: {
          evidenceIds: ['evidence-1'],
          limit: 1,
          maxChars: JOURNAL_NAVIGATION_READ_MAX_CHARS,
        },
        tool: 'memory_read',
      },
    )
    assert.deepEqual(
      normalizeJournalNavigationToolRequest({
        input: { kind: 'session', ref: 'session-001' },
        tool: 'memory_read',
      }),
      {
        input: {
          limit: JOURNAL_NAVIGATION_READ_LIMIT,
          maxChars: JOURNAL_NAVIGATION_READ_MAX_CHARS,
          session: 'session-001',
        },
        tool: 'memory_read',
      },
    )
    assert.throws(
      () => normalizeJournalNavigationToolRequest({
        input: { limit: 10, phrase: 'safe combination' },
        tool: 'memory_find',
      }),
      /accepts only phrase/,
    )
    assert.throws(
      () => normalizeJournalNavigationToolRequest({
        input: { kind: 'session', limit: 1, ref: 'session-001' },
        tool: 'memory_read',
      }),
      /requires only kind and ref/,
    )
  })

test('LongMemEval sessions become small chronological interactions locally',
  () => {
    const planned = journalNavigationExchanges({
      sessions: [
        {
          eventAt: '2026-01-03T00:00:00.000Z',
          sessionId: 'revealing-answer-session',
          turns: [
            { content: 'A leading Palari turn.', role: 'assistant' },
            { content: 'A later user turn.', role: 'user' },
          ],
        },
        {
          eventAt: '2026-01-01T00:00:00.000Z',
          sessionId: 'raw-dataset-control-session',
          turns: [
            {
              content: 'The first user turn.',
              role: 'user',
              sourceTexts: ['user-source'],
            },
            {
              content: 'The paired Palari turn.',
              role: 'assistant',
              sourceTexts: ['assistant-source'],
            },
          ],
        },
      ],
    })
    assert.deepEqual(
      planned.map(({ sourceMessageId }) => sourceMessageId),
      ['session-001:0', 'session-002:0', 'session-002:1'],
    )
    assert.deepEqual(
      planned.map(({ representedTurns }) => representedTurns),
      [2, 1, 1],
    )
    assert.equal(planned[0].userMessage, 'The first user turn.')
    assert.equal(planned[0].assistantMessage, 'The paired Palari turn.')
    assert.deepEqual(
      planned[0].sourceTexts,
      ['user-source', 'assistant-source'],
    )
    assert.equal(planned[1].assistantMessage, 'A leading Palari turn.')
    assert.equal(planned[2].userMessage, 'A later user turn.')
    assert.equal(
      JSON.stringify(planned).includes('revealing-answer-session'),
      false,
    )
    assert.equal(
      JSON.stringify(planned).includes('raw-dataset-control-session'),
      false,
    )
  })

test('the navigation arm has no old live-harness dependency', async () => {
  const source = await readFile(
    new URL('../evals/arms/journal-navigation-arm.mjs', import.meta.url),
    'utf8',
  )
  const localImports = [...source.matchAll(
    /from\s+['"](\.\.?\/[^'"]+)['"]/gu,
  )].map((match) => match[1])
  assert.deepEqual(localImports, ['../../src/index.mjs'])
  for (const forbidden of [
    'active-brain-longmemeval-live-arm',
    'incremental-memory-longmemeval-live-arm',
    'live-config',
    'checkpoint-journal',
    'prediction-oracle',
    'live-runs/',
    'answerSessionIds',
    'instance.answer',
  ]) {
    assert.equal(source.includes(forbidden), false)
  }
  })

test('fixed host read limits cover a 24-message session without truncation',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'palari-journal-long-session-'))
    const longSession = Array.from({ length: 12 }, (_, index) => ({
      assistantMessage: `Assistant message ${index + 1}.`,
      eventAt: new Date(
        Date.parse('2026-02-01T00:00:00.000Z') + index * 1_000,
      ).toISOString(),
      sourceMessageId: `session-001:${index}`,
      userMessage: `User message ${index + 1}.`,
    }))
    try {
      const result = await runJournalNavigationQuestion({
        async answerProvider({ explore }) {
          const read = await explore({
            input: { kind: 'session', ref: 'session-001' },
            tool: 'memory_read',
          })
          assert.equal(read.messages.length, 24)
          assert.equal(read.truncated, false)
          return { abstained: true, text: 'Read verified.' }
        },
        exchanges: longSession,
        question: 'Inspect the complete session.',
        workspaceDir: root,
      })
      assert.equal(result.canonicalRows, 24)
      assert.equal(result.providerToolTranscript[0].result.truncated, false)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('the navigation seam refuses a tool budget above six', async () => {
  await assert.rejects(
    runJournalNavigationQuestion({
      async answerProvider() {
        return { abstained: true, text: 'unreachable' }
      },
      exchanges: exchanges(),
      maxExplorationCalls: JOURNAL_NAVIGATION_MAX_EXPLORATION_CALLS + 1,
      question: 'This must not run.',
      workspaceDir: '/tmp/palari-navigation-limit-must-not-be-created',
    }),
    /maxExplorationCalls must be between 1 and 6/,
  )
})

test('the low-level exchange path refuses non-neutral session labels',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'palari-journal-raw-id-'))
    let answerProviderCalled = false
    try {
      await assert.rejects(
        runJournalNavigationQuestion({
          async answerProvider() {
            answerProviderCalled = true
            return { abstained: true, text: 'unreachable' }
          },
          exchanges: [{
            ...exchanges()[0],
            sourceMessageId: 'answer-bearing-session:0',
          }],
          question: 'This must not expose a raw session label.',
          workspaceDir: root,
        }),
        /neutral session-NNN:turn sourceMessageId/,
      )
      assert.equal(answerProviderCalled, false)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('a propagated tool failure carries its frozen private audit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-journal-audit-error-'))
  try {
    await assert.rejects(
      runJournalNavigationQuestion({
        async answerProvider({ explore }) {
          await explore({
            input: {},
            tool: 'memory_delete_everything',
          })
          return { abstained: true, text: 'unreachable' }
        },
        exchanges: exchanges(),
        question: 'Delete memory.',
        workspaceDir: root,
      }),
      (error) => {
        assert.equal(error.toolAttempts, 1)
        assert.equal(error.toolAttemptBudget, 6)
        assert.equal(error.toolAttemptBudgetRemaining, 5)
        assert.equal(error.providerToolTranscript.length, 1)
        assert.equal(
          error.providerToolTranscript[0].tool,
          'memory_delete_everything',
        )
        assert.equal(
          error.providerToolTranscript[0].outcome,
          'error',
        )
        assert.equal(Object.isFrozen(error.providerToolTranscript), true)
        return true
      },
    )
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('six invalid attempts exhaust the budget and a caught seventh is fatal',
  async () => {
    const exhaustedRoot = await mkdtemp(
      join(tmpdir(), 'palari-journal-exhausted-'),
    )
    const exceededRoot = await mkdtemp(
      join(tmpdir(), 'palari-journal-exceeded-'),
    )
    try {
      const exhausted = await runJournalNavigationQuestion({
        async answerProvider({ explore }) {
          for (let index = 0;
            index < JOURNAL_NAVIGATION_MAX_EXPLORATION_CALLS;
            index += 1) {
            await assert.rejects(
              explore({
                input: {},
                tool: `invalid_tool_${index}`,
              }),
              /Unknown memory tool/,
            )
          }
          return { abstained: true, text: 'No valid tool call ran.' }
        },
        exchanges: exchanges(),
        question: 'Exhaust the tool-attempt budget.',
        workspaceDir: exhaustedRoot,
      })
      assert.equal(exhausted.toolAttempts, 6)
      assert.equal(exhausted.explorationCalls, 6)
      assert.equal(exhausted.successfulToolExecutions, 0)
      assert.equal(exhausted.explorationExhausted, true)
      assert.equal(exhausted.toolAttemptBudgetExhausted, true)
      assert.equal(exhausted.toolAttemptBudgetRemaining, 0)

      await assert.rejects(
        runJournalNavigationQuestion({
          async answerProvider({ explore }) {
            for (let index = 0;
              index <= JOURNAL_NAVIGATION_MAX_EXPLORATION_CALLS;
              index += 1) {
              try {
                await explore({
                  input: {},
                  tool: `invalid_tool_${index}`,
                })
              } catch {
                // A provider adapter may convert tool failures into tool
                // responses. Catching attempt seven must not validate its
                // final answer.
              }
            }
            return { abstained: false, text: 'must be rejected' }
          },
          exchanges: exchanges(),
          question: 'Try to exceed the tool-attempt budget.',
          workspaceDir: exceededRoot,
        }),
        (error) => {
          assert.equal(error.toolAttempts, 7)
          assert.equal(error.toolAttemptBudgetExceeded, true)
          assert.equal(error.providerToolTranscript.length, 7)
          assert.match(error.message, /budget was exceeded/)
          return true
        },
      )
    } finally {
      await rm(exhaustedRoot, { force: true, recursive: true })
      await rm(exceededRoot, { force: true, recursive: true })
    }
  })

test('failed tool attempts remain auditable and cannot escape scope or delete',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'palari-journal-boundary-'))
    try {
      const result = await runJournalNavigationQuestion({
        async answerProvider({ explore }) {
          await assert.rejects(
            async () => {
              await explore({
                input: {},
                tool: 'memory_delete_everything',
              })
            },
            /Unknown memory tool/,
          )
          await explore({
            input: {},
            tool: 'memory_timeline',
          })
          return { abstained: true, text: 'Deletion is unavailable.' }
        },
        exchanges: exchanges(),
        question: 'Delete memory.',
        workspaceDir: root,
      })
      assert.deepEqual(
        result.providerToolTranscript.map(({ outcome, tool }) => ({
          outcome,
          tool,
        })),
        [
          { outcome: 'error', tool: 'memory_delete_everything' },
          { outcome: 'success', tool: 'memory_timeline' },
        ],
      )
      assert.match(
        result.providerToolTranscript[0].error.message,
        /Unknown memory tool/,
      )
      assert.equal(result.explorationCalls, 2)
      assert.equal(result.successfulToolExecutions, 1)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
