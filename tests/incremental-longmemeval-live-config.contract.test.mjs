import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import {
  INCREMENTAL_LONGMEMEVAL_AVAILABLE_USD,
  INCREMENTAL_LONGMEMEVAL_COST_ENVELOPE,
  INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD,
  INCREMENTAL_LONGMEMEVAL_EXPECTED_PREDICTIONS,
  INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
  INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS,
  INCREMENTAL_LONGMEMEVAL_JUDGE_LIMITS,
  INCREMENTAL_LONGMEMEVAL_OPENING_ACCOUNTED_USD,
  INCREMENTAL_LONGMEMEVAL_POPULATION,
  INCREMENTAL_LONGMEMEVAL_PREDICTIONS_PATH,
  INCREMENTAL_LONGMEMEVAL_PRICES_USD_PER_TOKEN,
  INCREMENTAL_LONGMEMEVAL_QUESTION_ID,
  INCREMENTAL_LONGMEMEVAL_RUN_ID,
  assertIncrementalLongMemEvalEnvironment,
  loadIncrementalLongMemEvalAuthority,
  loadIncrementalLongMemEvalConfig,
} from '../evals/incremental-longmemeval-live-config.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_TERMINAL_RUN_IDS,
  auditIncrementalLongMemEvalTrackedArtifacts,
} from '../evals/run-incremental-longmemeval-live.mjs'

test('incremental LongMemEval config import is inert', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'await import("./evals/incremental-longmemeval-live-config.mjs")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('scope pins the exact 484-message question and 245-dispatch ceiling',
  () => {
    assert.equal(INCREMENTAL_LONGMEMEVAL_RUN_ID,
      'j4-active-brain-incremental-longmemeval-q1-v1')
    assert.equal(INCREMENTAL_LONGMEMEVAL_QUESTION_ID, '08e075c7')
    assert.deepEqual(INCREMENTAL_LONGMEMEVAL_POPULATION, {
      answerCharacters: 8,
      exchangePlanSha256:
        '8441628945e6f6b0685f3b67ef6413a4a249ece8bbc9509af75e6849531c8be3',
      interactions: 243,
      isAbstention: false,
      maximumInteractionCharacters: 14_155,
      questionCharacters: 46,
      questionDate: '2023-09-04T17:07:00.000Z',
      questionId: '08e075c7',
      questionType: 'knowledge-update',
      rawTurns: 484,
      sessions: 45,
      visibleCharacters: 497_983,
      visibleMessages: 484,
    })
    assert.equal(
      INCREMENTAL_LONGMEMEVAL_COST_ENVELOPE.maximumPhysicalDispatches,
      245,
    )
    assert.deepEqual(
      INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS.maxLogicalRequests,
      { answer: 1, judge: 1, writer: 243 },
    )
    assert.equal(INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS.maxAttempts, 244)
  })

test('conservative arithmetic fits the raised caps without weakening limits',
  () => {
    const reducerInput =
      1_718_371 + 72_000 * 242 + 512 * 243
    assert.equal(reducerInput, 19_266_787)
    const geminiInput =
      reducerInput +
      INCREMENTAL_LONGMEMEVAL_COST_ENVELOPE.gemini.answerInputTokens
    const geminiOutput = 243 * 2_000 + 256
    assert.equal(geminiInput, 19_342_276)
    assert.equal(geminiOutput, 486_256)
    const inputUsd =
      geminiInput *
      INCREMENTAL_LONGMEMEVAL_PRICES_USD_PER_TOKEN.geminiInput
    const outputUsd =
      geminiOutput *
      INCREMENTAL_LONGMEMEVAL_PRICES_USD_PER_TOKEN
        .geminiOutputIncludingThinking
    const judgeUsd =
      INCREMENTAL_LONGMEMEVAL_JUDGE_LIMITS.maxInputTokens *
        INCREMENTAL_LONGMEMEVAL_PRICES_USD_PER_TOKEN
          .judgeInputHighestSynchronousTier +
      INCREMENTAL_LONGMEMEVAL_JUDGE_LIMITS.maxOutputTokens *
        INCREMENTAL_LONGMEMEVAL_PRICES_USD_PER_TOKEN
          .judgeOutputHighestSynchronousTier
    assert.ok(Math.abs(inputUsd - 5.8026828) < 1e-12)
    assert.ok(Math.abs(outputUsd - 1.21564) < 1e-12)
    assert.ok(Math.abs(judgeUsd - 0.05717525) < 1e-12)
    assert.ok(Math.abs(
      inputUsd + outputUsd + judgeUsd -
      INCREMENTAL_LONGMEMEVAL_COST_ENVELOPE.freshMaximumUsd,
    ) < 1e-7)
    assert.ok(
      INCREMENTAL_LONGMEMEVAL_COST_ENVELOPE.freshMaximumUsd <
      INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD,
    )
    assert.ok(
      INCREMENTAL_LONGMEMEVAL_OPENING_ACCOUNTED_USD +
        INCREMENTAL_LONGMEMEVAL_COST_ENVELOPE.freshMaximumUsd <
      INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD,
    )
    assert.equal(
      INCREMENTAL_LONGMEMEVAL_AVAILABLE_USD,
      INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD -
        INCREMENTAL_LONGMEMEVAL_OPENING_ACCOUNTED_USD,
    )
    assert.equal(
      INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS
        .maxTokens.geminiInput,
      geminiInput,
    )
    assert.equal(
      INCREMENTAL_LONGMEMEVAL_GEMINI_LIMITS
        .maxTokens.geminiOutputIncludingThinking,
      geminiOutput,
    )
  })

test('FINAL predictions are byte-external and match the frozen rows',
  async () => {
    const predictions = JSON.parse(await readFile(
      new URL(`../${INCREMENTAL_LONGMEMEVAL_PREDICTIONS_PATH}`,
        import.meta.url),
    ))
    assert.equal(predictions.status, 'FINAL')
    assert.equal(predictions.noReroll, true)
    assert.equal(predictions.expectedOutcome, 'CORRECT')
    assert.deepEqual(
      predictions.predictions,
      INCREMENTAL_LONGMEMEVAL_EXPECTED_PREDICTIONS,
    )
  })

test('tracked identity remains frozen and only the seal changes runtime closure',
  async () => {
    const repoRoot = new URL('..', import.meta.url).pathname
    const loaded = await loadIncrementalLongMemEvalConfig({ repoRoot })
    const authority =
      await loadIncrementalLongMemEvalAuthority({ repoRoot })
    assert.equal(
      loaded.configSha256,
      '16fab020b245e96a34a472606faa1b7414006ee41cf7bf2d3f5ed24db81aac5e',
    )
    assert.equal(
      loaded.predictionsSha256,
      '6bf388c9898cd1198af75252f7b46f9c7554c19532d92f15bb093cd1361a72b0',
    )
    assert.equal(
      authority.authoritySha256,
      'fd1ea14932633b3716668a6f16e400b2ed412277bd6f2acc58a1d05fe4467967',
    )
    if (INCREMENTAL_LONGMEMEVAL_TERMINAL_RUN_IDS.length === 0) {
      assert.deepEqual(
        await auditIncrementalLongMemEvalTrackedArtifacts({
          config: loaded.config,
          repoRoot,
        }),
        {
          artifacts: 38,
          artifactSetSha256:
            'b8b6ebbb5a800df46f4085e249f3d48cc1d409dd81ff9ec22016f3d11ce22cdf',
        },
      )
    } else {
      await assert.rejects(
        auditIncrementalLongMemEvalTrackedArtifacts({
          config: loaded.config,
          repoRoot,
        }),
        (error) => error.code === 'INCREMENTAL_ARTIFACT_CHANGED',
      )
    }
  })

test('environment gate requires both keys and exact raised caps', () => {
  const config = { runId: INCREMENTAL_LONGMEMEVAL_RUN_ID }
  const authority = { runId: INCREMENTAL_LONGMEMEVAL_RUN_ID }
  const env = {
    GEMINI_API_KEY: 'gemini-present',
    OPENAI_API_KEY: 'openai-present',
    PALARI_INCREMENTAL_LONGMEMEVAL_CONFIRM_SPEND: '1',
    PALARI_INCREMENTAL_LONGMEMEVAL_CUMULATIVE_CAP_USD: '8',
    PALARI_INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD: '7.1',
    PALARI_INCREMENTAL_LONGMEMEVAL_MODEL:
      'gemini-3.5-flash-lite',
  }
  const runtime = assertIncrementalLongMemEvalEnvironment(
    env,
    config,
    authority,
  )
  assert.equal(runtime.cumulativeCapUsd, 8)
  assert.equal(runtime.freshSubcapUsd, 7.1)
  assert.equal(runtime.geminiApiKey, 'gemini-present')
  assert.equal(runtime.openaiApiKey, 'openai-present')
  for (const missing of ['GEMINI_API_KEY', 'OPENAI_API_KEY']) {
    assert.throws(
      () => assertIncrementalLongMemEvalEnvironment(
        { ...env, [missing]: '' },
        config,
        authority,
      ),
      (error) => error.code ===
        (missing === 'GEMINI_API_KEY'
          ? 'GEMINI_KEY_MISSING'
          : 'OPENAI_KEY_MISSING'),
    )
  }
  assert.throws(
    () => assertIncrementalLongMemEvalEnvironment(
      {
        ...env,
        PALARI_INCREMENTAL_LONGMEMEVAL_FRESH_SUBCAP_USD: '7.2',
      },
      config,
      authority,
    ),
    (error) => error.code === 'LIVE_CONFIRMATION_MISSING',
  )
})
