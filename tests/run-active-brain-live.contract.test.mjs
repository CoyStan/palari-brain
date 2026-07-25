import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import {
  ACTIVE_BRAIN_ANSWER_GENERATION,
  ACTIVE_BRAIN_GEMINI_MODEL,
  ACTIVE_BRAIN_LIVE_RUN_ID,
  ACTIVE_BRAIN_PREDECESSOR_CHAIN,
  ACTIVE_BRAIN_WRITER_GENERATION,
  activeBrainSha256,
} from '../evals/active-brain-live-config.mjs'
import {
  ACTIVE_BRAIN_TERMINAL_RUN_IDS,
  activeBrainFirstFivePopulation,
  activeBrainResultPaths,
  buildActiveBrainCheckpoint,
  buildActiveBrainIdentity,
  executeActiveBrainFirstFive,
  main,
  verifyActiveBrainFiveRunPredecessor,
} from '../evals/run-active-brain-live.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
} from '../evals/longmemeval-plan.mjs'
import {
  LONGMEMEVAL_JUDGE_MODEL,
} from '../evals/longmemeval-judge.mjs'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const SHA_C = 'c'.repeat(64)
const SHA_D = 'd'.repeat(64)

function instance(questionId, index = 0) {
  return {
    answer: 'tea',
    isAbstention: questionId.endsWith('_abs'),
    question: 'What does the user prefer?',
    questionId,
    questionType: 'single-session-preference',
    sessions: [{
      eventAt: '2026-01-01T00:00:00.000Z',
      sessionId: `session-${index + 1}`,
      turns: [{ content: 'I prefer tea.', role: 'user' }],
    }],
  }
}

function preparedPopulation() {
  const executionOrder = [
    ...J4_FIRST_TRANCHE_QUESTION_IDS.map(instance),
    ...Array.from({ length: 55 }, (_, index) =>
      instance(`fixture-${String(index + 6).padStart(2, '0')}`, index + 5)),
  ]
  return {
    executionOrder,
    manifest: { datasetSha256: SHA_B },
  }
}

function config() {
  return {
    artifacts: [],
    models: {
      answer: ACTIVE_BRAIN_GEMINI_MODEL,
      judge: LONGMEMEVAL_JUDGE_MODEL,
      writer: ACTIVE_BRAIN_GEMINI_MODEL,
    },
    population: { questionIdsSha256: SHA_D },
    predecessorChain: structuredClone(ACTIVE_BRAIN_PREDECESSOR_CHAIN),
    predictions: { path: 'predictions.json', sha256: SHA_C },
    prompts: {
      answerContractSha256: SHA_A,
      judgeSourceSha256: SHA_B,
      statementWriterContractSha256: SHA_C,
      statementWriterSchemaSha256: SHA_D,
    },
    runDate: '2026-07-25',
    runId: ACTIVE_BRAIN_LIVE_RUN_ID,
    tranches: [{ questions: 5 }],
  }
}

function predictions({ capacityFirst = false } = {}) {
  return {
    predictions: J4_FIRST_TRANCHE_QUESTION_IDS.map((questionId, index) => ({
      predictedFailureStage:
        capacityFirst && index === 0 ? 'capacity' : 'none',
      predictedOfficialCorrect: !(capacityFirst && index === 0),
      questionId,
    })),
  }
}

function identityFor(activeConfig = config()) {
  return buildActiveBrainIdentity({
    config: activeConfig,
    configSha256: SHA_A,
    datasetSha256: SHA_B,
    predictionsSha256: SHA_C,
  })
}

function zeroMeter() {
  return {
    accounted: {
      geminiInputTokens: 0,
      geminiOutputTokens: 0,
      judgeInputTokens: 0,
      judgeOutputTokens: 0,
      usd: 0,
    },
    attempts: 0,
    geminiModelVersion: null,
    logicalRequests: {},
    measured: {
      geminiInputTokens: 0,
      geminiOutputTokens: 0,
      judgeInputTokens: 0,
      judgeOutputTokens: 0,
      usd: 0,
    },
    retries: [],
    sequence: 0,
    uncertain: {
      geminiInputTokens: 0,
      geminiOutputTokens: 0,
      judgeInputTokens: 0,
      judgeOutputTokens: 0,
      usd: 0,
    },
  }
}

test('active runner import is inert', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'await import("./evals/run-active-brain-live.mjs")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('active result paths use the fresh results-root export', () => {
  const paths = activeBrainResultPaths('/tmp/palari-active-path-fixture')
  assert.equal(
    paths.runDir,
    '/tmp/palari-active-path-fixture/evals/results/' +
      ACTIVE_BRAIN_LIVE_RUN_ID,
  )
  assert.equal(
    paths.lockPath,
    '/tmp/palari-active-path-fixture/evals/results/' +
      `${ACTIVE_BRAIN_LIVE_RUN_ID}.lock`,
  )
})

test('terminal identities fail before dependencies and first-five excludes six',
  async () => {
    let dependencyReads = 0
    await assert.rejects(
      main({
        args: ['--run', ACTIVE_BRAIN_TERMINAL_RUN_IDS.at(-1)],
        dependencies: {
          readFile: async () => {
            dependencyReads += 1
            throw new Error('must not read')
          },
        },
      }),
      (error) => error.code === 'J4_RUN_TERMINAL',
    )
    assert.equal(dependencyReads, 0)

    const selected = activeBrainFirstFivePopulation(preparedPopulation())
    assert.deepEqual(
      selected.executionOrder.map((entry) => entry.questionId),
      J4_FIRST_TRANCHE_QUESTION_IDS,
    )
    assert.equal(selected.executionOrder[5], undefined)
  })

test('real V1-V5 predecessor verification accepts key-order differences',
  async (context) => {
    const repoRoot = resolve(new URL('..', import.meta.url).pathname)
    try {
      await access(join(
        repoRoot,
        'evals/results/j4-longmemeval-s60-v5/checkpoint.json',
      ))
    } catch (error) {
      if (error?.code === 'ENOENT') {
        context.skip('private V1-V5 evidence is not present in this clone')
        return
      }
      throw error
    }
    const audit = await verifyActiveBrainFiveRunPredecessor({
      predecessorChain: ACTIVE_BRAIN_PREDECESSOR_CHAIN,
      repoRoot,
    })
    assert.equal(audit.accountedUsd, 0.7721877)
    assert.equal(audit.runs.length, 5)
  })

test('main passes only active model and generation contracts to the meter',
  async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'palari-active-main-'))
    const activeConfig = config()
    const population = preparedPopulation()
    const predictionBank = predictions()
    let meterOptions
    const transport = {
      closeNetworkGuard() {},
      installNetworkGuard() {},
    }
    try {
      const result = await main({
        args: ['--run', ACTIVE_BRAIN_LIVE_RUN_ID],
        dependencies: {
          assertEnvironment: () => ({
            capUsd: 7,
            geminiApiKey: 'fake-gemini-key',
            openaiApiKey: 'fake-openai-key',
          }),
          auditTrackedFiles: async () => ({ files: 0 }),
          createMeteredTransport: async (options) => {
            meterOptions = options
            return transport
          },
          executeTranche: async () => ({
            checkpoint: {},
            report: { completedQuestions: 5 },
          }),
          exists: async () => false,
          inspectGitCutPoint: async () => ({
            administrativeHead: 'fixture-head',
          }),
          loadAuthority: async () => ({
            authority: {
              cumulativeCapUsd: 7,
              cumulativeQuestions: 5,
              fromCumulativeQuestions: 0,
              previousCheckpointSha256: null,
              runId: ACTIVE_BRAIN_LIVE_RUN_ID,
            },
            authorityPath: 'authority.json',
            authoritySha256: SHA_D,
          }),
          loadConfig: async () => ({
            config: activeConfig,
            configPath: 'config.json',
            configSha256: SHA_A,
            predictions: predictionBank,
            predictionsSha256: SHA_C,
          }),
          log() {},
          preparePopulation: () => population,
          readFile: async () => Buffer.from('fixture'),
          verifyPredecessor: async () => ({
            accountedUsd: 0.7721877,
            measuredUsd: 0.7696867,
            runs: [],
            uncertainUsd: 0.002501,
          }),
        },
        env: {},
        repoRoot,
      })
      assert.equal(result.report.completedQuestions, 5)
      assert.equal(meterOptions.geminiModel, ACTIVE_BRAIN_GEMINI_MODEL)
      assert.deepEqual(
        meterOptions.writerGeneration,
        ACTIVE_BRAIN_WRITER_GENERATION,
      )
      assert.deepEqual(
        meterOptions.answerGeneration,
        ACTIVE_BRAIN_ANSWER_GENERATION,
      )
    } finally {
      await rm(repoRoot, { force: true, recursive: true })
    }
  })

test('capacity is graded once, checkpointed, and pauses before question two',
  async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'palari-active-capacity-'))
    const paths = activeBrainResultPaths(repoRoot)
    const population = activeBrainFirstFivePopulation(preparedPopulation())
    const activeConfig = config()
    const identity = identityFor(activeConfig)
    const checkpoint = buildActiveBrainCheckpoint({
      identity,
      population,
      predictions: predictions({ capacityFirst: true }),
    })
    checkpoint.predecessorAudit = {
      accountedUsd: 0.7721877,
      measuredUsd: 0.7696867,
      uncertainUsd: 0.002501,
    }
    const before = zeroMeter()
    const after = {
      accounted: {
        geminiInputTokens: 10,
        geminiOutputTokens: 2,
        judgeInputTokens: 10,
        judgeOutputTokens: 1,
        usd: 0.001,
      },
      attempts: 2,
      geminiModelVersion: `${ACTIVE_BRAIN_GEMINI_MODEL}-001`,
      logicalRequests: { judge: 1, writer: 1 },
      measured: {
        geminiInputTokens: 10,
        geminiOutputTokens: 2,
        judgeInputTokens: 10,
        judgeOutputTokens: 1,
        usd: 0.001,
      },
      retries: [],
      sequence: 4,
      uncertain: {
        geminiInputTokens: 0,
        geminiOutputTokens: 0,
        judgeInputTokens: 0,
        judgeOutputTokens: 0,
        usd: 0,
      },
    }
    let state = before
    let questionCalls = 0
    let judgeCalls = 0
    const transport = {
      async callJudge() {
        judgeCalls += 1
        state = after
        return {
          finishReason: 'stop',
          modelVersion: LONGMEMEVAL_JUDGE_MODEL,
          text: 'no',
          usage: {
            geminiInputTokens: 0,
            geminiOutputTokens: 0,
            judgeInputTokens: 10,
            judgeOutputTokens: 1,
            usd: 0.000035,
          },
          usageDetails: {},
          validated: true,
        }
      },
      async snapshot() {
        return structuredClone(state)
      },
      async verify() {
        return {
          ledger: structuredClone(state),
          transcripts: { attempts: state.attempts },
        }
      },
    }
    await mkdir(paths.runDir, { mode: 0o700, recursive: true })
    try {
      const execution = await executeActiveBrainFirstFive({
        administrativeHead: 'fixture-head',
        authority: {
          cumulativeCapUsd: 7,
          cumulativeQuestions: 5,
          fromCumulativeQuestions: 0,
          previousCheckpointSha256: null,
          runId: ACTIVE_BRAIN_LIVE_RUN_ID,
        },
        authoritySha256: SHA_D,
        checkpoint,
        config: activeConfig,
        forbiddenSecrets: [],
        identity,
        paths,
        population,
        runQuestion: async () => {
          questionCalls += 1
          return {
            answer: 'Memory capacity exceeded; no partial context supplied.',
            answerModelVersion: null,
            briefing: {
              complete: false,
              status: 'capacity_exceeded',
            },
            ingest: { exchanges: 1, memoryRows: 1 },
            memoryEvidence: {},
            promptSha256: null,
            providerCalled: false,
            retrieval: { complete: { all: true } },
            sourceCoverage: {},
          }
        },
        runSmoke: async () => ({
          geminiModelVersion: `${ACTIVE_BRAIN_GEMINI_MODEL}-001`,
          logicalOperations: 2,
        }),
        transport,
      })
      assert.equal(questionCalls, 1)
      assert.equal(judgeCalls, 1)
      assert.equal(execution.checkpoint.status, 'paused')
      assert.equal(
        execution.checkpoint.pauseReason,
        'MEMORY_CAPACITY_EXCEEDED',
      )
      assert.equal(execution.checkpoint.questions[0].status, 'completed')
      assert.equal(execution.checkpoint.questions[1].status, 'pending')
      assert.deepEqual(
        execution.report.provenance,
        identity.provenance,
      )
      const result = JSON.parse(await readFile(
        join(paths.runDir, execution.checkpoint.questions[0].resultFile),
        'utf8',
      ))
      assert.equal(result.providerCalled, false)
      assert.equal(result.observedFailureStage, 'capacity')
      assert.deepEqual(result.provenance, identity.provenance)
    } finally {
      await rm(repoRoot, { force: true, recursive: true })
    }
  })

test('full executor completes exactly five, never six, with validated hashes',
  async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'palari-active-five-'))
    const paths = activeBrainResultPaths(repoRoot)
    const population = activeBrainFirstFivePopulation(preparedPopulation())
    const activeConfig = config()
    const identity = identityFor(activeConfig)
    const checkpoint = buildActiveBrainCheckpoint({
      identity,
      population,
      predictions: predictions(),
    })
    checkpoint.predecessorAudit = {
      accountedUsd: 0.7721877,
      measuredUsd: 0.7696867,
      uncertainUsd: 0.002501,
    }
    const state = zeroMeter()
    state.geminiModelVersion = `${ACTIVE_BRAIN_GEMINI_MODEL}-001`
    let questionCalls = 0
    let judgeCalls = 0

    function addMeasured({
      geminiInputTokens = 0,
      geminiOutputTokens = 0,
      judgeInputTokens = 0,
      judgeOutputTokens = 0,
      purposeCounts,
      usd,
    }) {
      for (const target of [state.accounted, state.measured]) {
        target.geminiInputTokens += geminiInputTokens
        target.geminiOutputTokens += geminiOutputTokens
        target.judgeInputTokens += judgeInputTokens
        target.judgeOutputTokens += judgeOutputTokens
        target.usd += usd
      }
      for (const [purpose, count] of Object.entries(purposeCounts)) {
        state.logicalRequests[purpose] =
          Number(state.logicalRequests[purpose] ?? 0) + count
        state.attempts += count
        state.sequence += count * 2
      }
    }

    const transport = {
      async callJudge() {
        judgeCalls += 1
        addMeasured({
          judgeInputTokens: 10,
          judgeOutputTokens: 1,
          purposeCounts: { judge: 1 },
          usd: 0.0001,
        })
        return {
          finishReason: 'stop',
          modelVersion: LONGMEMEVAL_JUDGE_MODEL,
          text: 'yes',
          usage: {
            geminiInputTokens: 0,
            geminiOutputTokens: 0,
            judgeInputTokens: 10,
            judgeOutputTokens: 1,
            usd: 0.0001,
          },
          usageDetails: {},
          validated: true,
        }
      },
      async snapshot() {
        return structuredClone(state)
      },
      async verify() {
        return {
          ledger: structuredClone(state),
          transcripts: { attempts: state.attempts },
        }
      },
    }
    await mkdir(paths.runDir, { mode: 0o700, recursive: true })
    try {
      const execution = await executeActiveBrainFirstFive({
        administrativeHead: 'fixture-head',
        authority: {
          cumulativeCapUsd: 7,
          cumulativeQuestions: 5,
          fromCumulativeQuestions: 0,
          previousCheckpointSha256: null,
          runId: ACTIVE_BRAIN_LIVE_RUN_ID,
        },
        authoritySha256: SHA_D,
        checkpoint,
        config: activeConfig,
        forbiddenSecrets: [],
        identity,
        paths,
        population,
        runQuestion: async ({ instance: current }) => {
          questionCalls += 1
          assert.equal(
            current.questionId,
            J4_FIRST_TRANCHE_QUESTION_IDS[questionCalls - 1],
          )
          addMeasured({
            geminiInputTokens: 20,
            geminiOutputTokens: 4,
            purposeCounts: { answer: 1, writer: 1 },
            usd: 0.0002,
          })
          return {
            answer: 'tea',
            answerModelVersion: state.geminiModelVersion,
            briefing: { complete: true, status: 'complete' },
            ingest: { exchanges: 1, memoryRows: 1 },
            memoryEvidence: {},
            promptSha256: SHA_A,
            providerCalled: true,
            retrieval: { complete: { all: true } },
            sourceCoverage: {},
          }
        },
        runSmoke: async () => ({
          geminiModelVersion: state.geminiModelVersion,
          logicalOperations: 2,
        }),
        transport,
      })
      assert.equal(questionCalls, 5)
      assert.equal(judgeCalls, 5)
      assert.equal(execution.checkpoint.status, 'complete')
      assert.equal(execution.report.completedQuestions, 5)
      assert.deepEqual(execution.report.provenance, identity.provenance)
      assert.equal(
        execution.checkpoint.questions.some((cell) =>
          cell.questionId === population.executionOrder[5]?.questionId),
        false,
      )
      for (const cell of execution.checkpoint.questions) {
        assert.equal(cell.status, 'completed')
        const text = await readFile(join(paths.runDir, cell.resultFile), 'utf8')
        assert.equal(activeBrainSha256(text), cell.resultSha256)
        assert.deepEqual(JSON.parse(text).provenance, identity.provenance)
      }
    } finally {
      await rm(repoRoot, { force: true, recursive: true })
    }
  })
