import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  assertExplorationLongMemEvalEnvironment,
  EXPLORATION_LONGMEMEVAL_ARTIFACTS_PENDING,
  EXPLORATION_LONGMEMEVAL_AUTHORITY_PATH,
  EXPLORATION_LONGMEMEVAL_CONFIG_PATH,
  EXPLORATION_LONGMEMEVAL_DATASET,
  EXPLORATION_LONGMEMEVAL_EXPECTED_COST,
  EXPLORATION_LONGMEMEVAL_EXPECTED_PREDICTIONS,
  EXPLORATION_LONGMEMEVAL_HARD_CAP,
  EXPLORATION_LONGMEMEVAL_INSTANCE,
  EXPLORATION_LONGMEMEVAL_MODELS,
  EXPLORATION_LONGMEMEVAL_OPENING_SPEND,
  EXPLORATION_LONGMEMEVAL_POPULATION,
  EXPLORATION_LONGMEMEVAL_PREDICTIONS_PATH,
  EXPLORATION_LONGMEMEVAL_PRODUCT_COMMIT,
  EXPLORATION_LONGMEMEVAL_QUESTION_ID,
  EXPLORATION_LONGMEMEVAL_RUN_DATE,
  EXPLORATION_LONGMEMEVAL_RUN_ID,
  EXPLORATION_LONGMEMEVAL_SCOPE,
  loadExplorationLongMemEvalContract,
} from '../evals/exploration-longmemeval-live-config.mjs'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))

function usd(value) {
  return Number(value.toFixed(12))
}

test('config import is inert outside the repository and without credentials',
  async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'palari-exploration-import-'))
    const moduleUrl = pathToFileURL(join(
      repoRoot,
      'evals',
      'exploration-longmemeval-live-config.mjs',
    )).href
    try {
      const source = [
        'delete process.env.GEMINI_API_KEY',
        'delete process.env.OPENAI_API_KEY',
        'globalThis.fetch = async () => { throw new Error("NETWORK_USED") }',
        `const loaded = await import(${JSON.stringify(
          `${moduleUrl}?inert=${Date.now()}`,
        )})`,
        'if (!loaded.EXPLORATION_LONGMEMEVAL_RUN_ID) process.exit(2)',
      ].join(';')
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '--eval', source],
        {
          cwd,
          encoding: 'utf8',
          env: { PATH: process.env.PATH },
        },
      )
      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stdout, '')
    } finally {
      await rm(cwd, { force: true, recursive: true })
    }
  })

test('identity, dataset, instance, and exact one-question population are pinned',
  () => {
    assert.equal(
      EXPLORATION_LONGMEMEVAL_RUN_ID,
      'j4-active-brain-exploration-longmemeval-q1-v1',
    )
    assert.equal(EXPLORATION_LONGMEMEVAL_RUN_DATE, '2026-07-26')
    assert.equal(
      EXPLORATION_LONGMEMEVAL_PRODUCT_COMMIT,
      '068d7a2d4ec1e62d8689b889b9527ae4ad455748',
    )
    assert.equal(EXPLORATION_LONGMEMEVAL_QUESTION_ID, '08e075c7')
    assert.deepEqual(EXPLORATION_LONGMEMEVAL_DATASET, {
      path: 'data/longmemeval_s_cleaned.json',
      sha256:
        'd6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442',
    })
    assert.deepEqual(EXPLORATION_LONGMEMEVAL_INSTANCE, {
      normalizedBytes: 558_824,
      normalizedFormat: 'JSON.stringify(instance, null, 2) + newline',
      normalizedSha256:
        '7caf1c76b67ece61d747e829eb3b13bb3046d1101ae4320460cd7fdd2e817fb2',
      questionId: '08e075c7',
    })
    assert.deepEqual(EXPLORATION_LONGMEMEVAL_POPULATION, {
      exchangePlanSha256:
        '8441628945e6f6b0685f3b67ef6413a4a249ece8bbc9509af75e6849531c8be3',
      interactions: 243,
      sessions: 45,
      visibleCharacters: 497_983,
      visibleMessages: 484,
    })
    assert.deepEqual(EXPLORATION_LONGMEMEVAL_MODELS, {
      exploration: 'gemini-2.5-flash-lite',
      judge: 'gpt-4o-2024-08-06',
      reducer: 'gemini-2.5-flash-lite',
    })
  })

test('dispatch ceilings match cadence 20, six tools, and one judge', () => {
  assert.deepEqual(EXPLORATION_LONGMEMEVAL_SCOPE, {
    benchmarkQuestions: 1,
    comparisonOperations: 0,
    judgeOperations: 1,
    maxInteractionsPerReducerCall: 20,
    maximumExplorationModelDispatches: 7,
    maximumExplorationToolCalls: 6,
    maximumPhysicalDispatches: 35,
    maximumReducerDispatches: 27,
    question2Allowed: false,
    questionIds: ['08e075c7'],
    reduceEvery: 20,
    retryDispatches: 0,
  })
  assert.equal(
    EXPLORATION_LONGMEMEVAL_SCOPE.maximumPhysicalDispatches,
    EXPLORATION_LONGMEMEVAL_SCOPE.maximumReducerDispatches +
      EXPLORATION_LONGMEMEVAL_SCOPE.maximumExplorationModelDispatches +
      EXPLORATION_LONGMEMEVAL_SCOPE.judgeOperations,
  )
})

test('expected estimate is integer-reproducible and explicitly not a cap',
  () => {
    const { ingestion, exploration, judge } =
      EXPLORATION_LONGMEMEVAL_EXPECTED_COST
    assert.equal(
      ingestion.serializedRequestBytesByDispatch.reduce(
        (total, bytes) => total + bytes,
        0,
      ),
      ingestion.serializedRequestBytes,
    )
    assert.equal(
      ingestion.serializedRequestBytesByDispatch.reduce(
        (total, bytes) => total + Math.ceil(bytes / 4),
        0,
      ),
      ingestion.sumPerDispatchCeilBytesDivFour,
    )
    assert.equal(
      ingestion.sumPerDispatchCeilBytesDivFour +
        ingestion.reducerDispatches *
          ingestion.protocolTokensPerDispatch,
      ingestion.inputTokenHeuristic,
    )
    assert.equal(
      usd(ingestion.inputTokenHeuristic *
        ingestion.inputPriceUsdPerMillion / 1_000_000 +
      ingestion.outputTokens *
        ingestion.outputPriceUsdPerMillion / 1_000_000),
      ingestion.usd,
    )

    assert.equal(
      exploration.baseSerializedBytesPerTurn *
        exploration.modelDispatches +
      exploration.toolExchangeSerializedBytes *
        exploration.toolHistoryTriangularSum,
      exploration.serializedBytesAcrossTurns,
    )
    assert.equal(
      exploration.serializedBytesAcrossTurns / 4 +
        exploration.modelDispatches *
          exploration.protocolTokensPerDispatch,
      exploration.inputTokenHeuristic,
    )
    assert.equal(
      usd(exploration.inputTokenHeuristic *
        exploration.inputPriceUsdPerMillion / 1_000_000 +
      exploration.outputTokens *
        exploration.outputPriceUsdPerMillion / 1_000_000),
      exploration.usd,
    )

    assert.equal(
      Math.ceil(judge.serializedBodyBytes / 4) +
        judge.protocolTokens,
      judge.inputTokenHeuristic,
    )
    assert.equal(
      usd(judge.inputTokenHeuristic *
        judge.inputPriceUsdPerMillion / 1_000_000 +
      judge.outputTokens *
        judge.outputPriceUsdPerMillion / 1_000_000),
      judge.usd,
    )
    assert.equal(
      usd(ingestion.usd + exploration.usd + judge.usd),
      EXPLORATION_LONGMEMEVAL_EXPECTED_COST.freshUsd,
    )
    assert.equal(EXPLORATION_LONGMEMEVAL_EXPECTED_COST.guarantee, false)
    assert.ok(
      EXPLORATION_LONGMEMEVAL_EXPECTED_COST.freshUsd < 0.10,
    )
  })

test('full-window hard cap is exact and distinct from expected spend', () => {
  const reducerMaximum = usd(1_048_576 * 0.10 / 1_000_000 +
    2_000 * 0.40 / 1_000_000)
  const explorationMaximum = usd(1_048_576 * 0.10 / 1_000_000 +
    256 * 0.40 / 1_000_000)
  const judgeReservation = usd(128_000 * 4.25 / 1_000_000 +
    10 * 17 / 1_000_000)
  const freshMaximum = usd(
    27 * reducerMaximum +
    7 * explorationMaximum +
    judgeReservation,
  )

  assert.equal(reducerMaximum, 0.1056576)
  assert.equal(explorationMaximum, 0.10496)
  assert.equal(judgeReservation, 0.54417)
  assert.equal(freshMaximum, 4.1316452)
  assert.deepEqual(EXPLORATION_LONGMEMEVAL_HARD_CAP, {
    cumulativeCapUsd: 8,
    explorationSuccessMaximumUsd: 0.10496,
    freshSubcapUsd: 4.1316452,
    geminiPendingReservationUsd: 0.2359296,
    judgePendingReservationUsd: 0.54417,
    projectedCumulativeMaximumUsd: 4.9077534,
    reducerSuccessMaximumUsd: 0.1056576,
  })
  assert.equal(
    usd(EXPLORATION_LONGMEMEVAL_OPENING_SPEND.accountedUsd +
      EXPLORATION_LONGMEMEVAL_HARD_CAP.freshSubcapUsd),
    EXPLORATION_LONGMEMEVAL_HARD_CAP.projectedCumulativeMaximumUsd,
  )
  assert.ok(
    EXPLORATION_LONGMEMEVAL_HARD_CAP.projectedCumulativeMaximumUsd <
      EXPLORATION_LONGMEMEVAL_HARD_CAP.cumulativeCapUsd,
  )
  assert.ok(
    EXPLORATION_LONGMEMEVAL_HARD_CAP.freshSubcapUsd >
      EXPLORATION_LONGMEMEVAL_EXPECTED_COST.freshUsd,
  )
})

test('loader validates FINAL predictions and preserves the artifact stop',
  async () => {
    await assert.rejects(
      loadExplorationLongMemEvalContract({ repoRoot }),
      (error) => error?.code === 'ARTIFACT_HASHES_PENDING',
    )
    const loaded = await loadExplorationLongMemEvalContract({
      allowPendingArtifacts: true,
      repoRoot,
    })
    assert.equal(loaded.predictions.status, 'FINAL')
    assert.equal(loaded.predictions.noReroll, true)
    assert.deepEqual(loaded.config.executionLaw, {
      checkpointEveryCanonicalInteraction: true,
      noReroll: true,
      providerJournalEveryDispatch: true,
      publish: false,
      resultsGitignored: true,
      stopBeforeQuestion2: true,
    })
    assert.deepEqual(
      loaded.predictions.predictions,
      EXPLORATION_LONGMEMEVAL_EXPECTED_PREDICTIONS,
    )
    assert.deepEqual(
      loaded.config.artifacts,
      EXPLORATION_LONGMEMEVAL_ARTIFACTS_PENDING,
    )
    assert.equal(loaded.configPath, join(repoRoot,
      EXPLORATION_LONGMEMEVAL_CONFIG_PATH))
    assert.equal(loaded.predictionsPath, join(repoRoot,
      EXPLORATION_LONGMEMEVAL_PREDICTIONS_PATH))
    assert.equal(loaded.authorityPath, join(repoRoot,
      EXPLORATION_LONGMEMEVAL_AUTHORITY_PATH))
  })

test('pending authority refuses before credential fields are read',
  async () => {
    const loaded = await loadExplorationLongMemEvalContract({
      allowPendingArtifacts: true,
      repoRoot,
    })
    let keyReads = 0
    const env = {}
    for (const key of ['GEMINI_API_KEY', 'OPENAI_API_KEY']) {
      Object.defineProperty(env, key, {
        get() {
          keyReads += 1
          throw new Error('credential field was read')
        },
      })
    }
    assert.throws(
      () => assertExplorationLongMemEvalEnvironment(
        env,
        loaded.config,
        loaded.authority,
      ),
      (error) => error?.code === 'FOUNDER_CAP_CONFIRMATION_REQUIRED',
    )
    assert.equal(keyReads, 0)
    assert.equal(loaded.authority.dispatchAuthorized, false)
    assert.equal(loaded.authority.exactCapConfirmationRequired, true)
  })

test('activated gate still requires exact environment confirmations',
  async () => {
    const loaded = await loadExplorationLongMemEvalContract({
      allowPendingArtifacts: true,
      repoRoot,
    })
    const config = structuredClone(loaded.config)
    config.artifacts = [{
      path: 'evals/final-runtime-artifact.mjs',
      sha256: '0'.repeat(64),
    }]
    const authority = {
      ...loaded.authority,
      dispatchAuthorized: true,
      exactCapConfirmationRequired: false,
    }
    const env = {
      GEMINI_API_KEY: 'fake-gemini-key',
      OPENAI_API_KEY: 'fake-openai-key',
      PALARI_EXPLORATION_LONGMEMEVAL_CONFIRM_SPEND: '1',
      PALARI_EXPLORATION_LONGMEMEVAL_CUMULATIVE_CAP_USD: '8',
      PALARI_EXPLORATION_LONGMEMEVAL_FRESH_SUBCAP_USD: '4.1316452',
      PALARI_EXPLORATION_LONGMEMEVAL_MODEL:
        'gemini-2.5-flash-lite',
      PALARI_EXPLORATION_LONGMEMEVAL_RUN_ID:
        'j4-active-brain-exploration-longmemeval-q1-v1',
    }
    const runtime = assertExplorationLongMemEvalEnvironment(
      env,
      config,
      authority,
    )
    assert.equal(runtime.cumulativeCapUsd, 8)
    assert.equal(runtime.freshSubcapUsd, 4.1316452)
    assert.equal(runtime.geminiApiKey, 'fake-gemini-key')
    assert.equal(runtime.openaiApiKey, 'fake-openai-key')

    assert.throws(
      () => assertExplorationLongMemEvalEnvironment(
        {
          ...env,
          PALARI_EXPLORATION_LONGMEMEVAL_FRESH_SUBCAP_USD: '4.14',
        },
        config,
        authority,
      ),
      (error) => error?.code === 'LIVE_CONFIRMATION_MISSING',
    )
  })
