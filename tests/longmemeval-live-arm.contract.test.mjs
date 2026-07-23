import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  assertExactExtractionEnvelope,
  assertValidatedJ4GeminiResponse,
  chronologicalJ4Sessions,
  runKernelLongMemEvalQuestion,
} from '../evals/arms/kernel-longmemeval-live-arm.mjs'

function extraction(content, keyword) {
  return JSON.stringify({
    memories: [{
      confidence: 0.9,
      content,
      fictional: false,
      importance: 0.8,
      keywords: [keyword],
      shared: false,
      sourceKind: 'user_message',
      type: 'preference',
    }],
  })
}

function validatedGemini(text, overrides = {}) {
  return {
    finishReason: 'STOP',
    modelVersion: 'gemini-3.5-flash-lite',
    text,
    usage: {
      geminiInputTokens: 10,
      geminiOutputTokens: 5,
      judgeInputTokens: 0,
      judgeOutputTokens: 0,
      usd: 0.0000155,
    },
    usageDetails: {
      cachedInputTokens: 0,
      candidateTokens: 5,
      thoughtTokens: 0,
    },
    validated: true,
    ...overrides,
  }
}

function syntheticInstance(questionId = 'j4-test-question') {
  return {
    answer: 'tea',
    answerSessionIds: ['early-session'],
    isAbstention: false,
    question: 'What drink does the user prefer?',
    questionDate: '2026-07-03T00:00:00Z',
    questionId,
    questionType: 'single-session-preference',
    sessions: [
      {
        eventAt: '2026-07-02T00:00:00Z',
        sessionId: 'late-session',
        turns: [
          { content: 'I prefer coffee.', role: 'user' },
          { content: 'Understood.', role: 'assistant' },
        ],
      },
      {
        eventAt: '2026-07-01T00:00:00Z',
        sessionId: 'early-session',
        turns: [
          { content: 'I prefer tea.', role: 'user' },
          { content: 'Understood.', role: 'assistant' },
        ],
      },
    ],
  }
}

test('J4 extraction prevalidation rejects malformed or missing memories immediately', () => {
  assert.throws(
    () => assertExactExtractionEnvelope('not json'),
    /malformed JSON/,
  )
  assert.throws(
    () => assertExactExtractionEnvelope('{}'),
    /memories array/,
  )
  assert.throws(
    () => assertExactExtractionEnvelope('{"memories":{}}'),
    /memories array/,
  )
  assert.throws(
    () => assertExactExtractionEnvelope(
      '{"memories":[{"type":"working","content":"User likes tea."}]}',
    ),
    /exact frozen fields/,
  )
  assert.throws(
    () => assertExactExtractionEnvelope(
      '{"memories":[],"unexpected":true}',
    ),
    /memories array/,
  )
  assert.deepEqual(
    assertExactExtractionEnvelope('{"memories":[]}'),
    { memories: [] },
  )
})

test('J4 replay order is stable chronological with original-order ties', () => {
  const ordered = chronologicalJ4Sessions({
    sessions: [
      { eventAt: '2026-07-02T00:00:00Z', sessionId: 'third' },
      { eventAt: '2026-07-01T00:00:00Z', sessionId: 'first' },
      { eventAt: '2026-07-01T00:00:00Z', sessionId: 'second' },
    ],
  })
  assert.deepEqual(
    ordered.map((session) => session.sessionId),
    ['first', 'second', 'third'],
  )
})

test('J4 arm requires the meter validated model/finish/text/usage contract', () => {
  assert.equal(
    assertValidatedJ4GeminiResponse(validatedGemini('okay'), 'writer').text,
    'okay',
  )
  for (const response of [
    validatedGemini('okay', { validated: false }),
    validatedGemini('okay', { modelVersion: 'different-model' }),
    validatedGemini('okay', { finishReason: 'MAX_TOKENS' }),
    validatedGemini(''),
    validatedGemini('okay', { usage: null }),
    validatedGemini('okay', { usageDetails: {} }),
  ]) {
    assert.throws(
      () => assertValidatedJ4GeminiResponse(response, 'writer'),
      /fully validated Gemini transport result/,
    )
  }
})

test('J4 arm uses one gated workspace, exact source IDs, and the official answer path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-arm-'))
  const calls = []
  try {
    const result = await runKernelLongMemEvalQuestion({
      callGemini: async (request) => {
        calls.push(request)
        if (request.purpose === 'answer') {
          return validatedGemini('The user prefers coffee.')
        }
        const body = JSON.stringify(request.body)
        return validatedGemini(
          body.includes('coffee')
            ? extraction('User prefers coffee.', 'coffee')
            : extraction('User prefers tea.', 'tea'),
        )
      },
      instance: syntheticInstance(),
      workspaceDir: join(root, 'workspace'),
    })
    assert.deepEqual(
      calls.map((call) => call.purpose),
      ['writer', 'writer', 'answer'],
    )
    assert.match(JSON.stringify(calls[0].body), /prefer tea/)
    assert.match(JSON.stringify(calls[1].body), /prefer coffee/)
    assert.equal(result.answer, 'The user prefers coffee.')
    assert.equal(result.ingest.turns, 2)
    assert.equal(result.ingest.sessions, 2)
    assert.ok(result.ingest.memoriesWritten >= 1)
    assert.ok(result.ingest.storedSourceSessionIds.every((id) =>
      ['early-session', 'late-session'].includes(id)))
    assert.ok(result.briefing.includedSourceSessionIds.every((id) =>
      ['early-session', 'late-session'].includes(id)))
    assert.match(result.promptSha256, /^[a-f0-9]{64}$/)
    assert.equal(result.retrieval.at10.expected, 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('J4 arm stops on the first malformed writer success and never answers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'palari-j4-arm-stop-'))
  let calls = 0
  try {
    await assert.rejects(
      runKernelLongMemEvalQuestion({
        callGemini: async () => {
          calls += 1
          return validatedGemini('{}')
        },
        instance: syntheticInstance('j4-test-malformed'),
        workspaceDir: join(root, 'workspace'),
      }),
      /memories array/,
    )
    assert.equal(calls, 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
