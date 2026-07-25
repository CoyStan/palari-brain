import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import {
  ACTIVE_BRAIN_CARRIED_ACCOUNTED_USD,
  ACTIVE_BRAIN_CARRIED_MEASURED_USD,
  ACTIVE_BRAIN_CARRIED_UNCERTAIN_USD,
  ACTIVE_BRAIN_COST_ESTIMATE,
  ACTIVE_BRAIN_LIVE_CONFIG_PATH,
  ACTIVE_BRAIN_LIVE_RUN_ID,
  ACTIVE_BRAIN_PREDICTION_ROWS_SHA256,
  ACTIVE_BRAIN_PREDECESSOR_CHAIN,
  ACTIVE_BRAIN_QUESTION_IDS_SHA256,
  ACTIVE_BRAIN_REQUIRED_ARTIFACT_PATHS,
  ACTIVE_BRAIN_STATEMENT_SCHEMA_SHA256,
  activeBrainSha256,
  assertActiveBrainLiveEnvironment,
  loadActiveBrainLiveAuthority,
  loadActiveBrainLiveConfig,
} from '../evals/active-brain-live-config.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  SEALED_U8_QUESTION_IDS,
} from '../evals/longmemeval-plan.mjs'

const repoRoot = new URL('..', import.meta.url).pathname
const predictionPath =
  'evals/predictions/j4-active-brain-first5-v1.json'
const authorityPath =
  'evals/live-runs/j4-active-brain-first5-v1.authority.json'
const placeholder = 'TO_BE_FROZEN_SHA256'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function readJson(path) {
  return JSON.parse(await readFile(join(repoRoot, path), 'utf8'))
}

async function materializeLoadableFixture() {
  const root = await mkdtemp(join(tmpdir(), 'palari-active-config-'))
  const config = await readJson(ACTIVE_BRAIN_LIVE_CONFIG_PATH)
  const predictionText = await readFile(
    join(repoRoot, predictionPath),
    'utf8',
  )
  for (const artifact of config.artifacts) {
    const path = join(root, artifact.path)
    const bytes = `fixture artifact: ${artifact.path}\n`
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, bytes)
    artifact.sha256 = sha256(bytes)
  }
  config.predictions.sha256 = sha256(predictionText)
  await mkdir(
    dirname(join(root, ACTIVE_BRAIN_LIVE_CONFIG_PATH)),
    { recursive: true },
  )
  await mkdir(dirname(join(root, predictionPath)), { recursive: true })
  await writeFile(
    join(root, ACTIVE_BRAIN_LIVE_CONFIG_PATH),
    `${JSON.stringify(config, null, 2)}\n`,
  )
  await writeFile(join(root, predictionPath), predictionText)
  return { config, predictionText, root }
}

test('active config import is inert and needs no credential environment', () => {
  const moduleUrl =
    new URL('../evals/active-brain-live-config.mjs', import.meta.url).href
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `await import(${JSON.stringify(moduleUrl)})`,
    ],
    {
      cwd: '/',
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    },
  )
  assert.equal(child.status, 0, child.stderr)
  assert.equal(child.stdout, '')
})

test('FINAL predictions pin five new active-path outcomes and exact hashes', async () => {
  const text = await readFile(join(repoRoot, predictionPath), 'utf8')
  const document = JSON.parse(text)
  assert.equal(document.runId, ACTIVE_BRAIN_LIVE_RUN_ID)
  assert.equal(document.status, 'FINAL')
  assert.equal(document.predictions.length, 5)
  assert.deepEqual(
    document.predictions.map((row) => row.questionId),
    J4_FIRST_TRANCHE_QUESTION_IDS,
  )
  assert.ok(document.predictions.every((row) =>
    row.predictedOfficialCorrect === true &&
    row.predictedFailureStage === 'none'))
  assert.equal(
    activeBrainSha256(JSON.stringify(document.predictions)),
    ACTIVE_BRAIN_PREDICTION_ROWS_SHA256,
  )
  assert.equal(document.rowArraySha256, ACTIVE_BRAIN_PREDICTION_ROWS_SHA256)
  assert.equal(
    document.promptConfig.writer.schemaSha256,
    ACTIVE_BRAIN_STATEMENT_SCHEMA_SHA256,
  )
  assert.equal(
    activeBrainSha256(
      JSON.stringify(document.population.questions === 5
        ? J4_FIRST_TRANCHE_QUESTION_IDS
        : []),
    ),
    ACTIVE_BRAIN_QUESTION_IDS_SHA256,
  )
  assert.match(
    document.method.note,
    /reviewing predecessor failure categories/,
  )
  assert.doesNotMatch(document.method.note, /not informed/i)
  assert.equal(text.endsWith('\n'), true)
})

test('config pins exact active counts, cap truth, and coherent hash state', async () => {
  const config = await readJson(ACTIVE_BRAIN_LIVE_CONFIG_PATH)
  assert.equal(config.runId, ACTIVE_BRAIN_LIVE_RUN_ID)
  assert.deepEqual(config.population.questionIds, J4_FIRST_TRANCHE_QUESTION_IDS)
  assert.deepEqual(config.population.sealedQuestionIds, SEALED_U8_QUESTION_IDS)
  assert.deepEqual(config.costEstimate, ACTIVE_BRAIN_COST_ESTIMATE)
  assert.deepEqual(config.costEstimate.requestStats, {
    benchmarkWriterRequests: 1_207,
    compatibilitySmokeWriterRequests: 1,
    productMaxChars: 100_000,
    questions: 5,
    rawTurns: 2_398,
    serializedWriterBodyBytes: 4_628_234,
    serializedWriterBodyChars: 4_627_564,
    sessions: 232,
    writerLogicalRequestLimit: 1_208,
  })
  assert.ok(
    config.costEstimate.conservative.freshUsd >
    config.costEstimate.freshMeterCapUsd,
  )
  assert.equal(config.costEstimate.capMayStopEarly, true)
  assert.deepEqual(
    config.artifacts.map((entry) => entry.path).sort(),
    [...ACTIVE_BRAIN_REQUIRED_ARTIFACT_PATHS].sort(),
  )
  const placeholders = config.artifacts.filter(
    (entry) => entry.sha256 === placeholder,
  )
  assert.ok(
    placeholders.length === 0 ||
    placeholders.length === config.artifacts.length,
    'artifact hashes must be either wholly pending or wholly frozen',
  )
  if (placeholders.length === 0) {
    assert.ok(config.artifacts.every((entry) =>
      /^[a-f0-9]{64}$/.test(entry.sha256)))
  }
})

test('predecessor chain preserves exact v1-v5 identity and spend classes', async () => {
  const config = await readJson(ACTIVE_BRAIN_LIVE_CONFIG_PATH)
  assert.deepEqual(config.predecessorChain, ACTIVE_BRAIN_PREDECESSOR_CHAIN)
  assert.equal(config.predecessorChain.runs.length, 5)
  assert.deepEqual(
    config.predecessorChain.runs.map((run) => run.runId),
    [
      'j4-longmemeval-s60-v1',
      'j4-longmemeval-s60-v2',
      'j4-longmemeval-s60-v3',
      'j4-longmemeval-s60-v4',
      'j4-longmemeval-s60-v5',
    ],
  )
  const v5 = config.predecessorChain.runs.at(-1)
  assert.deepEqual({
    attempts: v5.attempts,
    completedQuestions: v5.completedQuestions,
    currentRunAccountedUsd: v5.currentRunAccountedUsd,
    smokeLogicalOperations: v5.smokeLogicalOperations,
    smokeStatus: v5.smokeStatus,
    status: v5.status,
  }, {
    attempts: 1_203,
    completedQuestions: 5,
    currentRunAccountedUsd: 0.5769756,
    smokeLogicalOperations: 2,
    smokeStatus: 'completed',
    status: 'paused',
  })
  assert.equal(
    v5.private.artifactManifestSha256,
    '22250ab01b8202319dd54d739561ef54d1b3685efb8e5fae8aed92d3d9dba1d6',
  )
  assert.equal(
    v5.private.checkpointSha256,
    'bc46d9272f1d788fb06b826a6219c8448b19b0f361aaa0c9d9b68bd53fca8805',
  )
  assert.equal(
    v5.private.meterSha256,
    '22d8d51dd9844409ed6f4640c81903f6916b5cff325ee4561b4e4d94cdb0abe8',
  )
  assert.ok(
    Math.abs(
      ACTIVE_BRAIN_CARRIED_MEASURED_USD +
        ACTIVE_BRAIN_CARRIED_UNCERTAIN_USD -
        ACTIVE_BRAIN_CARRIED_ACCOUNTED_USD,
    ) <= 1e-12,
  )
})

test('active-only environment gates reject historical names and never format keys', async () => {
  const config = await readJson(ACTIVE_BRAIN_LIVE_CONFIG_PATH)
  const { authority } = await loadActiveBrainLiveAuthority({ repoRoot })
  const secrets = {
    gemini: 'gemini-secret-sentinel',
    openai: 'openai-secret-sentinel',
  }
  assert.throws(
    () => assertActiveBrainLiveEnvironment({
      GEMINI_API_KEY: secrets.gemini,
      OPENAI_API_KEY: secrets.openai,
      PALARI_J4_CONFIRM_SPEND: '1',
      PALARI_J4_CUMULATIVE_QUESTIONS: '5',
      PALARI_J4_SPEND_CAP_USD: '7',
    }, config, authority),
    (error) =>
      error.code === 'SPEND_NOT_CONFIRMED' &&
      !error.message.includes(secrets.gemini) &&
      !error.message.includes(secrets.openai),
  )
  const runtime = assertActiveBrainLiveEnvironment({
    GEMINI_API_KEY: secrets.gemini,
    OPENAI_API_KEY: secrets.openai,
    PALARI_ACTIVE_CONFIRM_SPEND: '1',
    PALARI_ACTIVE_CUMULATIVE_QUESTIONS: '5',
    PALARI_ACTIVE_SPEND_CAP_USD: '7',
  }, config, authority)
  assert.deepEqual(runtime, {
    capUsd: 7,
    cumulativeQuestions: 5,
    geminiApiKey: secrets.gemini,
    openaiApiKey: secrets.openai,
  })
  assert.throws(
    () => assertActiveBrainLiveEnvironment({
      GEMINI_API_KEY: secrets.gemini,
      OPENAI_API_KEY: secrets.openai,
      PALARI_ACTIVE_CONFIRM_SPEND: '1',
      PALARI_ACTIVE_CUMULATIVE_QUESTIONS: '6',
      PALARI_ACTIVE_SPEND_CAP_USD: '7',
    }, config, authority),
    (error) =>
      error.code === 'TRANCHE_NOT_AUTHORIZED' &&
      !error.message.includes(secrets.gemini) &&
      !error.message.includes(secrets.openai),
  )
})

test('loader accepts a fully pinned fixture and rejects prediction/artifact tampering', async () => {
  const fixture = await materializeLoadableFixture()
  try {
    const loaded = await loadActiveBrainLiveConfig({
      repoRoot: fixture.root,
    })
    assert.equal(loaded.config.runId, ACTIVE_BRAIN_LIVE_RUN_ID)
    assert.equal(loaded.predictions.status, 'FINAL')

    await writeFile(
      join(fixture.root, predictionPath),
      `${fixture.predictionText} `,
    )
    await assert.rejects(
      loadActiveBrainLiveConfig({ repoRoot: fixture.root }),
      (error) => error.code === 'PREDICTIONS_HASH',
    )
    await writeFile(
      join(fixture.root, predictionPath),
      fixture.predictionText,
    )

    const firstArtifact = fixture.config.artifacts[0]
    await writeFile(
      join(fixture.root, firstArtifact.path),
      'tampered artifact\n',
    )
    await assert.rejects(
      loadActiveBrainLiveConfig({ repoRoot: fixture.root }),
      (error) => error.code === 'ARTIFACT_HASH',
    )
  } finally {
    await rm(fixture.root, { force: true, recursive: true })
  }
})

test('authority is exact and does not reuse a predecessor checkpoint', async () => {
  const document = await readJson(authorityPath)
  const loaded = await loadActiveBrainLiveAuthority({ repoRoot })
  assert.deepEqual(loaded.authority, document)
  assert.deepEqual(document, {
    cumulativeCapUsd: 7,
    cumulativeQuestions: 5,
    decisionReference:
      'docs/DECISIONS.md — FOUNDER GO — J4.2K active first-five live measurement',
    founderGoDate: '2026-07-25',
    fromCumulativeQuestions: 0,
    previousCheckpointSha256: null,
    runId: ACTIVE_BRAIN_LIVE_RUN_ID,
    schemaVersion: 1,
  })
})
