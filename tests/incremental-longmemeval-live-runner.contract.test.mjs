import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import * as liveConfig from '../evals/incremental-longmemeval-live-config.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_TERMINAL_RUN_IDS,
  assertIncrementalLongMemEvalOpen,
  denyIncrementalLongMemEvalRetry,
  gradeIncrementalLongMemEvalPredictions,
  incrementalLongMemEvalResultPaths,
  main,
  parseIncrementalLongMemEvalArgs,
} from '../evals/run-incremental-longmemeval-live.mjs'

function usage(usd = 0) {
  return {
    geminiInputTokens: usd ? 10 : 0,
    geminiOutputTokens: usd ? 2 : 0,
    judgeInputTokens: 0,
    judgeOutputTokens: 0,
    usd,
  }
}

function fakeGeminiTransport() {
  let answer = 0
  let writer = 0
  const snapshot = () => {
    const usd = Number((writer * 0.00001 + answer * 0.00002).toFixed(12))
    return {
      accounted: usage(usd),
      attempts: writer + answer,
      geminiModelVersion: 'gemini-3.5-flash-lite',
      logicalRequests: {
        ...(writer ? { writer } : {}),
        ...(answer ? { answer } : {}),
      },
      measured: usage(usd),
      retries: [],
      sequence: (writer + answer) * 2,
      uncertain: usage(0),
    }
  }
  return {
    async callGemini({ purpose }) {
      if (purpose === 'writer') writer += 1
      else if (purpose === 'answer') answer += 1
      else throw new Error('unexpected purpose')
      return {
        finishReason: 'STOP',
        modelVersion: 'gemini-3.5-flash-lite',
        text: '{}',
        validated: true,
      }
    },
    closeNetworkGuard() {},
    installNetworkGuard() {},
    async snapshot() {
      return snapshot()
    },
    async verify() {
      return {
        ledger: snapshot(),
        transcripts: {
          attempts: writer + answer,
          setSha256: 'a'.repeat(64),
          verified: [],
        },
      }
    },
  }
}

function fakeJudgeMeter() {
  return {
    attempt: 1,
    attemptId:
      'question:08e075c7:incremental:judge:attempt:1',
    capContext: {
      cumulativeAccountedUsd: 0.7785582,
      cumulativeCapUsd: 8,
      freshAccountedUsd: 0.00245,
      freshCapUsd: 7.1,
      projectedCumulativeUsd: 0.7789,
      projectedFreshUsd: 0.0028,
    },
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-2024-08-06',
    operationId: 'question:08e075c7:incremental:judge',
    purpose: 'judge',
    request: { bytes: 700, sha256: 'b'.repeat(64) },
    reservation: {
      judgeInputTokens: 1_212,
      judgeOutputTokens: 10,
      pricingTier: 'priority',
      usd: 0.005321,
    },
    schemaVersion: 1,
    startedAt: '2026-07-25T00:00:00.000Z',
    startedStateSha256: 'c'.repeat(64),
    state: 'terminal',
    completedAt: '2026-07-25T00:00:01.000Z',
    terminal: {
      accountedUsd: 0.0003225,
      error: null,
      measured: {
        judgeInputTokens: 125,
        judgeOutputTokens: 1,
        pricingTier: 'default',
        totalTokens: 126,
        usd: 0.0003225,
      },
      outcome: 'success',
      status: 200,
      transcript: {
        file: 'judge.json',
        sha256: 'd'.repeat(64),
      },
      uncertain: null,
    },
    transcript: {
      file: 'judge.json',
      startedSha256: 'e'.repeat(64),
    },
  }
}

test('exact identity is one-way sealed and retry remains forbidden',
  async () => {
    assert.deepEqual(
      INCREMENTAL_LONGMEMEVAL_TERMINAL_RUN_IDS,
      [liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID],
    )
    assert.equal(
      parseIncrementalLongMemEvalArgs([
        '--run',
        liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID,
      ]),
      liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID,
    )
    assert.throws(
      () => assertIncrementalLongMemEvalOpen(
        liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID,
      ),
      (error) => error.code === 'J4_RUN_TERMINAL',
    )
    assert.throws(
      () => parseIncrementalLongMemEvalArgs([
        '--run',
        'question-2',
      ]),
      (error) => error.code === 'RUN_ID_REQUIRED',
    )
    await assert.rejects(
      denyIncrementalLongMemEvalRetry(),
      (error) =>
        error.code === 'INCREMENTAL_LONGMEMEVAL_RETRY_FORBIDDEN',
    )
  })

test('mocked one-shot execution checkpoints 243 interactions then stops',
  async () => {
    if (INCREMENTAL_LONGMEMEVAL_TERMINAL_RUN_IDS.includes(
      liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID,
    )) {
      let reads = 0
      await assert.rejects(
        main({
          args: [
            '--run',
            liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID,
          ],
          dependencies: new Proxy({}, {
            get() {
              reads += 1
              throw new Error('terminal runner read dependencies')
            },
          }),
          env: new Proxy({}, {
            get() {
              reads += 1
              throw new Error('terminal runner read environment')
            },
          }),
        }),
        (error) => error.code === 'J4_RUN_TERMINAL',
      )
      assert.equal(reads, 0)
      return
    }
    const root = await mkdtemp(
      join(tmpdir(), 'palari-incremental-live-runner-'),
    )
    const transport = fakeGeminiTransport()
    const judgeMeter = fakeJudgeMeter()
    let judgeCalls = 0
    let questionCalls = 0
    try {
      const result = await main({
        args: [
          '--run',
          liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID,
        ],
        dependencies: {
          async loadConfig() {
            return {
              config: {
                artifacts: [],
                dataset: { path: 'data/frozen.json' },
                models: {
                  answer: 'gemini-3.5-flash-lite',
                  judge: 'gpt-4o-2024-08-06',
                  reducer: 'gemini-3.5-flash-lite',
                },
                predecessor:
                  liveConfig.INCREMENTAL_LONGMEMEVAL_PREDECESSOR,
                productCommit:
                  liveConfig.INCREMENTAL_LONGMEMEVAL_PRODUCT_COMMIT,
                runDate: '2026-07-26',
                runId: liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID,
              },
              configPath: join(root, 'config.json'),
              configSha256: '1'.repeat(64),
              predictions: {
                predictions:
                  liveConfig.INCREMENTAL_LONGMEMEVAL_EXPECTED_PREDICTIONS,
              },
              predictionsPath: join(root, 'predictions.json'),
              predictionsSha256: '2'.repeat(64),
            }
          },
          async loadAuthority() {
            return {
              authority: {
                runId: liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID,
              },
              authorityPath: join(root, 'authority.json'),
              authoritySha256: '3'.repeat(64),
            }
          },
          async auditArtifacts() {
            return {
              artifacts: 0,
              artifactSetSha256: '4'.repeat(64),
            }
          },
          async inspectGitCutPoint() {
            return { administrativeHead: '5'.repeat(40) }
          },
          async verifyPredecessor() {
            return {
              accountedUsd: 0.7761082,
              checkpointSha256: '6'.repeat(64),
              manifestSha256: '7'.repeat(64),
              measuredUsd: 0.7736072,
              meterSha256: '8'.repeat(64),
              runId: 'j4-active-brain-incremental-smoke-v1',
              uncertainUsd: 0.002501,
            }
          },
          async preparePopulation() {
            return {}
          },
          selectPopulation() {
            return {
              instance: {
                answer: 'aardvark',
                isAbstention: false,
                question: 'What is the current answer?',
                questionDate: '2023-09-04T17:07:00.000Z',
                questionId: '08e075c7',
                questionType: 'knowledge-update',
              },
              stats: {
                exchangePlanSha256:
                  liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION
                    .exchangePlanSha256,
                interactions: 243,
              },
            }
          },
          assertEnvironment() {
            return {
              cumulativeCapUsd: 8,
              freshSubcapUsd: 7.1,
              geminiApiKey: 'gemini-test-secret',
              model: 'gemini-3.5-flash-lite',
              openaiApiKey: 'openai-test-secret',
            }
          },
          async auditTrackedFiles() {
            return {
              files: 1,
              trackedPathsSha256: '9'.repeat(64),
            }
          },
          async createMeteredTransport() {
            return transport
          },
          async createJudgeTransport({ getFreshAccountedUsd }) {
            assert.ok(await getFreshAccountedUsd() >= 0)
            return {
              async callJudge({ body, cellId, operationId }) {
                judgeCalls += 1
                assert.equal(cellId, '08e075c7')
                assert.equal(operationId,
                  'question:08e075c7:incremental:judge')
                assert.equal(body.store, false)
                return {
                  finishReason: 'stop',
                  measured: judgeMeter.terminal.measured,
                  meter: judgeMeter,
                  modelVersion: 'gpt-4o-2024-08-06',
                  serviceTier: 'default',
                  text: 'yes',
                  validated: true,
                }
              },
              async snapshot() {
                return {
                  accountedUsd: judgeCalls
                    ? judgeMeter.terminal.accountedUsd
                    : 0,
                  attempts: judgeCalls,
                  measured: judgeCalls
                    ? judgeMeter.terminal.measured
                    : null,
                  operationId: judgeCalls
                    ? judgeMeter.operationId
                    : null,
                  state: judgeCalls ? 'terminal' : 'not_dispatched',
                  uncertain: null,
                }
              },
              async verify() {
                return {
                  meter: judgeMeter,
                  snapshot: await this.snapshot(),
                  transcript: {
                    file: 'judge.json',
                    sha256: 'd'.repeat(64),
                  },
                }
              },
            }
          },
          async readFile() {
            return Buffer.from('frozen dataset')
          },
          async runQuestion({ callGemini, instance, onCheckpoint }) {
            questionCalls += 1
            const interactionCheckpoints = []
            for (let ordinal = 1; ordinal <= 243; ordinal += 1) {
              await callGemini({
                body: {},
                cellId: instance.questionId,
                operationId: `reducer:${ordinal}`,
                purpose: 'writer',
              })
              const checkpoint = {
                activeMemories: [],
                activeMemoriesSha256: 'a'.repeat(64),
                completedInteraction: ordinal,
                digest: {
                  digestRevision: ordinal,
                  pending: 0,
                  ready: true,
                },
                digestChars: 100,
                evidenceWritten: 2,
                interactionCount: 243,
                modelVersion: 'gemini-3.5-flash-lite',
                reducerRequestSha256: 'b'.repeat(64),
                reducerResponseSha256: 'c'.repeat(64),
                representedTurnIndexes: [ordinal],
                representedTurns: 2,
                sessionId: `session-${ordinal}`,
                sourceMessageId: `message-${ordinal}`,
                status: 'completed',
                unitOrder: ordinal,
              }
              interactionCheckpoints.push(checkpoint)
              await onCheckpoint(checkpoint)
            }
            await callGemini({
              body: {},
              cellId: instance.questionId,
              operationId: 'answer',
              purpose: 'answer',
            })
            return {
              activeMemories: [{
                id: 'memory-1',
                statement: 'The answer is aardvark.',
              }],
              activeMemoriesSha256: 'a'.repeat(64),
              answer: 'The current answer is aardvark.',
              answerModelVersion: 'gemini-3.5-flash-lite',
              answerProviderCalled: true,
              answerRequestSha256: 'd'.repeat(64),
              briefing: {
                complete: true,
                includedMemoryIds: ['memory-1'],
                mode: 'incremental_digest',
                requiredChars: 100,
                status: 'included',
                totalCandidates: 1,
              },
              canonicalRows: 484,
              digestStatus: {
                pending: 0,
                ready: true,
              },
              exchangePlanSha256:
                liveConfig.INCREMENTAL_LONGMEMEVAL_POPULATION
                  .exchangePlanSha256,
              interactionCheckpoints,
              interactions: 243,
              logicalOperations: {
                answer: 1,
                reducer: 243,
                total: 244,
              },
              modelVersion: 'gemini-3.5-flash-lite',
              promptSha256: 'e'.repeat(64),
              questionId: '08e075c7',
              rawTurns: 484,
            }
          },
          now: (() => {
            let tick = 0
            return () =>
              new Date(Date.UTC(2026, 6, 25, 0, 0, tick++))
                .toISOString()
          })(),
          log() {},
        },
        env: {},
        repoRoot: root,
      })
      assert.equal(questionCalls, 1)
      assert.equal(judgeCalls, 1)
      assert.equal(result.checkpoint.status, 'complete')
      assert.equal(result.checkpoint.interactions.length, 243)
      assert.equal(result.checkpoint.question.questionId, '08e075c7')
      assert.equal(result.checkpoint.judge.correct, true)
      assert.equal(result.checkpoint.invocations[0].question2Started, false)
      assert.equal(
        result.checkpoint.meter.gemini.logicalRequests.writer,
        243,
      )
      assert.equal(
        result.checkpoint.meter.gemini.logicalRequests.answer,
        1,
      )
      assert.equal(
        result.report.grades.every((grade) => grade.outcome === 'hit'),
        true,
      )
      const paths = incrementalLongMemEvalResultPaths(root)
      const terminal = JSON.parse(
        await readFile(paths.checkpointPath, 'utf8'),
      )
      assert.equal(terminal.status, 'complete')
      assert.equal(terminal.interactions.length, 243)
      assert.equal(
        JSON.parse(await readFile(
          paths.artifactManifestPath,
          'utf8',
        )).runId,
        liveConfig.INCREMENTAL_LONGMEMEVAL_RUN_ID,
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('prediction grading reports judge failure before mechanical hits', () => {
  const checkpoint = {
    answer: {
      digestChars: 100,
      digestItems: 1,
      digestPending: 0,
      digestReady: true,
      status: 'completed',
    },
    interactions: Array.from({ length: 243 }, (_, index) => ({
      ordinal: index + 1,
      reducerRequestSha256: 'a'.repeat(64),
      status: 'completed',
    })),
    invocations: [{}],
    judge: { correct: false },
    meter: {
      gemini: {
        attempts: 244,
        logicalRequests: { answer: 1, writer: 243 },
        retries: [],
      },
      judge: { attempt: 1 },
    },
    question: { questionId: '08e075c7' },
    spend: {
      cumulativeAccountedUsd: 1,
      freshAccountedUsd: 0.1,
    },
    status: 'complete',
  }
  const grades = gradeIncrementalLongMemEvalPredictions({ checkpoint })
  assert.equal(grades[0].id, 'OFFICIAL_JUDGE_CORRECT')
  assert.equal(grades[0].outcome, 'miss')
})
