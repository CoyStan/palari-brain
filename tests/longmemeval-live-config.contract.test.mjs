import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  J4_GEMINI_ANSWER_GENERATION,
  J4_CUMULATIVE_LIMITS,
  J4_GEMINI_MODEL,
  J4_GEMINI_WRITER_GENERATION,
  J4_LIVE_AUTHORITY_PATH,
  J4_LIVE_RUN_ID,
  J4_OFFICIAL_FACT_TEMPLATE,
  J4_TRANCHE_1_LIMITS,
  J4_V4_CUMULATIVE_COST_ESTIMATE,
  J4_V5_CUMULATIVE_COST_ESTIMATE,
  J4_V6_CARRIED_ACCOUNTED_USD,
  J4_V6_CARRIED_MEASURED_USD,
  J4_V6_CARRIED_UNCERTAIN_USD,
  J4_V6_CUMULATIVE_COST_ESTIMATE,
  J4_V6_FRESH_METER_CAP_USD,
  assertJ4LiveEnvironment,
  buildJ4AnswerBody,
  buildJ4AnswerPrompt,
  buildJ4WriterBody,
  j4ExecutionQuestionIds,
  j4Sha256,
  j4V6DerivedContract,
  loadJ4LiveAuthority,
  loadJ4LiveConfig,
} from '../evals/longmemeval-live-config.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  SEALED_U8_QUESTION_IDS,
} from '../evals/longmemeval-plan.mjs'
import { buildGeminiGenerateRequest } from '../src/gemini.mjs'
import {
  MEMORY_EXTRACTION_RESPONSE_MIME_TYPE,
  MEMORY_EXTRACTION_RESPONSE_SCHEMA,
} from '../src/memory-extraction-schema.mjs'

const REPO_ROOT = new URL('..', import.meta.url).pathname
const J4_V1_CONFIG_SHA256 =
  '7e3619893e66984e4548c84cb23ab6c097f8372fbd29028b592e99a4f649d5ce'
const J4_V1_AUTHORITY_SHA256 =
  '4354ee1f952694c756d0ec4e64d7facbc734456301e58ac2d9a930cb57609c13'
const J4_V1_PREDICTIONS_SHA256 =
  '07a262c01efa13697266c4e5d52829b518e9e16076e7b6046c78122ae0011028'
const J4_V2_CONFIG_SHA256 =
  '7f63c0ea2e9e5f4e27e965d60118ce28e6b95e1aa7c74de0784a455d9e38df68'
const J4_V2_AUTHORITY_SHA256 =
  '51091b6d280c099c32f12e2a75a0e11c85e9690a2dd92cee3c24a5ffc7a4a253'
const J4_V2_PREDICTIONS_SHA256 =
  'ccdf0b9bd8cc12256657c574d3189d6f4aebb9dd5e6e60ee0aaaaee63671714f'
const J4_V3_CONFIG_SHA256 =
  '91bc18330bb92b83b1a28d32d21d8dfbc4ea2b0cffa3044e31c0e5c3a12b6b88'
const J4_V3_AUTHORITY_SHA256 =
  '4b4dbc036a23737d6c729e5ee153d362caad0b60f0bae12a64a0bd2da8f71735'
const J4_V3_PREDICTIONS_SHA256 =
  '201a41bd326f19d350ab45719f95fcf73a1d5d0159cf60c4ccee9992281460bf'
const J4_V4_AUTHORITY_SHA256 =
  'f8bd5cdaa886624da36edae655b716c7dd902006ccee04561a10f288f3528367'
const J4_V4_CONFIG_SHA256 =
  '2aa449d45306303b5a6d0cf6fcc9aa3ae058baadc7566d5a3bc8017e8031c531'
const J4_V4_PREDICTIONS_SHA256 =
  '1df076076c82e7c250e94c22e471b36cc9bf3cfa85ea90df9bd19c57a021f436'
const J4_V5_AUTHORITY_SHA256 =
  '0f0ce76625a2e9e16bd3fbd171bb08568e88111811ad4d2fadd5f5889e1f45ba'
const J4_V5_CONFIG_SHA256 =
  '7319f3ae754eaca9935f70c8a2e8a66ccfde949a02729e7662d1d71f89bc4f3f'
const J4_V5_PREDICTIONS_SHA256 =
  '9adbc808c93fda63397ac7b304af7347443ca2940adf722d231c60165f08e7d6'
const J4_V6_AUTHORITY_SHA256 =
  '5e5aa9afcf18a68f775cd913e4d97259d42145b79df3fa100839406547488c51'
const J4_V6_CONFIG_SHA256 =
  'c7031ae4414fb80ad7b2860a3f34de5fd350ce366ee9376308041f1331de73e8'
const J4_V6_PREDICTIONS_SHA256 =
  '332d2ba7b7c4edfb6807ac933c8c04cc6a7ba187f6793c407874c7294d91a107'

test('J4 provider bodies freeze the selected model protocol and official prompt', () => {
  assert.equal(J4_GEMINI_MODEL, 'gemini-3.5-flash-lite')
  assert.deepEqual(J4_GEMINI_WRITER_GENERATION, {
    maxOutputTokens: 2_000,
    responseFormat: {
      text: {
        mimeType: MEMORY_EXTRACTION_RESPONSE_MIME_TYPE,
        schema: MEMORY_EXTRACTION_RESPONSE_SCHEMA,
      },
    },
    thinkingConfig: { thinkingLevel: 'MINIMAL' },
  })
  assert.deepEqual(J4_GEMINI_ANSWER_GENERATION, {
    maxOutputTokens: 256,
    thinkingConfig: { thinkingLevel: 'MINIMAL' },
  })
  const writer = buildJ4WriterBody({
    assistantMessage: 'Okay.',
    palariId: 'palari-longmemeval-j4',
    palariName: 'Palari',
    sourceMessageId: 'session:0',
    sourceTexts: [],
    userId: 'user-longmemeval-j4',
    userMessage: 'I prefer tea.',
    userName: 'user',
  })
  assert.deepEqual(writer.generationConfig, {
    maxOutputTokens: 2_000,
    responseFormat: {
      text: {
        mimeType: MEMORY_EXTRACTION_RESPONSE_MIME_TYPE,
        schema: MEMORY_EXTRACTION_RESPONSE_SCHEMA,
      },
    },
    thinkingConfig: { thinkingLevel: 'MINIMAL' },
  })
  assert.equal(writer.store, false)
  assert.equal(
    writer.generationConfig.responseFormat.text.schema,
    MEMORY_EXTRACTION_RESPONSE_SCHEMA,
  )
  assert.equal('responseMimeType' in writer.generationConfig, false)
  assert.equal('temperature' in writer.generationConfig, false)
  assert.equal('topP' in writer.generationConfig, false)
  assert.equal('topK' in writer.generationConfig, false)
  assert.equal('candidateCount' in writer.generationConfig, false)
  const wire = JSON.parse(buildGeminiGenerateRequest({
    apiKey: 'offline-sentinel',
    body: writer,
    model: J4_GEMINI_MODEL,
  }).init.body)
  assert.equal(wire.generationConfig.maxOutputTokens, 2_000)
  assert.equal(
    wire.generationConfig.responseFormat.text.mimeType,
    'APPLICATION_JSON',
  )
  assert.deepEqual(
    wire.generationConfig.responseFormat.text.schema,
    MEMORY_EXTRACTION_RESPONSE_SCHEMA,
  )
  assert.equal('responseMimeType' in wire.generationConfig, false)
  assert.equal('responseSchema' in wire.generationConfig, false)
  assert.doesNotMatch(
    JSON.stringify(wire),
    /"mimeType":"application\/json"/,
  )

  const prompt = buildJ4AnswerPrompt({
    facts: 'User prefers tea.',
    question: 'What does the user prefer?',
    questionDate: '2026-07-23T11:22:33Z',
  })
  assert.equal(
    prompt,
    J4_OFFICIAL_FACT_TEMPLATE
      .replace('{}', 'User prefers tea.')
      .replace('{}', '2026/07/23')
      .replace('{}', 'What does the user prefer?'),
  )
  const answer = buildJ4AnswerBody(prompt)
  assert.deepEqual(answer.generationConfig, {
    maxOutputTokens: 256,
    thinkingConfig: { thinkingLevel: 'MINIMAL' },
  })
  assert.equal(answer.store, false)
})

test('J4 execution order is complete, U8-free, and starts at the exact gate', () => {
  const ids = j4ExecutionQuestionIds()
  assert.equal(ids.length, 60)
  assert.deepEqual(ids.slice(0, 5), J4_FIRST_TRANCHE_QUESTION_IDS)
  assert.equal(new Set(ids).size, 60)
  assert.deepEqual(
    ids.filter((id) => SEALED_U8_QUESTION_IDS.includes(id)),
    [],
  )
  assert.deepEqual(J4_TRANCHE_1_LIMITS, {
    maxAttempts: 117_700,
    maxLogicalRequests: {
      answer: 61,
      judge: 60,
      writer: 29_304,
    },
    maxTokens: {
      geminiInput: 19_240_625,
      geminiOutputIncludingThinking: 2_308_875,
      judgeInput: 2_308_875,
      judgeOutput: 577_218,
    },
    maxResponseBytes: 4 * 1024 * 1024,
    requestTimeoutMs: 60_000,
    retryLimit: 3,
  })
  assert.deepEqual(
    J4_CUMULATIVE_LIMITS.map((entry) => ({
      cumulativeCapUsd: entry.cumulativeCapUsd,
      cumulativeQuestions: entry.cumulativeQuestions,
      maxAttempts: entry.meter.maxAttempts,
      maxLogicalRequests: entry.meter.maxLogicalRequests,
    })),
    [
      {
        cumulativeCapUsd: 5.7721877,
        cumulativeQuestions: 60,
        maxAttempts: 117_700,
        maxLogicalRequests: { answer: 61, judge: 60, writer: 29_304 },
      },
    ],
  )
  for (const entry of J4_CUMULATIVE_LIMITS) {
    const requests = entry.meter.maxLogicalRequests
    assert.equal(
      requests.answer,
      entry.cumulativeQuestions + 1,
      'one answer allowance is reserved for the compatibility smoke',
    )
    assert.equal(requests.judge, entry.cumulativeQuestions)
    assert.equal(
      entry.meter.maxAttempts,
      4 * (requests.writer + requests.answer + requests.judge),
      'attempt ceiling covers initial calls plus all three retries',
    )
  }
})

test('J4 administrative authority exactly clamps runtime scope without reading keys', async () => {
  const loaded = await loadJ4LiveAuthority({ repoRoot: REPO_ROOT })
  assert.equal(loaded.authority.runId, J4_LIVE_RUN_ID)
  assert.equal(J4_LIVE_RUN_ID, 'j4-longmemeval-s60-v6')
  assert.equal(loaded.authority.cumulativeQuestions, 60)
  assert.equal(loaded.authority.cumulativeCapUsd, 5.7721877)
  assert.equal(loaded.authority.fromCumulativeQuestions, 0)
  assert.equal(loaded.authority.previousCheckpointSha256, null)
  assert.equal(loaded.authoritySha256, J4_V6_AUTHORITY_SHA256)
  assert.equal(J4_V6_CARRIED_ACCOUNTED_USD, 0.7721877)
  assert.equal(J4_V6_CARRIED_MEASURED_USD, 0.7696867)
  assert.equal(J4_V6_CARRIED_UNCERTAIN_USD, 0.002501)
  assert.equal(J4_V6_FRESH_METER_CAP_USD, 5)
  assert.equal(
    Number((
      loaded.authority.cumulativeCapUsd - J4_V6_CARRIED_ACCOUNTED_USD
    ).toFixed(7)),
    J4_V6_FRESH_METER_CAP_USD,
  )

  const config = {
    tranches: [{
      cumulativeCapUsd: 5.7721877,
      cumulativeQuestions: 60,
      questions: 60,
    }],
  }
  const safeFakeEnv = {
    GEMINI_API_KEY: 'test-gemini-not-a-real-key',
    OPENAI_API_KEY: 'test-openai-not-a-real-key',
    PALARI_J4_CONFIRM_SPEND: '1',
    PALARI_J4_CUMULATIVE_QUESTIONS: '60',
    PALARI_J4_SPEND_CAP_USD: '5.7721877',
  }
  assert.deepEqual(
    assertJ4LiveEnvironment(safeFakeEnv, config, loaded.authority),
    {
      capUsd: 5.7721877,
      cumulativeQuestions: 60,
      geminiApiKey: safeFakeEnv.GEMINI_API_KEY,
      openaiApiKey: safeFakeEnv.OPENAI_API_KEY,
    },
  )
  assert.throws(
    () => assertJ4LiveEnvironment({
      ...safeFakeEnv,
      PALARI_J4_CUMULATIVE_QUESTIONS: '5',
      PALARI_J4_SPEND_CAP_USD: '7',
    }, {
      tranches: [{
        cumulativeCapUsd: 7,
        cumulativeQuestions: 5,
        questions: 5,
      }],
    }, loaded.authority),
    /does not match the current founder authority/,
  )
  assert.throws(
    () => assertJ4LiveEnvironment({
      ...safeFakeEnv,
      PALARI_J4_CONFIRM_SPEND: '0',
    }, config, loaded.authority),
    /must equal 1/,
  )

  const authorityText = await readFile(
    new URL(`../${J4_LIVE_AUTHORITY_PATH}`, import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(authorityText, /(?:sk-|AIza|api[_-]?key)/i)
})

test('J4 v1 frozen inputs remain byte-identical after replacement setup', async () => {
  const [config, authority, predictions] = await Promise.all([
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v1.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v1.authority.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/predictions/j4-longmemeval-s60.json',
      import.meta.url,
    )),
  ])
  assert.equal(j4Sha256(config), J4_V1_CONFIG_SHA256)
  assert.equal(j4Sha256(authority), J4_V1_AUTHORITY_SHA256)
  assert.equal(j4Sha256(predictions), J4_V1_PREDICTIONS_SHA256)
})

test('J4 v2 frozen inputs remain byte-identical after offline correction', async () => {
  const [config, authority, predictions] = await Promise.all([
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v2.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v2.authority.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/predictions/j4-longmemeval-s60-v2.json',
      import.meta.url,
    )),
  ])
  assert.equal(j4Sha256(config), J4_V2_CONFIG_SHA256)
  assert.equal(j4Sha256(authority), J4_V2_AUTHORITY_SHA256)
  assert.equal(j4Sha256(predictions), J4_V2_PREDICTIONS_SHA256)
})

test('J4 v3 frozen inputs remain byte-identical after MIME correction', async () => {
  const [configText, authorityText, predictionsText] = await Promise.all([
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v3.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v3.authority.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/predictions/j4-longmemeval-s60-v3.json',
      import.meta.url,
    )),
  ])
  assert.equal(j4Sha256(configText), J4_V3_CONFIG_SHA256)
  assert.equal(j4Sha256(authorityText), J4_V3_AUTHORITY_SHA256)
  assert.equal(j4Sha256(predictionsText), J4_V3_PREDICTIONS_SHA256)

  const config = JSON.parse(configText)
  assert.equal(config.runId, 'j4-longmemeval-s60-v3')
  assert.equal(config.costEstimate.expected.cumulativeUsd, 0.9095387)
  assert.equal(
    config.costEstimate.conservative.cumulativeUsd,
    2.1717304,
  )
  assert.ok(
    config.costEstimate.conservative.cumulativeUsd <
      config.costEstimate.capUsd,
  )
})

test('J4 v4 frozen bytes survive the v5 replacement setup', async () => {
  const [configText, authorityText, predictionsText] = await Promise.all([
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v4.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v4.authority.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/predictions/j4-longmemeval-s60-v4.json',
      import.meta.url,
    )),
  ])
  assert.equal(j4Sha256(configText), J4_V4_CONFIG_SHA256)
  assert.equal(j4Sha256(authorityText), J4_V4_AUTHORITY_SHA256)
  assert.equal(j4Sha256(predictionsText), J4_V4_PREDICTIONS_SHA256)

  const config = JSON.parse(configText)
  assert.equal(config.runId, 'j4-longmemeval-s60-v4')
  assert.equal(config.predecessorChain.runs.length, 3)
  assert.deepEqual(
    config.predecessorChain.runs.map((run) => run.runId),
    [
      'j4-longmemeval-s60-v1',
      'j4-longmemeval-s60-v2',
      'j4-longmemeval-s60-v3',
    ],
  )
  assert.deepEqual(config.costEstimate, J4_V4_CUMULATIVE_COST_ESTIMATE)
  assert.equal(config.costEstimate.carriedAccountedUsd, 0.0175702)
  assert.equal(config.costEstimate.freshMeterCapUsd, 2.4824298)
  assert.equal(config.costEstimate.expected.freshUsd, 0.8944695)
  assert.equal(config.costEstimate.expected.cumulativeUsd, 0.9120397)
  assert.equal(config.costEstimate.conservative.freshUsd, 2.1566612)
  assert.equal(
    config.costEstimate.conservative.cumulativeUsd,
    2.1742314,
  )
  assert.ok(
    config.costEstimate.conservative.cumulativeUsd <
      config.costEstimate.capUsd,
  )
})

test('J4 v5 frozen bytes survive terminal sealing and fail closed as runnable', async () => {
  const [configText, authorityText, predictionsText] = await Promise.all([
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v5.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v5.authority.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/predictions/j4-longmemeval-s60-v5.json',
      import.meta.url,
    )),
  ])
  assert.equal(j4Sha256(configText), J4_V5_CONFIG_SHA256)
  assert.equal(j4Sha256(authorityText), J4_V5_AUTHORITY_SHA256)
  assert.equal(j4Sha256(predictionsText), J4_V5_PREDICTIONS_SHA256)

  const config = JSON.parse(configText)
  assert.equal(config.runId, 'j4-longmemeval-s60-v5')
  assert.equal(config.generation.writerMaxOutputTokens, 2_000)
  assert.deepEqual(config.tranches[0], {
    cumulativeCapUsd: 7,
    cumulativeQuestions: 5,
    questions: 5,
  })
  assert.equal(config.artifacts.length, 20)
  assert.equal(config.predecessorChain.openingAccountedUsd, 0.1952121)
  assert.equal(config.predecessorChain.runs.length, 4)
  assert.deepEqual(
    config.predecessorChain.runs.map((run) => run.runId),
    [
      'j4-longmemeval-s60-v1',
      'j4-longmemeval-s60-v2',
      'j4-longmemeval-s60-v3',
      'j4-longmemeval-s60-v4',
    ],
  )
  assert.deepEqual(
    config.predecessorChain.runs[3],
    {
      attempts: 363,
      completedQuestions: 1,
      currentRunAccountedUsd: 0.1776419,
      failedQuestionOrdinal: 2,
      logicalRequests: { answer: 2, judge: 1, writer: 360 },
      openingAccountedUsd: 0.0175702,
      private: {
        artifactManifestPath:
          'evals/results/j4-longmemeval-s60-v4/artifact-manifest.json',
        artifactManifestSha256:
          'bd3bccd789715df7c194f70a46cc91a5d481d21d87c1d3bd2f44e0163524ee57',
        checkpointPath:
          'evals/results/j4-longmemeval-s60-v4/checkpoint.json',
        checkpointSha256:
          '776562439bbfef8d8a855c7a644242d52d24ab418556589d0bf666839fb4e247',
        meterPath: 'evals/results/j4-longmemeval-s60-v4/meter.jsonl',
        meterSha256:
          'd91c82e1d454a680607d2edb81b57a9f768b2cb716ae8fe7b835985d4d9579c9',
      },
      runId: 'j4-longmemeval-s60-v4',
      smokeLogicalOperations: 2,
      smokeStatus: 'completed',
      status: 'failed',
      tracked: {
        authorityPath:
          'evals/live-runs/j4-longmemeval-s60-v4.authority.json',
        authoritySha256:
          'f8bd5cdaa886624da36edae655b716c7dd902006ccee04561a10f288f3528367',
        configPath: 'evals/live-runs/j4-longmemeval-s60-v4.json',
        configSha256:
          '2aa449d45306303b5a6d0cf6fcc9aa3ae058baadc7566d5a3bc8017e8031c531',
        predictionsPath: 'evals/predictions/j4-longmemeval-s60-v4.json',
        predictionsSha256:
          '1df076076c82e7c250e94c22e471b36cc9bf3cfa85ea90df9bd19c57a021f436',
      },
    },
  )
  assert.deepEqual(config.costEstimate, J4_V5_CUMULATIVE_COST_ESTIMATE)
  assert.deepEqual(config.costEstimate, {
    capUsd: 7,
    carriedAccountedUsd: 0.1952121,
    carriedMeasuredUsd: 0.1927111,
    carriedUncertainUsd: 0.002501,
    compatibilitySmoke: {
      answerCalls: 1,
      answerRequestBodyChars: 451,
      writerCalls: 1,
      writerRequestContentChars: 2_467,
    },
    conservative: {
      cumulativeUsd: 6.7861133,
      freshUsd: 6.5909012,
      tokens: {
        geminiInput: 2_055_204,
        geminiOutputIncludingThinking: 2_385_536,
        judgeInput: 4_000,
        judgeOutput: 50,
      },
    },
    expected: {
      cumulativeUsd: 1.0896816,
      freshUsd: 0.8944695,
      tokens: {
        geminiInput: 1_464_065,
        geminiOutputIncludingThinking: 179_400,
        judgeInput: 2_500,
        judgeOutput: 50,
      },
    },
    freshMeterCapUsd: 6.8047879,
    methodVersion: 'j4-v5-fixed-2000-four-predecessors-v1',
    requestStats: {
      questions: 5,
      userTurns: 1_191,
      writerRequestContentChars: 4_726_081,
    },
    schema: {
      canonicalJsonChars: 808,
      sha256:
        '7040c879709509de9022135588403f9d9563e53f63f8560fe2445188a7b20173',
    },
  })
  assert.ok(
    config.costEstimate.conservative.cumulativeUsd <
      config.costEstimate.capUsd,
  )
  const successorDrift = []
  for (const artifact of config.artifacts) {
    const currentBytes = await readFile(
      new URL(`../${artifact.path}`, import.meta.url),
    )
    if (j4Sha256(currentBytes) !== artifact.sha256) {
      successorDrift.push(artifact.path)
    }
  }
  assert.deepEqual(successorDrift.sort(), [
    'evals/arms/kernel-longmemeval-live-arm.mjs',
    'evals/live-transcript.mjs',
    'evals/longmemeval-live-config.mjs',
    'evals/run-longmemeval-live.mjs',
    'src/gemini.mjs',
    // Extracting shared kernel helpers into src/shared-util.mjs also
    // touched this sealed product-path file.
    'src/memory-extraction-schema.mjs',
  ])
  assert.equal(
    successorDrift.includes('evals/run-longmemeval-live.mjs'),
    true,
    'terminal runner bytes must no longer match the executable v5 identity',
  )
})

test('J4 v6 freezes five predecessors, one repair, and the $5 fresh cap', async () => {
  const [configText, predictionsText] = await Promise.all([
    readFile(new URL(
      '../evals/live-runs/j4-longmemeval-s60-v6.json',
      import.meta.url,
    )),
    readFile(new URL(
      '../evals/predictions/j4-longmemeval-s60-v6.json',
      import.meta.url,
    )),
  ])
  const config = JSON.parse(configText)
  const predictions = JSON.parse(predictionsText)
  const derived = j4V6DerivedContract()
  assert.equal(config.runId, J4_LIVE_RUN_ID)
  assert.equal(j4Sha256(configText), J4_V6_CONFIG_SHA256)
  assert.equal(j4Sha256(predictionsText), J4_V6_PREDICTIONS_SHA256)
  assert.equal(config.artifacts.length, 20)
  assert.equal(derived.generation.writerMaxRepairs, 1)
  assert.equal(derived.predecessorChain.runs.length, 5)
  assert.deepEqual(
    derived.predecessorChain.runs.map((run) => run.runId),
    [
      'j4-longmemeval-s60-v1',
      'j4-longmemeval-s60-v2',
      'j4-longmemeval-s60-v3',
      'j4-longmemeval-s60-v4',
      'j4-longmemeval-s60-v5',
    ],
  )
  assert.deepEqual(
    derived.costEstimate,
    J4_V6_CUMULATIVE_COST_ESTIMATE,
  )
  assert.equal(derived.costEstimate.freshMeterCapUsd, 5)
  assert.equal(derived.costEstimate.expected.freshUsd, 10.0725399)
  assert.equal(derived.costEstimate.projectionExceedsCap, true)
  assert.deepEqual(predictions.executionPredictions, {
    capStopIsTerminal: true,
    completedQuestionsMaximum: 55,
    completedQuestionsMinimum: 35,
    noRegrade: true,
    noReroll: true,
    predictedCapStopBeforeQuestion60: true,
    smokeAnswerPasses: true,
    smokeWriterPassesWithinOneRepair: true,
  })
  await assert.rejects(
    loadJ4LiveConfig({ repoRoot: REPO_ROOT }),
    (error) =>
      error.code === 'ARTIFACT_HASH' &&
      error.message.includes('evals/run-longmemeval-live.mjs'),
  )
})
