import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  ACTIVE_BRAIN_LONGMEMEVAL_MAX_CHARS,
  activeBrainLongMemEvalExchanges,
  runActiveBrainLongMemEvalQuestion,
  runActiveBrainRoleSmoke,
} from '../evals/arms/active-brain-longmemeval-live-arm.mjs'

function usage() {
  return {
    geminiInputTokens: 10,
    geminiOutputTokens: 5,
    judgeInputTokens: 0,
    judgeOutputTokens: 0,
    usd: 0.0000155,
  }
}

function validated(text, overrides = {}) {
  return {
    finishReason: 'STOP',
    modelVersion: 'gemini-3.5-flash-lite',
    text,
    usage: usage(),
    usageDetails: {
      candidateTokens: 5,
      thoughtTokens: 0,
    },
    validated: true,
    ...overrides,
  }
}

function memory(quote, type = 'entity') {
  return {
    confidence: 0.9,
    fictional: false,
    importance: 0.8,
    quote,
    type,
  }
}

function envelope(memories) {
  return JSON.stringify({ memories })
}

function instance(questionId = 'active-arm-test') {
  return {
    answer: 'tea',
    answerSessionIds: ['early'],
    isAbstention: false,
    question: 'What should I remember?',
    questionDate: '2026-07-03T00:00:00.000Z',
    questionId,
    questionType: 'single-session-assistant',
    sessions: [
      {
        eventAt: '2026-07-02T00:00:00.000Z',
        sessionId: 'late',
        turns: [
          { content: 'I prefer coffee.', role: 'user' },
          { content: 'I recommend a dark roast.', role: 'assistant' },
        ],
      },
      {
        eventAt: '2026-07-01T00:00:00.000Z',
        sessionId: 'early',
        turns: [
          {
            content: 'I previously suggested a tea infuser.',
            role: 'assistant',
          },
          { content: 'I prefer tea.', role: 'user' },
          { content: 'I recommend a ceramic cup.', role: 'assistant' },
        ],
      },
    ],
  }
}

async function temporaryWorkspace(prefix) {
  return mkdtemp(join(tmpdir(), prefix))
}

test('active replay consumes every raw user and assistant turn once', () => {
  const exchanges = activeBrainLongMemEvalExchanges(instance())
  assert.deepEqual(
    exchanges.map((exchange) => [
      exchange.sessionId,
      exchange.representedTurnIndexes,
      exchange.userMessage,
      exchange.assistantMessage,
    ]),
    [
      [
        'early',
        [0],
        '',
        'I previously suggested a tea infuser.',
      ],
      [
        'early',
        [1, 2],
        'I prefer tea.',
        'I recommend a ceramic cup.',
      ],
      [
        'late',
        [0, 1],
        'I prefer coffee.',
        'I recommend a dark roast.',
      ],
    ],
  )
  assert.equal(
    exchanges.reduce((total, exchange) =>
      total + exchange.representedTurns, 0),
    5,
  )
  assert.equal(
    exchanges.filter((exchange) => exchange.standaloneAssistant).length,
    1,
  )
})

test('active arm preserves exact host roles and briefs the complete set', async () => {
  const workspace = await temporaryWorkspace('palari-active-arm-')
  const calls = []
  try {
    const result = await runActiveBrainLongMemEvalQuestion({
      callGemini: async (call) => {
        calls.push(call)
        if (call.purpose === 'answer') {
          return validated(
            'You prefer tea, and Palari recommended a ceramic cup.',
          )
        }
        const visible = JSON.parse(
          call.body.contents[0].parts[0].text,
        )
        const selected = [
          visible.userMessage
            ? memory(visible.userMessage, 'preference')
            : null,
          visible.palariMessage
            ? memory(visible.palariMessage, 'opinion')
            : null,
        ].filter(Boolean)
        return validated(envelope(selected))
      },
      instance: instance(),
      workspaceDir: workspace,
    })

    assert.deepEqual(
      calls.map((call) => call.purpose),
      ['writer', 'writer', 'writer', 'answer'],
    )
    assert.equal(result.ingest.rawTurns, 5)
    assert.equal(result.ingest.userTurns, 2)
    assert.equal(result.ingest.assistantTurns, 3)
    assert.equal(result.ingest.standaloneAssistantTurns, 1)
    assert.equal(result.ingest.memoriesWritten, 5)
    assert.equal(result.briefing.complete, true)
    assert.equal(result.briefing.totalCandidates, 5)
    assert.equal(result.briefing.includedMemoryIds.length, 5)
    assert.deepEqual(result.briefing.roleCounts, {
      assistant: 3,
      user: 2,
    })
    assert.equal(result.answerProviderCalled, true)
    assert.equal(result.providerCalled, true)
    assert.equal(result.retrieval.complete.all, true)
    assert.equal(result.retrieval.allContextIncluded, true)
    assert.match(result.promptSha256, /^[a-f0-9]{64}$/)
    assert.equal(result.sourceCoverage.answerSessionsStored.all, true)
    assert.equal(result.sourceCoverage.answerSessionsInBriefing.all, true)
    assert.deepEqual(
      result.memoryEvidence.map((entry) => [
        entry.content,
        entry.sourceKind,
        entry.sourceMessageId,
      ]),
      [
        [
          'I previously suggested a tea infuser.',
          'assistant_message',
          'early:0:assistant',
        ],
        ['I prefer tea.', 'user_message', 'early:1:user'],
        [
          'I recommend a ceramic cup.',
          'assistant_message',
          'early:1:assistant',
        ],
        ['I prefer coffee.', 'user_message', 'late:0:user'],
        [
          'I recommend a dark roast.',
          'assistant_message',
          'late:0:assistant',
        ],
      ],
    )
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test('active arm stops at the first invalid writer payload', async () => {
  const workspace = await temporaryWorkspace('palari-active-invalid-')
  let calls = 0
  try {
    await assert.rejects(
      runActiveBrainLongMemEvalQuestion({
        callGemini: async () => {
          calls += 1
          return validated('{"unsupported":[]}')
        },
        instance: instance('active-invalid'),
        workspaceDir: workspace,
      }),
      (error) => error?.code === 'EXTRACTION_PAYLOAD_INVALID',
    )
    assert.equal(calls, 1)
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test('non-exact model text is dropped and recorded, never rewritten', async () => {
  const workspace = await temporaryWorkspace('palari-active-drop-')
  try {
    const result = await runActiveBrainLongMemEvalQuestion({
      callGemini: async (call) => {
        if (call.purpose === 'answer') {
          return validated('Only exact visible statements were stored.')
        }
        const visible = JSON.parse(
          call.body.contents[0].parts[0].text,
        )
        return validated(envelope([
          memory('This sentence was authored by the model.'),
          ...(visible.userMessage
            ? [memory(visible.userMessage, 'preference')]
            : []),
        ]))
      },
      instance: instance('active-drop'),
      workspaceDir: workspace,
    })
    assert.equal(result.ingest.droppedQuoteNotInDialogue, 3)
    assert.equal(
      result.memoryEvidence.some((entry) =>
        entry.content === 'This sentence was authored by the model.'),
      false,
    )
    assert.ok(result.memoryEvidence.every((entry) =>
      entry.sourceKind === 'user_message'))
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test('default-cap overflow sends no partial briefing or answer call', async () => {
  const workspace = await temporaryWorkspace('palari-active-cap-')
  const oversized = 'A'.repeat(
    ACTIVE_BRAIN_LONGMEMEVAL_MAX_CHARS + 1_000,
  )
  let answerCalls = 0
  try {
    const result = await runActiveBrainLongMemEvalQuestion({
      callGemini: async (call) => {
        if (call.purpose === 'answer') {
          answerCalls += 1
          return validated('This call must not happen.')
        }
        return validated(envelope([memory(oversized)]))
      },
      instance: {
        answer: 'oversized',
        answerSessionIds: ['capacity'],
        isAbstention: false,
        question: 'What was stored?',
        questionDate: '2026-07-03T00:00:00.000Z',
        questionId: 'active-capacity',
        questionType: 'single-session-user',
        sessions: [{
          eventAt: '2026-07-01T00:00:00.000Z',
          sessionId: 'capacity',
          turns: [
            { content: oversized, role: 'user' },
            { content: 'Acknowledged.', role: 'assistant' },
          ],
        }],
      },
      workspaceDir: workspace,
    })
    assert.equal(answerCalls, 0)
    assert.equal(result.answerProviderCalled, false)
    assert.equal(result.providerCalled, false)
    assert.equal(result.promptSha256, null)
    assert.equal(result.retrieval.complete.all, false)
    assert.equal(result.retrieval.allContextIncluded, false)
    assert.equal(result.briefing.complete, false)
    assert.equal(result.briefing.status, 'capacity_exceeded')
    assert.deepEqual(result.briefing.includedMemoryIds, [])
    assert.ok(
      result.briefing.requiredChars >
        ACTIVE_BRAIN_LONGMEMEVAL_MAX_CHARS,
    )
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test('role smoke exercises exact user and Palari memory without regex', async () => {
  const workspace = await temporaryWorkspace('palari-active-smoke-')
  let writerCalls = 0
  let answerCalls = 0
  try {
    const result = await runActiveBrainRoleSmoke({
      callGemini: async (call) => {
        if (call.purpose === 'answer') {
          answerCalls += 1
          return validated(
            'You said platform seven; Palari recommended arriving twenty minutes early.',
          )
        }
        writerCalls += 1
        assert.equal(JSON.stringify(call.body).includes('4815'), false)
        const visible = JSON.parse(
          call.body.contents[0].parts[0].text,
        )
        return validated(envelope([
          memory(visible.userMessage),
          memory(visible.palariMessage, 'opinion'),
        ]))
      },
      workspaceDir: workspace,
    })
    assert.equal(writerCalls, 1)
    assert.equal(answerCalls, 1)
    assert.equal(result.ingest.userStatementsWritten, 1)
    assert.equal(result.ingest.assistantStatementsWritten, 1)
    assert.equal(result.ingest.externalSourcesIgnored, 1)
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test('new active arm has no regex or lexical-recall dependency', async () => {
  const source = await readFile(
    new URL(
      '../evals/arms/active-brain-longmemeval-live-arm.mjs',
      import.meta.url,
    ),
    'utf8',
  )
  for (const forbidden of [
    'RegExp(',
    '.match(',
    '.test(',
    'recallAndBrief',
    'recallMemories',
    'searchMemories',
    'buildJ4WriterBody',
    'buildJ4AnswerPrompt',
  ]) {
    assert.equal(source.includes(forbidden), false)
  }
})
