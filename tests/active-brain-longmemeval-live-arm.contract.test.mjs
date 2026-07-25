import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  activeBrainLongMemEvalExchanges,
  runActiveBrainLongMemEvalQuestion,
  runActiveBrainRoleSmoke,
} from '../evals/arms/active-brain-longmemeval-live-arm.mjs'

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

test('sealed active-v1 adapter cannot silently opt into raw persistence',
  async () => {
    const workspace = await temporaryWorkspace('palari-active-sealed-')
    let providerCalls = 0
    try {
      const callGemini = async () => {
        providerCalls += 1
        throw new Error('provider must not be reached')
      }
      await assert.rejects(
        runActiveBrainLongMemEvalQuestion({
          callGemini,
          instance: instance(),
          workspaceDir: workspace,
        }),
        (error) => error?.code === 'RETENTION_REQUIRED',
      )
      await assert.rejects(
        runActiveBrainRoleSmoke({
          callGemini,
          workspaceDir: workspace,
        }),
        (error) => error?.code === 'RETENTION_REQUIRED',
      )
      assert.equal(providerCalls, 0)
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
