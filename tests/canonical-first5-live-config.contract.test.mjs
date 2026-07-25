import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  access,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  CANONICAL_FIRST5_AUTHORITY_PATH,
  CANONICAL_FIRST5_AVAILABLE_USD,
  CANONICAL_FIRST5_CAPACITY_ORACLE,
  CANONICAL_FIRST5_COST_ESTIMATE,
  CANONICAL_FIRST5_CUMULATIVE_CAP_USD,
  CANONICAL_FIRST5_EXPECTED_PREDICTIONS,
  CANONICAL_FIRST5_FRESH_SUBCAP_USD,
  CANONICAL_FIRST5_GEMINI_MODEL,
  CANONICAL_FIRST5_LIMITS,
  CANONICAL_FIRST5_METER_COMPATIBILITY,
  CANONICAL_FIRST5_OPENING_ACCOUNTED_USD,
  CANONICAL_FIRST5_OPENING_MEASURED_USD,
  CANONICAL_FIRST5_OPENING_UNCERTAIN_USD,
  CANONICAL_FIRST5_POPULATION,
  CANONICAL_FIRST5_PREDECESSOR,
  CANONICAL_FIRST5_PREDICTIONS_PATH,
  CANONICAL_FIRST5_PREDICTION_ROWS_SHA256,
  CANONICAL_FIRST5_RUN_ID,
  assertCanonicalFirst5Environment,
  buildCanonicalFirst5Config,
  canonicalFirst5Sha256,
  loadCanonicalFirst5LiveAuthority,
  loadCanonicalFirst5LiveConfig,
  validateCanonicalFirst5Predictions,
} from '../evals/canonical-first5-live-config.mjs'
import {
  j4ReservationFor,
} from '../evals/active-brain-live-meter.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  prepareJ4PinnedS60,
  SEALED_U8_QUESTION_IDS,
} from '../evals/longmemeval-plan.mjs'
import {
  buildJ4JudgeBody,
} from '../evals/run-longmemeval-live.mjs'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)

test('canonical first-five config import is inert', () => {
  const imported = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    [
      'globalThis.fetch=()=>{throw new Error("network on import")}',
      'await import("./evals/canonical-first5-live-config.mjs")',
      'process.stdout.write("inert")',
    ].join(';'),
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
  })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, 'inert')
})

test('FINAL predictions honestly freeze capacity then not-reached rows',
  async () => {
    const bytes = await readFile(
      resolve(repoRoot, CANONICAL_FIRST5_PREDICTIONS_PATH),
    )
    const predictions = validateCanonicalFirst5Predictions(
      JSON.parse(bytes),
    )
    assert.equal(predictions.status, 'FINAL')
    assert.deepEqual(
      predictions.predictions,
      CANONICAL_FIRST5_EXPECTED_PREDICTIONS,
    )
    assert.deepEqual(
      predictions.predictions.map((row) => row.questionId),
      J4_FIRST_TRANCHE_QUESTION_IDS,
    )
    assert.equal(
      predictions.predictions[0].predictedFailureStage,
      'capacity',
    )
    assert.equal(
      predictions.predictions[0].predictedOfficialCorrect,
      false,
    )
    assert.ok(predictions.predictions.slice(1).every((row) =>
      row.expectedExecution === 'not_reached' &&
      row.predictedFailureStage === 'not_reached' &&
      row.predictedOfficialCorrect === null))
    assert.equal(
      canonicalFirst5Sha256(JSON.stringify(
        predictions.predictions,
      )),
      CANONICAL_FIRST5_PREDICTION_ROWS_SHA256,
    )
    assert.equal(
      predictions.priorPredictionsRemainImmutable.activeFirst5Sha256,
      'b40c573ac81054976ce39f314783f2abd2b31fe9098918b0942de4b99bb60bdb',
    )
  })

test('population and offline capacity oracle cannot reach question six',
  () => {
    assert.deepEqual(
      CANONICAL_FIRST5_POPULATION.questionIds,
      J4_FIRST_TRANCHE_QUESTION_IDS,
    )
    assert.equal(CANONICAL_FIRST5_POPULATION.questions, 5)
    assert.equal(
      CANONICAL_FIRST5_POPULATION.questionIds[5],
      undefined,
    )
    assert.equal(
      CANONICAL_FIRST5_POPULATION.sealedQuestionIds.includes(
        '1568498a',
      ),
      true,
    )
    assert.deepEqual(
      CANONICAL_FIRST5_POPULATION.sealedQuestionIds,
      SEALED_U8_QUESTION_IDS,
    )
    assert.ok(CANONICAL_FIRST5_CAPACITY_ORACLE.rows.every((row) =>
      row.requiredChars > CANONICAL_FIRST5_CAPACITY_ORACLE.maxChars))
    assert.equal(
      CANONICAL_FIRST5_CAPACITY_ORACLE.rows[0].expectedExecution,
      'execute',
    )
    assert.ok(CANONICAL_FIRST5_CAPACITY_ORACLE.rows.slice(1)
      .every((row) => row.expectedExecution === 'not_reached'))
  })

test('spend and request ceilings distinguish denied writer from meter sentinel',
  () => {
    assert.ok(Math.abs(
      CANONICAL_FIRST5_OPENING_MEASURED_USD +
        CANONICAL_FIRST5_OPENING_UNCERTAIN_USD -
        CANONICAL_FIRST5_OPENING_ACCOUNTED_USD,
    ) <= 1e-12)
    assert.ok(Math.abs(
      CANONICAL_FIRST5_CUMULATIVE_CAP_USD -
        CANONICAL_FIRST5_OPENING_ACCOUNTED_USD -
        CANONICAL_FIRST5_AVAILABLE_USD,
    ) <= 1e-12)
    assert.equal(CANONICAL_FIRST5_FRESH_SUBCAP_USD, 1)
    assert.equal(CANONICAL_FIRST5_LIMITS.maxAttempts, 40)
    assert.deepEqual(
      CANONICAL_FIRST5_LIMITS.maxLogicalRequests,
      {
        answer: 5,
        judge: 5,
        writer: 1,
      },
    )
    assert.equal(
      CANONICAL_FIRST5_METER_COMPATIBILITY
        .effectiveWriterLogicalRequests,
      0,
    )
    assert.equal(
      CANONICAL_FIRST5_METER_COMPATIBILITY
        .technicalWriterLogicalRequests,
      1,
    )
  })

test('capacity cost estimate matches the exact first judge request',
  async () => {
    const prepared = await prepareJ4PinnedS60({
      raw: await readFile(resolve(
        repoRoot,
        'data/longmemeval_s_cleaned.json',
      )),
    })
    const body = buildJ4JudgeBody(
      prepared.executionOrder[0],
      'I could not safely check every stored statement because the configured memory context is too small.',
    )
    const serialized = JSON.stringify(body)
    const reservation = j4ReservationFor({
      body: serialized,
      maxOutputTokens: body.max_tokens,
      provider: 'openai',
    })
    assert.equal(
      Buffer.byteLength(serialized),
      CANONICAL_FIRST5_COST_ESTIMATE
        .capacityBoundary.judgeRequestBytes,
    )
    assert.equal(
      canonicalFirst5Sha256(serialized),
      CANONICAL_FIRST5_COST_ESTIMATE
        .capacityBoundary.judgeRequestSha256,
    )
    assert.deepEqual(
      {
        judgeInputTokens: reservation.judgeInputTokens,
        judgeOutputTokens: reservation.judgeOutputTokens,
        usd: reservation.usd,
      },
      CANONICAL_FIRST5_COST_ESTIMATE
        .capacityBoundary.oneAttemptReservation,
    )
    assert.equal(
      Number((
        reservation.usd *
        CANONICAL_FIRST5_COST_ESTIMATE
          .capacityBoundary.maximumAttempts
      ).toFixed(12)),
      CANONICAL_FIRST5_COST_ESTIMATE
        .capacityBoundary.maximumRetryReservationUsd,
    )
    const envelope = CANONICAL_FIRST5_COST_ESTIMATE
      .maximumTokenEnvelope
    const envelopeUsd =
      envelope.geminiInputTokens * 0.30 / 1_000_000 +
      envelope.geminiOutputIncludingThinkingTokens *
        2.50 / 1_000_000 +
      envelope.judgeInputTokens * 2.50 / 1_000_000 +
      envelope.judgeOutputTokens * 10 / 1_000_000
    assert.equal(envelopeUsd, envelope.usd)
    assert.ok(envelope.usd < CANONICAL_FIRST5_FRESH_SUBCAP_USD)
  })

test('authority freezes one fresh no-writer first-five run',
  async () => {
    const loaded = await loadCanonicalFirst5LiveAuthority({
      repoRoot,
    })
    assert.equal(loaded.authority.runId, CANONICAL_FIRST5_RUN_ID)
    assert.equal(loaded.authority.questions, 5)
    assert.equal(loaded.authority.writerEnabled, false)
    assert.equal(loaded.authority.writerOperations, 0)
    assert.equal(loaded.authority.answerOperationsMax, 5)
    assert.equal(loaded.authority.judgeOperationsMax, 5)
    assert.equal(loaded.authority.stopAtFirstCapacity, true)
    assert.equal(
      loaded.authority.predecessorCheckpointSha256,
      CANONICAL_FIRST5_PREDECESSOR.private.checkpoint.sha256,
    )
  })

test('canonical smoke predecessor pins tracked, private, and sealed-runner bytes',
  async (context) => {
    assert.deepEqual(
      {
        accounted: CANONICAL_FIRST5_PREDECESSOR
          .cumulativeAccountedUsd,
        measured: CANONICAL_FIRST5_PREDECESSOR
          .cumulativeMeasuredUsd,
        uncertain: CANONICAL_FIRST5_PREDECESSOR
          .cumulativeUncertainUsd,
      },
      {
        accounted: 0.7727998,
        measured: 0.7702988,
        uncertain: 0.002501,
      },
    )
    for (const entry of Object.values(
      CANONICAL_FIRST5_PREDECESSOR.tracked,
    )) {
      assert.equal(
        canonicalFirst5Sha256(
          await readFile(resolve(repoRoot, entry.path)),
        ),
        entry.sha256,
      )
    }
    assert.equal(
      canonicalFirst5Sha256(await readFile(resolve(
        repoRoot,
        CANONICAL_FIRST5_PREDECESSOR.sealedRunner.path,
      ))),
      CANONICAL_FIRST5_PREDECESSOR.sealedRunner.sha256,
    )
    try {
      await access(resolve(
        repoRoot,
        CANONICAL_FIRST5_PREDECESSOR.private.checkpoint.path,
      ))
    } catch (error) {
      if (error?.code === 'ENOENT') {
        context.skip('private canonical-smoke evidence is absent')
        return
      }
      throw error
    }
    for (const entry of Object.values(
      CANONICAL_FIRST5_PREDECESSOR.private,
    )) {
      assert.equal(
        canonicalFirst5Sha256(
          await readFile(resolve(repoRoot, entry.path)),
        ),
        entry.sha256,
      )
    }
  })

test('future config loader validates predictions and artifact manifest schema',
  async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'palari-canonical-first5-config-'),
    )
    const configPath = join(directory, 'config.json')
    try {
      const predictionsBytes = await readFile(resolve(
        repoRoot,
        CANONICAL_FIRST5_PREDICTIONS_PATH,
      ))
      const artifactPath =
        'evals/canonical-first5-live-config.mjs'
      const config = buildCanonicalFirst5Config({
        artifacts: [{
          path: artifactPath,
          sha256: canonicalFirst5Sha256(
            await readFile(resolve(repoRoot, artifactPath)),
          ),
        }],
        predictionsSha256:
          canonicalFirst5Sha256(predictionsBytes),
      })
      await writeFile(
        configPath,
        `${JSON.stringify(config, null, 2)}\n`,
        { mode: 0o600 },
      )
      const loaded = await loadCanonicalFirst5LiveConfig({
        configPath,
        repoRoot,
      })
      assert.equal(loaded.config.runId, CANONICAL_FIRST5_RUN_ID)
      assert.equal(loaded.predictions.status, 'FINAL')
      assert.equal(loaded.config.scope.writerOperations, 0)
      assert.equal(loaded.config.models.writer, null)
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

test('environment gate requires exact authority without formatting secrets',
  async () => {
    const { authority } = await loadCanonicalFirst5LiveAuthority({
      repoRoot,
    })
    const secrets = {
      gemini: 'gemini-secret-sentinel',
      openai: 'openai-secret-sentinel',
    }
    const config = { runId: CANONICAL_FIRST5_RUN_ID }
    assert.throws(
      () => assertCanonicalFirst5Environment({
        GEMINI_API_KEY: secrets.gemini,
        OPENAI_API_KEY: secrets.openai,
      }, config, authority),
      (error) =>
        error.code === 'LIVE_CONFIRMATION_MISSING' &&
        !error.message.includes(secrets.gemini) &&
        !error.message.includes(secrets.openai),
    )
    const runtime = assertCanonicalFirst5Environment({
      GEMINI_API_KEY: secrets.gemini,
      OPENAI_API_KEY: secrets.openai,
      PALARI_CANONICAL_FIRST5_CONFIRM_SPEND: '1',
      PALARI_CANONICAL_FIRST5_CUMULATIVE_CAP_USD: '7',
      PALARI_CANONICAL_FIRST5_CUMULATIVE_QUESTIONS: '5',
      PALARI_CANONICAL_FIRST5_FRESH_SUBCAP_USD: '1',
      PALARI_CANONICAL_FIRST5_MODEL:
        CANONICAL_FIRST5_GEMINI_MODEL,
    }, config, authority)
    assert.deepEqual(runtime, {
      cumulativeCapUsd: 7,
      cumulativeQuestions: 5,
      freshSubcapUsd: 1,
      geminiApiKey: secrets.gemini,
      model: CANONICAL_FIRST5_GEMINI_MODEL,
      openaiApiKey: secrets.openai,
    })
  })
