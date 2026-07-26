import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_GENERATION,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_SYSTEM_INSTRUCTION,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOL_CONFIG,
  INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS,
} from '../evals/arms/incremental-memory-exploration-longmemeval-live-arm.mjs'
import * as liveConfig from '../evals/exploration-longmemeval-live-config.mjs'
import {
  createIncrementalLongMemEvalGeminiTransport,
} from '../evals/incremental-longmemeval-runtime.mjs'
import {
  EXPLORATION_LONGMEMEVAL_TERMINAL_RUN_IDS,
  assertExplorationLongMemEvalOpen,
  explorationLongMemEvalResultPaths,
  main,
  parseExplorationLongMemEvalArgs,
} from '../evals/run-exploration-longmemeval-live.mjs'

const HASH = 'a'.repeat(64)

function usage(usd) {
  return {
    geminiInputTokens: usd ? 100 : 0,
    geminiOutputTokens: usd ? 10 : 0,
    judgeInputTokens: 0,
    judgeOutputTokens: 0,
    usd,
  }
}

function fakeGeminiSnapshot() {
  return {
    accounted: usage(
      liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
        .accountedUsd + 0.01,
    ),
    attempts: 30,
    logicalRequests: { explore: 3, writer: 27 },
    measured: usage(0.01),
    sequence: 60,
    terminal: null,
    uncertain: usage(0),
  }
}

function fakeGeminiTransport() {
  const snapshot = fakeGeminiSnapshot()
  return {
    async callGemini() {
      throw new Error('mock arm owns provider observations')
    },
    closeNetworkGuard() {},
    installNetworkGuard() {},
    async snapshot() {
      return structuredClone(snapshot)
    },
    async verify() {
      return {
        meter: structuredClone(snapshot),
        transcripts: {
          attempts: 30,
          setSha256: HASH,
          verified: [],
        },
      }
    },
  }
}

function judgeMeter() {
  return {
    attempt: 1,
    state: 'terminal',
    terminal: {
      accountedUsd: 0.0003,
      measured: {
        judgeInputTokens: 100,
        judgeOutputTokens: 1,
        pricingTier: 'default',
        totalTokens: 101,
        usd: 0.0003,
      },
      uncertain: null,
    },
  }
}

function fakeJudgeTransport({ failCall = false } = {}) {
  const meter = judgeMeter()
  return {
    async callJudge() {
      if (failCall) {
        const error = new Error('offline judge transport failure')
        error.code = 'OFFLINE_JUDGE_FAILURE'
        throw error
      }
      return {
        finishReason: 'stop',
        measured: meter.terminal.measured,
        meter,
        modelVersion: liveConfig.EXPLORATION_LONGMEMEVAL_MODELS.judge,
        serviceTier: 'default',
        text: 'yes',
        validated: true,
      }
    },
    async snapshot() {
      return {
        accountedUsd: meter.terminal.accountedUsd,
        attempts: 1,
        measured: meter.terminal.measured,
        operationId:
          `question:${liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID}:exploration:judge`,
        state: 'terminal',
        uncertain: null,
      }
    },
    async verify() {
      return {
        meter,
        snapshot: await this.snapshot(),
        transcript: { file: 'judge.json', sha256: HASH },
      }
    },
  }
}

function functionTurn(dispatch, phrase) {
  const functionCall = {
    args: { phrase },
    name: 'memory_find',
  }
  return {
    candidateContent: {
      parts: [{ functionCall }],
      role: 'model',
    },
    dispatch,
    functionCalls: [functionCall],
    modelVersion:
      liveConfig.EXPLORATION_LONGMEMEVAL_MODELS.exploration,
    operationId:
      `question:${liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID}:explore:${dispatch}`,
    requestSha256: HASH,
    responseType: 'function_calls',
    text: null,
  }
}

function finalTurn(dispatch, text) {
  return {
    candidateContent: {
      parts: [{ text }],
      role: 'model',
    },
    dispatch,
    functionCalls: [],
    modelVersion:
      liveConfig.EXPLORATION_LONGMEMEVAL_MODELS.exploration,
    operationId:
      `question:${liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID}:explore:${dispatch}`,
    requestSha256: HASH,
    responseType: 'final_text',
    text,
  }
}

function fakeArmResult() {
  const answer = 'The recorded answer was violet.'
  return {
    answer,
    answerProviderCalled: true,
    consultedEvidenceIds: ['evidence-1'],
    digestStatus: { pending: 0, ready: true },
    exchangePlanSha256:
      liveConfig.EXPLORATION_LONGMEMEVAL_POPULATION
        .exchangePlanSha256,
    explorationCalls: 2,
    explorationExhausted: false,
    interactionCheckpoints: [],
    interactions: 243,
    logicalOperations: {
      answerModel: 3,
      provider: 30,
      reducer: 27,
      tools: 2,
    },
    modelTurns: [
      functionTurn(1, 'wrong words'),
      functionTurn(2, 'violet'),
      finalTurn(3, answer),
    ],
    quarantinedUnits: [],
    quarantineStats: {
      categories: [],
      count: 0,
      predictionMiss: false,
    },
    questionId:
      liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID,
    rawTurns: 484,
    reducerEvidence: Array.from({ length: 27 }, (_, index) => ({
      dispatch: index + 1,
      evidenceIds: [`evidence-${index + 1}`],
      modelVersion:
        liveConfig.EXPLORATION_LONGMEMEVAL_MODELS.reducer,
      operationId:
        `question:${liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID}:reducer:${index + 1}`,
      requestSha256: HASH,
      responseSha256: HASH,
      status: 'validated',
    })),
    toolTranscript: [
      {
        input: { phrase: 'wrong words' },
        modelDispatch: 1,
        result: {
          matches: [],
          operation: 'memory_find',
        },
        tool: 'memory_find',
      },
      {
        input: { phrase: 'violet' },
        modelDispatch: 2,
        result: {
          matches: [{
            evidenceId: 'evidence-1',
            session: 'answer-session',
          }],
          operation: 'memory_find',
        },
        tool: 'memory_find',
      },
    ],
  }
}

function fakeAggregateJournal() {
  const checkpoints = []
  return {
    async onCheckpoint(checkpoint) {
      checkpoints.push(structuredClone(checkpoint))
    },
    snapshot() {
      const receiptManifest = checkpoints.map((_, index) => ({
        checkpointSha256: HASH,
        filename:
          `interaction-${String(index + 1).padStart(6, '0')}.receipt.json`,
        ordinal: index + 1,
        receiptSha256: HASH,
      }))
      return {
        checkpoints: structuredClone(checkpoints),
        completedInteraction: checkpoints.length,
        lastReceiptSha256:
          receiptManifest.at(-1)?.receiptSha256 ?? null,
        questionId:
          liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID,
        receiptManifest,
        runId: liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
        schemaVersion:
          'palari-incremental-checkpoint-aggregate/v1',
      }
    },
  }
}

function loadedContract(root, dispatchAuthorized = true) {
  return {
    authority: {
      dispatchAuthorized,
      exactCapConfirmationRequired: !dispatchAuthorized,
      runId: liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
    },
    authorityPath: join(root, 'authority.json'),
    authoritySha256: '1'.repeat(64),
    config: {
      artifacts: [],
      dataset: { path: 'data/frozen.json' },
      models: liveConfig.EXPLORATION_LONGMEMEVAL_MODELS,
      productCommit:
        liveConfig.EXPLORATION_LONGMEMEVAL_PRODUCT_COMMIT,
      runDate: liveConfig.EXPLORATION_LONGMEMEVAL_RUN_DATE,
      runId: liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
    },
    configPath: join(root, 'config.json'),
    configSha256: '2'.repeat(64),
    predictions: {
      predictions:
        liveConfig.EXPLORATION_LONGMEMEVAL_EXPECTED_PREDICTIONS,
    },
    predictionsPath: join(root, 'predictions.json'),
    predictionsSha256: '3'.repeat(64),
  }
}

test('preparation identity is open exactly once and argument-pinned',
  () => {
    assert.deepEqual(EXPLORATION_LONGMEMEVAL_TERMINAL_RUN_IDS, [])
    assert.equal(
      parseExplorationLongMemEvalArgs([
        '--run',
        liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
      ]),
      liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
    )
    assert.equal(
      assertExplorationLongMemEvalOpen(
        liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
      ),
      liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
    )
    assert.throws(
      () => parseExplorationLongMemEvalArgs([
        '--run',
        'question-2',
      ]),
      (error) => error.code === 'RUN_ID_REQUIRED',
    )
  })

test('successful answer evidence survives a terminal judge failure',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-exploration-judge-failure-'),
    )
    const journal = fakeAggregateJournal()
    const gemini = fakeGeminiTransport()
    const judge = fakeJudgeTransport({ failCall: true })
    try {
      await assert.rejects(
        main({
          args: [
            '--run',
            liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
          ],
          dependencies: {
            async assertEnvironment() {
              return {
                geminiApiKey: 'fake-gemini-secret',
                openaiApiKey: 'fake-openai-secret',
              }
            },
            async auditArtifacts() {
              return {
                artifacts: 0,
                artifactSetSha256: HASH,
              }
            },
            async auditTrackedFiles() {
              return { files: 1, trackedPathsSha256: HASH }
            },
            async createCheckpointJournal() {
              return journal
            },
            async createGeminiTransport() {
              return gemini
            },
            async createJudgeTransport() {
              return judge
            },
            async inspectGitCutPoint() {
              return { administrativeHead: '4'.repeat(40) }
            },
            async loadContract() {
              return loadedContract(root)
            },
            async preparePopulation() {
              return {}
            },
            async readFile() {
              return Buffer.from('frozen dataset')
            },
            async runQuestion({
              mode,
              onCheckpoint,
              onExplorationCheckpoint,
            }) {
              assert.equal(mode, 'exploration')
              for (let index = 0; index < 243; index += 1) {
                await onCheckpoint({
                  completedInteraction: index + 1,
                  digest: {
                    pending: index === 242 ? 0 : 1,
                    ready: index === 242,
                  },
                  interactionCount: 243,
                  quarantinedUnits: [],
                  reducerDispatches: Math.min(
                    27,
                    Math.ceil((index + 1) / 9),
                  ),
                  status: 'completed',
                  unitOrder: index + 1,
                })
              }
              const result = fakeArmResult()
              await onExplorationCheckpoint({
                answerModelDispatches: 3,
                explorationCalls: 2,
                explorationExhausted: false,
                modelTurns: result.modelTurns,
                phase: 'model_turn',
                questionId:
                  liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID,
                toolTranscript: result.toolTranscript,
              })
              return result
            },
            selectPopulation() {
              return {
                instance: {
                  answer: 'violet',
                  answerSessionIds: ['answer-session'],
                  isAbstention: false,
                  question: 'What was recorded?',
                  questionId:
                    liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID,
                  questionType: 'knowledge-update',
                },
                normalized: '{}\n',
                stats: { interactions: 243 },
              }
            },
            async verifyPredecessor() {
              return {
                accountedUsd:
                  liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
                    .accountedUsd,
              }
            },
            now: (() => {
              let tick = 0
              return () =>
                new Date(Date.UTC(
                  2026,
                  6,
                  26,
                  1,
                  0,
                  tick++,
                )).toISOString()
            })(),
            log() {},
          },
          env: {},
          repoRoot: root,
        }),
        (error) => error.code === 'OFFLINE_JUDGE_FAILURE',
      )
      const paths = explorationLongMemEvalResultPaths(root)
      const questionResult = JSON.parse(await readFile(
        paths.questionResultPath,
        'utf8',
      ))
      assert.equal(
        questionResult.arm.answer,
        'The recorded answer was violet.',
      )
      assert.equal(questionResult.judge, null)
      const runState = JSON.parse(await readFile(
        paths.runStatePath,
        'utf8',
      ))
      assert.equal(runState.status, 'failed')
      assert.equal(runState.judge.status, 'failed')
      const manifest = JSON.parse(await readFile(
        paths.artifactManifestPath,
        'utf8',
      ))
      assert.ok(manifest.artifacts.some(({ path }) =>
        path === 'question-result.json' ||
        path.endsWith('/question-result.json')))
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('tracked pending authority blocks before any credential read',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-exploration-pending-'),
    )
    let environmentReads = 0
    try {
      await assert.rejects(
        main({
          args: [
            '--run',
            liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
          ],
          dependencies: {
            async loadContract() {
              return loadedContract(root, false)
            },
          },
          env: new Proxy({}, {
            get() {
              environmentReads += 1
              throw new Error('credential environment was read')
            },
          }),
          repoRoot: root,
        }),
        (error) =>
          error.code === 'FOUNDER_CAP_CONFIRMATION_REQUIRED',
      )
      assert.equal(environmentReads, 0)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

test('actual constructor accepts batch writer and all native tool bindings',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-exploration-constructor-'),
    )
    const transcriptDirectory = join(root, 'transcripts')
    await mkdir(transcriptDirectory, { mode: 0o700 })
    let fetchCalls = 0
    const fetchImpl = async () => {
      fetchCalls += 1
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: '{}' }],
            role: 'model',
          },
          finishReason: 'STOP',
        }],
        modelVersion:
          liveConfig.EXPLORATION_LONGMEMEVAL_MODELS.reducer,
        usageMetadata: {
          candidatesTokenCount: 1,
          promptTokenCount: 10,
          serviceTier: 'standard',
          totalTokenCount: 11,
        },
      }), {
        headers: {
          'content-type': 'application/json',
          'x-gemini-service-tier': 'standard',
        },
        status: 200,
      })
    }
    let transport
    try {
      transport =
        await createIncrementalLongMemEvalGeminiTransport({
          cumulativeCapUsd: 8,
          explorationGeneration:
            INCREMENTAL_LONGMEMEVAL_EXPLORATION_GENERATION,
          explorationSystemInstruction:
            INCREMENTAL_LONGMEMEVAL_EXPLORATION_SYSTEM_INSTRUCTION,
          explorationToolConfig:
            INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOL_CONFIG,
          explorationTools:
            INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS,
          fetchImpl,
          freshSubcapUsd:
            liveConfig.EXPLORATION_LONGMEMEVAL_HARD_CAP
              .freshSubcapUsd,
          geminiApiKey: 'offline-fake-key',
          journalPath: join(root, 'meter.jsonl'),
          openingAccountedUsd:
            liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
              .accountedUsd,
          transcriptDirectory,
          writerGeneration:
            INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCER_GENERATION,
        })
      transport.installNetworkGuard()
      const response = await transport.callGemini({
        body: {
          contents: [{
            parts: [{ text: '{}' }],
            role: 'user',
          }],
          generationConfig:
            structuredClone(
              INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCER_GENERATION,
            ),
          store: false,
          systemInstruction: {
            parts: [{ text: 'offline reducer contract' }],
          },
        },
        cellId: liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID,
        operationId:
          `question:${liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID}:reducer:1`,
        purpose: 'writer',
      })
      assert.equal(response.validated, true)
      assert.equal(fetchCalls, 1)
      assert.equal(
        (await transport.snapshot()).logicalRequests.writer,
        1,
      )
      const verified = await transport.verify()
      assert.equal(Object.hasOwn(verified, 'ledger'), false)
      assert.deepEqual(
        verified.meter,
        await transport.snapshot(),
      )
      assert.equal(verified.transcripts.attempts, 1)
    } finally {
      transport?.closeNetworkGuard()
      await rm(root, { force: true, recursive: true })
    }
  })

test('mocked execution checkpoints 243 interactions, judges once, stops',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-exploration-runner-'),
    )
    const journal = fakeAggregateJournal()
    const gemini = fakeGeminiTransport()
    const judge = fakeJudgeTransport()
    let judgeFactoryFreshSpend = null
    try {
      const output = await main({
        args: [
          '--run',
          liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
        ],
        dependencies: {
          async assertEnvironment() {
            return {
              geminiApiKey: 'fake-gemini-secret',
              openaiApiKey: 'fake-openai-secret',
            }
          },
          async auditArtifacts() {
            return {
              artifacts: 0,
              artifactSetSha256: HASH,
            }
          },
          async auditTrackedFiles() {
            return { files: 1, trackedPathsSha256: HASH }
          },
          async createCheckpointJournal() {
            return journal
          },
          async createGeminiTransport(options) {
            assert.deepEqual(
              options.writerGeneration,
              INCREMENTAL_LONGMEMEVAL_EXPLORATION_REDUCER_GENERATION,
            )
            assert.deepEqual(
              options.explorationTools,
              INCREMENTAL_LONGMEMEVAL_EXPLORATION_TOOLS,
            )
            return gemini
          },
          async createJudgeTransport({ getFreshAccountedUsd }) {
            judgeFactoryFreshSpend =
              await getFreshAccountedUsd()
            return judge
          },
          async inspectGitCutPoint() {
            return { administrativeHead: '4'.repeat(40) }
          },
          async loadContract() {
            return loadedContract(root)
          },
          async preparePopulation() {
            return {}
          },
          async readFile() {
            return Buffer.from('frozen dataset')
          },
          async runQuestion({
            maxAnswerModelDispatches,
            maxExplorationCalls,
            maxInteractionsPerCall,
            maxReducerDispatches,
            mode,
            onCheckpoint,
            onExplorationCheckpoint,
            reduceEvery,
          }) {
            assert.equal(mode, 'exploration')
            assert.equal(maxAnswerModelDispatches, 7)
            assert.equal(maxExplorationCalls, 6)
            assert.equal(maxInteractionsPerCall, 20)
            assert.equal(maxReducerDispatches, 27)
            assert.equal(reduceEvery, 20)
            for (let index = 0; index < 243; index += 1) {
              await onCheckpoint({
                completedInteraction: index + 1,
                digest: {
                  pending: index === 242 ? 0 : 1,
                  ready: index === 242,
                },
                interactionCount: 243,
                quarantinedUnits: [],
                reducerDispatches:
                  Math.min(27, Math.ceil((index + 1) / 9)),
                status: 'completed',
                unitOrder: index + 1,
              })
            }
            const result = fakeArmResult()
            await onExplorationCheckpoint({
              answerModelDispatches: 3,
              explorationCalls: 2,
              explorationExhausted: false,
              modelTurns: result.modelTurns,
              phase: 'model_turn',
              questionId:
                liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID,
              toolTranscript: result.toolTranscript,
            })
            return result
          },
          selectPopulation() {
            return {
              instance: {
                answer: 'violet',
                answerSessionIds: ['answer-session'],
                isAbstention: false,
                question: 'What was recorded?',
                questionId:
                  liveConfig.EXPLORATION_LONGMEMEVAL_QUESTION_ID,
                questionType: 'knowledge-update',
                sessions: [],
              },
              normalized: '{}\n',
              stats: { interactions: 243 },
            }
          },
          async verifyPredecessor() {
            return {
              accountedUsd:
                liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
                  .accountedUsd,
              measuredUsd:
                liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
                  .measuredUsd,
              uncertainUsd:
                liveConfig.EXPLORATION_LONGMEMEVAL_OPENING_SPEND
                  .uncertainUsd,
            }
          },
          now: (() => {
            let tick = 0
            return () =>
              new Date(Date.UTC(2026, 6, 26, 0, 0, tick++))
                .toISOString()
          })(),
          log() {},
        },
        env: {},
        repoRoot: root,
      })
      assert.equal(judgeFactoryFreshSpend, 0.01)
      assert.equal(output.runState.status, 'complete')
      assert.equal(
        output.runState.invocations[0].question2Started,
        false,
      )
      assert.equal(
        output.grade.grades.every(
          ({ outcome }) => outcome === 'hit',
        ),
        true,
      )
      const paths = explorationLongMemEvalResultPaths(root)
      const terminal = JSON.parse(await readFile(
        paths.runStatePath,
        'utf8',
      ))
      assert.equal(terminal.status, 'complete')
      assert.equal(terminal.ingestion.interactionsCompleted, 243)
      assert.equal(
        JSON.parse(await readFile(
          paths.artifactManifestPath,
          'utf8',
        )).runId,
        liveConfig.EXPLORATION_LONGMEMEVAL_RUN_ID,
      )
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
