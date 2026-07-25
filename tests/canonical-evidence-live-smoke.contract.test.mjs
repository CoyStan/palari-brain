import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  j4ReservationFor,
} from '../evals/active-brain-live-meter.mjs'
import {
  CANONICAL_EVIDENCE_SMOKE_FIXTURE,
  runCanonicalEvidenceLiveSmoke,
} from '../evals/arms/canonical-evidence-live-smoke.mjs'

const zeroJudgeUsage = {
  geminiInputTokens: 10,
  geminiOutputTokens: 5,
  judgeInputTokens: 0,
  judgeOutputTokens: 0,
  usd: 0.0000155,
}

function response(text) {
  return {
    finishReason: 'STOP',
    modelVersion: 'gemini-3.5-flash-lite',
    text,
    usage: zeroJudgeUsage,
    usageDetails: {
      candidateTokens: 5,
      thoughtTokens: 0,
    },
    validated: true,
  }
}

async function temporaryWorkspace() {
  return mkdtemp(join(tmpdir(), 'palari-canonical-live-smoke-'))
}

test('canonical role smoke survives a writer selecting only the user quote',
  async () => {
    const workspaceDir = await temporaryWorkspace()
    const calls = []
    try {
      const result = await runCanonicalEvidenceLiveSmoke({
        callGemini: async (request) => {
          calls.push(request)
          if (request.purpose === 'writer') {
            const body = JSON.stringify(request.body)
            assert.equal(
              body.includes(
                CANONICAL_EVIDENCE_SMOKE_FIXTURE.excludedSource,
              ),
              false,
            )
            return response(JSON.stringify({
              memories: [{
                confidence: 0.9,
                fictional: false,
                importance: 0.8,
                quote:
                  CANONICAL_EVIDENCE_SMOKE_FIXTURE.userMessage,
                type: 'life_event',
              }],
            }))
          }
          assert.equal(request.purpose, 'answer')
          const prompt = request.body.contents[0].parts[0].text
          assert.ok(prompt.includes(
            CANONICAL_EVIDENCE_SMOKE_FIXTURE.userMessage,
          ))
          assert.ok(prompt.includes(
            CANONICAL_EVIDENCE_SMOKE_FIXTURE.assistantMessage,
          ))
          assert.equal(prompt.includes('4815'), false)
          return response(
            'You said platform seven, and Palari recommended arriving twenty minutes early.',
          )
        },
        workspaceDir,
      })

      assert.deepEqual(
        calls.map((entry) => [
          entry.purpose,
          entry.operationId,
        ]),
        [
          [
            'writer',
            'canonical-evidence-smoke:writer',
          ],
          [
            'answer',
            'canonical-evidence-smoke:answer',
          ],
        ],
      )
      assert.deepEqual(
        result.canonicalRows.map((row) => [
          row.content,
          row.sourceKind,
          row.evidenceKind,
        ]),
        [
          [
            CANONICAL_EVIDENCE_SMOKE_FIXTURE.userMessage,
            'user_message',
            'canonical_message',
          ],
          [
            CANONICAL_EVIDENCE_SMOKE_FIXTURE.assistantMessage,
            'assistant_message',
            'canonical_message',
          ],
        ],
      )
      assert.deepEqual(result.index, {
        selected: 1,
        status: 'completed',
        written: 1,
      })
      assert.equal(result.logicalOperations, 2)
      assert.equal(result.sourceTextsIgnored, 1)
      assert.equal(result.briefing.complete, true)
      assert.equal(result.briefing.included.length, 2)

      const config = JSON.parse(await readFile(
        new URL(
          '../evals/live-runs/j4-active-brain-canonical-smoke-v1.json',
          import.meta.url,
        ),
        'utf8',
      ))
      const bodyHashes = Object.fromEntries(calls.map((entry) => [
        entry.purpose,
        createHash('sha256')
          .update(JSON.stringify(entry.body))
          .digest('hex'),
      ]))
      assert.equal(
        bodyHashes.writer,
        config.prompts.fixtureWriterBodySha256,
      )
      assert.notEqual(
        bodyHashes.answer,
        config.prompts.fixtureAnswerBodySha256,
        'the sealed identity must not silently adopt the new digest prompt',
      )
      const reservations = calls.map((entry) =>
        j4ReservationFor({
          body: entry.body,
          maxOutputTokens:
            entry.body.generationConfig.maxOutputTokens,
          provider: 'gemini',
        }))
      const oneAttemptReservationUsd = reservations.reduce(
        (total, entry) => total + entry.usd,
        0,
      )
      assert.ok(
        oneAttemptReservationUsd * 4 <
          config.spend.freshSubcapUsd,
      )
      assert.equal(
        config.spend.oneAttemptReservationUsd * 4,
        config.spend.allEightAttemptsReservationUsd,
        'the terminal run keeps its original frozen accounting',
      )
      assert.ok(
        config.spend.allEightAttemptsReservationUsd <
          config.spend.freshSubcapUsd,
      )
    } finally {
      await rm(workspaceDir, { force: true, recursive: true })
    }
  })

test('writer transport failure remains terminal after canonical local write',
  async () => {
    const workspaceDir = await temporaryWorkspace()
    let calls = 0
    try {
      await assert.rejects(
        runCanonicalEvidenceLiveSmoke({
          callGemini: async () => {
            calls += 1
            const error = new Error('transport failed')
            error.code = 'TRANSPORT_RETRIES_EXHAUSTED'
            throw error
          },
          workspaceDir,
        }),
        (error) =>
          error?.code === 'TRANSPORT_RETRIES_EXHAUSTED',
      )
      assert.equal(calls, 1)
    } finally {
      await rm(workspaceDir, { force: true, recursive: true })
    }
  })

test('canonical smoke arm has no dataset or lexical recall dependency',
  async () => {
    const source = await import('node:fs/promises').then(({ readFile }) =>
      readFile(
        new URL(
          '../evals/arms/canonical-evidence-live-smoke.mjs',
          import.meta.url,
        ),
        'utf8',
      ))
    for (const forbidden of [
      'longmemeval_s_cleaned',
      'recallAndBrief',
      'recallMemories',
      'searchMemories',
      'callJudge',
      'OPENAI_API_KEY',
    ]) {
      assert.equal(source.includes(forbidden), false)
    }
  })
