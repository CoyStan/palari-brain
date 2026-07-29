import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import test from 'node:test'

import * as first5Config from '../evals/canonical-first5-live-config.mjs'
import {
  CANONICAL_FIRST5_RUN_ID,
  CANONICAL_FIRST5_TERMINAL_RUN_IDS,
  assertCanonicalFirst5Open,
  auditCanonicalFirst5TrackedArtifacts,
  buildCanonicalFirst5Checkpoint,
  buildCanonicalFirst5Identity,
  canonicalFirstFivePopulation,
  canonicalFirst5ResultPaths,
  createCanonicalFirst5GeminiCaller,
  executeCanonicalFirstFive,
  main,
  verifyCanonicalFirst5Predecessor,
  writeCanonicalFirst5UnmeteredFailureArtifacts,
} from '../evals/run-canonical-first5-live.mjs'
import {
  LONGMEMEVAL_JUDGE_MODEL,
} from '../evals/longmemeval-judge.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
} from '../evals/longmemeval-plan.mjs'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const SHA_C = 'c'.repeat(64)
const SHA_D = 'd'.repeat(64)

function instance(questionId, index = 0) {
  return {
    answer: 'tea',
    answerSessionIds: [`session-${index + 1}`],
    isAbstention: questionId.endsWith('_abs'),
    question: 'What does the user prefer?',
    questionDate: '2026-01-02T00:00:00.000Z',
    questionId,
    questionType: 'single-session-preference',
    sessions: [{
      eventAt: '2026-01-01T00:00:00.000Z',
      sessionId: `session-${index + 1}`,
      turns: [
        { content: 'I prefer tea.', role: 'user' },
        { content: 'I will remember that.', role: 'assistant' },
      ],
    }],
  }
}

function preparedPopulation() {
  return {
    executionOrder: [
      ...J4_FIRST_TRANCHE_QUESTION_IDS.map(instance),
      ...Array.from({ length: 55 }, (_, index) =>
        instance(`fixture-${index + 6}`, index + 5)),
    ],
    manifest: { datasetSha256: SHA_B },
  }
}

function predecessor() {
  return {
    administrativeHead:
      '5bd8a27350145480a5ee9656d240b5147fb652b1',
    cumulativeAccountedUsd: 0.7727998,
    cumulativeMeasuredUsd: 0.7702988,
    cumulativeUncertainUsd: 0.002501,
    currentRunAccountedUsd: 0.0003003,
    openingAccountedUsd: 0.7724995,
    private: {
      checkpoint: {
        path:
          'evals/results/j4-active-brain-canonical-smoke-v1/checkpoint.json',
        sha256:
          '093c6c3b8aa57c8465b62624593434a4bfc86d8143b15878dfe76cd479911046',
      },
      manifest: {
        path:
          'evals/results/j4-active-brain-canonical-smoke-v1/artifact-manifest.json',
        sha256:
          'be1eac7ffa17653df5a720bfb4bf2eaef05ae477df7d2f9bcf2e4c77b9644b56',
      },
      meter: {
        path:
          'evals/results/j4-active-brain-canonical-smoke-v1/meter.jsonl',
        sha256:
          '234073fef643402ba4ad7d7a999b96c2684f5ed9010baed0206d4f44d52f50f1',
      },
    },
    runId: 'j4-active-brain-canonical-smoke-v1',
    tracked: {
      authority: {
        path:
          'evals/live-runs/j4-active-brain-canonical-smoke-v1.authority.json',
        sha256:
          'c70f45de2d3efdeceaab7008d1c6d6e5a34c8f8bebb77d7074d861aaa8d7357f',
      },
      config: {
        path:
          'evals/live-runs/j4-active-brain-canonical-smoke-v1.json',
        sha256:
          '28419934b34635770474aa61e156c8d2038c4a89dd858554f5029d1ce22b502c',
      },
      predictions: {
        path:
          'evals/predictions/j4-active-brain-canonical-smoke-v1.json',
        sha256:
          '1d840005849d3c58a6f523fa8cff66ba2a2fcefaf409ab1b24cb611c2a89ab2c',
      },
    },
  }
}

function config() {
  return {
    artifacts: [],
    dataset: {
      path: 'data/longmemeval_s_cleaned.json',
      sha256: SHA_C,
    },
    models: {
      answer: 'gemini-3.5-flash-lite',
      judge: LONGMEMEVAL_JUDGE_MODEL,
      writer: null,
    },
    population: { questionIdsSha256: SHA_D },
    predecessor: predecessor(),
    productCommit: SHA_A,
    prompts: {
      answerContractSha256: SHA_A,
      judgeSourceSha256: SHA_B,
    },
    runDate: '2026-07-25',
    runId: CANONICAL_FIRST5_RUN_ID,
  }
}

function predictions({ capacityFirst = false } = {}) {
  return {
    predictions: J4_FIRST_TRANCHE_QUESTION_IDS.map(
      (questionId, index) => ({
        predictedFailureStage:
          capacityFirst && index === 0 ? 'capacity' : 'none',
        predictedOfficialCorrect: !(capacityFirst && index === 0),
        questionId,
      }),
    ),
  }
}

function identity(activeConfig = config()) {
  return buildCanonicalFirst5Identity({
    artifactAudit: { artifactSetSha256: SHA_D },
    authoritySha256: SHA_A,
    config: activeConfig,
    configSha256: SHA_B,
    datasetSha256: SHA_C,
    predictionsSha256: SHA_D,
  })
}

function zeroUsage() {
  return {
    geminiInputTokens: 0,
    geminiOutputTokens: 0,
    judgeInputTokens: 0,
    judgeOutputTokens: 0,
    usd: 0,
  }
}

function zeroMeter() {
  return {
    accounted: zeroUsage(),
    attempts: 0,
    geminiModelVersion: null,
    logicalRequests: {},
    measured: zeroUsage(),
    retries: [],
    sequence: 0,
    uncertain: zeroUsage(),
  }
}

function addMeasured(state, purpose) {
  const usage = purpose === 'answer'
    ? {
        geminiInputTokens: 20,
        geminiOutputTokens: 4,
        judgeInputTokens: 0,
        judgeOutputTokens: 0,
        usd: 0.000016,
      }
    : {
        geminiInputTokens: 0,
        geminiOutputTokens: 0,
        judgeInputTokens: 10,
        judgeOutputTokens: 1,
        usd: 0.000035,
      }
  for (const target of [state.accounted, state.measured]) {
    for (const [field, value] of Object.entries(usage)) {
      target[field] += value
    }
  }
  state.logicalRequests[purpose] =
    Number(state.logicalRequests[purpose] ?? 0) + 1
  state.attempts += 1
  state.sequence += 2
}

function judgeResponse(text = 'yes') {
  return {
    finishReason: 'stop',
    modelVersion: LONGMEMEVAL_JUDGE_MODEL,
    text,
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
}

function completeArmResult({
  providerCalled = true,
  status = 'included',
} = {}) {
  const capacity = status === 'capacity_exceeded'
  return {
    answer: capacity
      ? 'I could not safely check every stored statement because the configured memory context is too small.'
      : 'tea',
    answerModelVersion: providerCalled
      ? 'gemini-3.5-flash-lite'
      : null,
    answerProviderCalled: providerCalled,
    answerRequestSha256: providerCalled ? SHA_A : null,
    briefing: {
      complete: !capacity,
      status,
    },
    exchangePlanSha256: SHA_B,
    ingest: { memoryRows: 2 },
    memoryEvidence: [],
    memoryEvidenceSha256: SHA_C,
    promptSha256: providerCalled ? SHA_D : null,
    providerCalled,
    retrieval: { complete: { all: true } },
    sourceCoverage: {},
    writerProviderCalls: 0,
  }
}

function authority() {
  return {
    cumulativeCapUsd: 7,
    freshSubcapUsd: 1,
    questions: 5,
    runId: CANONICAL_FIRST5_RUN_ID,
    writerEnabled: false,
  }
}

test('canonical first-five runner import is inert', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'await import("./evals/run-canonical-first5-live.mjs")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('explicit pre-run artifact audit rejects changed bytes', async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'palari-canonical-first5-artifact-'),
  )
  try {
    const path = join(root, 'runtime.mjs')
    await writeFile(path, 'export const frozen = true\n')
    const bytes = await readFile(path)
    const frozen = {
      artifacts: [{
        path: 'runtime.mjs',
        sha256: first5Config.canonicalFirst5Sha256(bytes),
      }],
    }
    const audit = await auditCanonicalFirst5TrackedArtifacts({
      config: frozen,
      repoRoot: root,
    })
    assert.equal(audit.artifacts, 1)

    await writeFile(path, 'export const frozen = false\n')
    await assert.rejects(
      auditCanonicalFirst5TrackedArtifacts({
        config: frozen,
        repoRoot: root,
      }),
      (error) => error?.code === 'FIRST5_ARTIFACT_CHANGED',
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('frozen first-five identity rejects the successor digest graph',
  async () => {
    const config = JSON.parse(await readFile(resolve(
      repoRoot,
      first5Config.CANONICAL_FIRST5_CONFIG_PATH,
    )))
    const pending = ['evals/run-canonical-first5-live.mjs']
    const reachable = new Set()
    while (pending.length) {
      const repositoryPath = pending.shift()
      if (reachable.has(repositoryPath)) continue
      reachable.add(repositoryPath)
      const source = await readFile(
        resolve(repoRoot, repositoryPath),
        'utf8',
      )
      const specifiers = []
      for (const pattern of [
        /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g,
        /\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g,
      ]) {
        for (const match of source.matchAll(pattern)) {
          specifiers.push(match[1])
        }
      }
      for (const specifier of specifiers) {
        const absolute = resolve(
          repoRoot,
          dirname(repositoryPath),
          specifier,
        )
        if (!absolute.endsWith('.mjs')) continue
        const child = relative(repoRoot, absolute)
        if (!reachable.has(child)) pending.push(child)
      }
    }
    const pinned = new Set(
      config.artifacts.map((entry) => entry.path),
    )
    assert.deepEqual(
      [...reachable].filter((path) => !pinned.has(path)).sort(),
      [
        'src/memory-digest-store.mjs',
        'src/memory-exploration.mjs',
        'src/memory-reducer.mjs',
        // Ranked-search finding aid and quote-context guard: successor
        // modules by design, expected outside the sealed pin set.
        'src/memory-search.mjs',
        'src/quote-context.mjs',
      ],
    )
    await assert.rejects(
      first5Config.loadCanonicalFirst5LiveConfig({ repoRoot }),
      (error) => error?.code === 'CONFIG_SCHEMA_INVALID',
    )
  })

test('fresh paths and population expose exactly five non-U8 questions',
  () => {
    const paths = canonicalFirst5ResultPaths(
      '/tmp/palari-canonical-first5-fixture',
    )
    assert.equal(
      paths.runDir,
      '/tmp/palari-canonical-first5-fixture/evals/results/' +
        CANONICAL_FIRST5_RUN_ID,
    )
    const population =
      canonicalFirstFivePopulation(preparedPopulation())
    assert.deepEqual(
      population.executionOrder.map((entry) => entry.questionId),
      J4_FIRST_TRANCHE_QUESTION_IDS,
    )
    assert.equal(population.executionOrder.length, 5)
  })

test('effective Gemini wrapper denies writer before transport', async () => {
  let transportCalls = 0
  const callGemini = createCanonicalFirst5GeminiCaller(async () => {
    transportCalls += 1
    return {}
  })
  await assert.rejects(
    callGemini({ purpose: 'writer' }),
    (error) => error?.code === 'WRITER_DISABLED',
  )
  assert.equal(transportCalls, 0)
  await callGemini({ purpose: 'answer' })
  assert.equal(transportCalls, 1)
})

test('capacity question is judged once and pauses before question two',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-canonical-capacity-'),
    )
    const paths = canonicalFirst5ResultPaths(root)
    const population =
      canonicalFirstFivePopulation(preparedPopulation())
    const activeConfig = config()
    const checkpoint = buildCanonicalFirst5Checkpoint({
      identity: identity(activeConfig),
      population,
      predecessorAudit: {
        accountedUsd: 0.7727998,
        measuredUsd: 0.7702988,
        uncertainUsd: 0.002501,
      },
      predictions: predictions({ capacityFirst: true }),
    })
    const state = zeroMeter()
    let answerCalls = 0
    let judgeCalls = 0
    let questionCalls = 0
    const transport = {
      async callGemini() {
        answerCalls += 1
        throw new Error('capacity must not call Gemini')
      },
      async callJudge() {
        judgeCalls += 1
        addMeasured(state, 'judge')
        return judgeResponse('no')
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
    await mkdir(paths.runDir, { recursive: true, mode: 0o700 })
    try {
      const execution = await executeCanonicalFirstFive({
        administrativeHead: 'fixture-head',
        authority: authority(),
        authoritySha256: SHA_A,
        checkpoint,
        config: activeConfig,
        forbiddenSecrets: [],
        paths,
        population,
        runQuestion: async () => {
          questionCalls += 1
          return completeArmResult({
            providerCalled: false,
            status: 'capacity_exceeded',
          })
        },
        transport,
      })
      assert.equal(questionCalls, 1)
      assert.equal(answerCalls, 0)
      assert.equal(judgeCalls, 1)
      assert.equal(execution.checkpoint.status, 'paused')
      assert.equal(
        execution.checkpoint.pauseReason,
        'MEMORY_CAPACITY_EXCEEDED',
      )
      assert.equal(execution.checkpoint.questions[0].status, 'completed')
      assert.equal(execution.checkpoint.questions[1].status, 'pending')
      assert.equal(execution.report.writerProviderCalls, 0)
      const result = JSON.parse(await readFile(join(
        paths.runDir,
        execution.checkpoint.questions[0].resultFile,
      )))
      assert.equal(result.providerCalled, false)
      assert.equal(result.observedFailureStage, 'capacity')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

test('synthetic complete path runs five answers and judges but never six',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-canonical-five-'),
    )
    const paths = canonicalFirst5ResultPaths(root)
    const population =
      canonicalFirstFivePopulation(preparedPopulation())
    const activeConfig = config()
    const checkpoint = buildCanonicalFirst5Checkpoint({
      identity: identity(activeConfig),
      population,
      predecessorAudit: {
        accountedUsd: 0.7727998,
        measuredUsd: 0.7702988,
        uncertainUsd: 0.002501,
      },
      predictions: predictions(),
    })
    const state = zeroMeter()
    let answerCalls = 0
    let judgeCalls = 0
    let questionCalls = 0
    const transport = {
      async callGemini() {
        answerCalls += 1
        addMeasured(state, 'answer')
        state.geminiModelVersion = 'gemini-3.5-flash-lite'
        return {}
      },
      async callJudge() {
        judgeCalls += 1
        addMeasured(state, 'judge')
        return judgeResponse()
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
    await mkdir(paths.runDir, { recursive: true, mode: 0o700 })
    try {
      const execution = await executeCanonicalFirstFive({
        administrativeHead: 'fixture-head',
        authority: authority(),
        authoritySha256: SHA_A,
        checkpoint,
        config: activeConfig,
        forbiddenSecrets: [],
        paths,
        population,
        runQuestion: async ({ callGemini, instance: current }) => {
          questionCalls += 1
          assert.equal(
            current.questionId,
            J4_FIRST_TRANCHE_QUESTION_IDS[questionCalls - 1],
          )
          await callGemini({ purpose: 'answer' })
          return completeArmResult()
        },
        transport,
      })
      assert.equal(questionCalls, 5)
      assert.equal(answerCalls, 5)
      assert.equal(judgeCalls, 5)
      assert.equal(execution.checkpoint.status, 'complete')
      assert.equal(execution.report.completedQuestions, 5)
      assert.equal(execution.report.writerProviderCalls, 0)
      assert.equal(
        execution.checkpoint.questions.some((entry) =>
          entry.questionId === preparedPopulation()
            .executionOrder[5].questionId),
        false,
      )
      for (const cell of execution.checkpoint.questions) {
        assert.equal(cell.status, 'completed')
        const metadata = await lstat(join(
          paths.runDir,
          cell.resultFile,
        ))
        assert.equal(metadata.mode & 0o777, 0o600)
      }
      assert.equal(
        (await lstat(paths.runDir)).mode & 0o777,
        0o700,
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

test('canonical smoke predecessor verifies tracked, private, spend, and depth',
  async (context) => {
    try {
      await Promise.all([
        access(resolve(
          repoRoot,
          'evals/results/j4-active-brain-canonical-smoke-v1/checkpoint.json',
        )),
        access(resolve(
          repoRoot,
          'evals/live-runs/j4-active-brain-canonical-first5-v1.json',
        )),
      ])
    } catch (error) {
      if (error?.code === 'ENOENT') {
        context.skip(
          'frozen first-five config or private predecessor is absent',
        )
        return
      }
      throw error
    }
    const config = JSON.parse(await readFile(resolve(
      repoRoot,
      first5Config.CANONICAL_FIRST5_CONFIG_PATH,
    )))
    const audit = await verifyCanonicalFirst5Predecessor({
      config,
      repoRoot,
    })
    assert.deepEqual(
      {
        accountedUsd: audit.accountedUsd,
        measuredUsd: audit.measuredUsd,
        runId: audit.runId,
        uncertainUsd: audit.uncertainUsd,
      },
      {
        accountedUsd: 0.7727998,
        measuredUsd: 0.7702988,
        runId: 'j4-active-brain-canonical-smoke-v1',
        uncertainUsd: 0.002501,
      },
    )
  })

test('run identity is open only until the post-run seal', async () => {
  if (CANONICAL_FIRST5_TERMINAL_RUN_IDS.includes(
    CANONICAL_FIRST5_RUN_ID,
  )) {
    assert.throws(
      () => assertCanonicalFirst5Open(CANONICAL_FIRST5_RUN_ID),
      (error) => error?.code === 'J4_RUN_TERMINAL',
    )
    let dependencyReads = 0
    await assert.rejects(
      main({
        args: ['--run', CANONICAL_FIRST5_RUN_ID],
        dependencies: new Proxy({}, {
          get() {
            dependencyReads += 1
            throw new Error('terminal runner read a dependency')
          },
        }),
        env: new Proxy({}, {
          get() {
            throw new Error('terminal runner read environment')
          },
        }),
      }),
      (error) => error?.code === 'J4_RUN_TERMINAL',
    )
    assert.equal(dependencyReads, 0)
  } else {
    assert.equal(
      assertCanonicalFirst5Open(CANONICAL_FIRST5_RUN_ID),
      CANONICAL_FIRST5_RUN_ID,
    )
  }
})

test('main verifies the complete predecessor before reading provider keys',
  async () => {
    if (CANONICAL_FIRST5_TERMINAL_RUN_IDS.includes(
      CANONICAL_FIRST5_RUN_ID,
    )) {
      let reads = 0
      await assert.rejects(
        main({
          args: ['--run', CANONICAL_FIRST5_RUN_ID],
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
        (error) => error?.code === 'J4_RUN_TERMINAL',
      )
      assert.equal(reads, 0)
      return
    }
    const root = await mkdtemp(
      join(tmpdir(), 'palari-canonical-pre-key-'),
    )
    let environmentReads = 0
    let predecessorChecks = 0
    try {
      await assert.rejects(
        main({
          args: ['--run', CANONICAL_FIRST5_RUN_ID],
          dependencies: {
            async auditArtifacts() {
              return {
                artifacts: 0,
                artifactSetSha256: SHA_D,
              }
            },
            async inspectGitCutPoint() {
              return { administrativeHead: 'fixture-head' }
            },
            async loadAuthority() {
              return {
                authority: authority(),
                authorityPath: 'authority.json',
                authoritySha256: SHA_A,
              }
            },
            async loadConfig() {
              return {
                config: config(),
                configPath: 'config.json',
                configSha256: SHA_B,
                predictions: predictions({ capacityFirst: true }),
                predictionsPath: 'predictions.json',
                predictionsSha256: SHA_C,
              }
            },
            async verifyPredecessor() {
              predecessorChecks += 1
              const error = new Error('expected predecessor stop')
              error.code = 'EXPECTED_PREDECESSOR_STOP'
              throw error
            },
          },
          env: new Proxy({}, {
            get() {
              environmentReads += 1
              throw new Error('provider environment read too early')
            },
          }),
          repoRoot: root,
        }),
        (error) => error?.code === 'EXPECTED_PREDECESSOR_STOP',
      )
      assert.equal(predecessorChecks, 1)
      assert.equal(environmentReads, 0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

test('meter construction failure leaves a sealed private failure bundle',
  async () => {
    const root = await mkdtemp(
      join(tmpdir(), 'palari-canonical-meter-failure-'),
    )
    try {
      const paths = canonicalFirst5ResultPaths(root)
      await mkdir(paths.runDir, { recursive: true, mode: 0o700 })
      const checkpoint = buildCanonicalFirst5Checkpoint({
        identity: identity(),
        population: canonicalFirstFivePopulation(preparedPopulation()),
        predictions: predictions({ capacityFirst: true }),
        predecessorAudit: {
          accountedUsd: 0.7727998,
          measuredUsd: 0.7702988,
          uncertainUsd: 0.002501,
        },
      })
      checkpoint.status = 'failed'
      checkpoint.failedAt = '2026-07-25T00:00:00.000Z'
      checkpoint.failure = {
        code: 'EXPECTED_METER_CONSTRUCTION_STOP',
        message: 'expected meter construction stop',
      }
      await writeCanonicalFirst5UnmeteredFailureArtifacts({
        checkpoint,
        forbiddenSecrets: [],
        now: () => '2026-07-25T00:00:01.000Z',
        paths,
      })
      const stored = JSON.parse(
        await readFile(paths.checkpointPath, 'utf8'),
      )
      assert.equal(stored.status, 'failed')
      assert.equal(
        stored.failure.code,
        'EXPECTED_METER_CONSTRUCTION_STOP',
      )
      assert.ok(stored.questions.every((cell) =>
        cell.status === 'pending'))
      await Promise.all([
        access(paths.artifactManifestPath),
        access(paths.reportJsonPath),
        access(paths.reportMarkdownPath),
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
