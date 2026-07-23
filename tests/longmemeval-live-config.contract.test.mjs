import assert from 'node:assert/strict'
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  J4_CARRIED_ACCOUNTED_USD,
  J4_GEMINI_ANSWER_GENERATION,
  J4_CUMULATIVE_LIMITS,
  J4_FRESH_METER_CAP_USD,
  J4_GEMINI_MODEL,
  J4_GEMINI_WRITER_GENERATION,
  J4_LIVE_AUTHORITY_PATH,
  J4_LIVE_PREDICTIONS_PATH,
  J4_LIVE_RUN_ID,
  J4_OFFICIAL_FACT_TEMPLATE,
  J4_REPLACEMENT_PREDECESSOR,
  J4_TRANCHE_1_LIMITS,
  assertJ4LiveEnvironment,
  buildJ4AnswerBody,
  buildJ4AnswerPrompt,
  buildJ4WriterBody,
  j4ExecutionQuestionIds,
  j4Sha256,
  loadJ4LiveAuthority,
  loadJ4LiveConfig,
} from '../evals/longmemeval-live-config.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  SEALED_U8_QUESTION_IDS,
} from '../evals/longmemeval-plan.mjs'

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

test('J4 provider bodies freeze the selected model protocol and official prompt', () => {
  assert.equal(J4_GEMINI_MODEL, 'gemini-3.5-flash-lite')
  assert.deepEqual(J4_GEMINI_WRITER_GENERATION, {
    maxOutputTokens: 512,
    responseMimeType: 'application/json',
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
    maxOutputTokens: 512,
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingLevel: 'MINIMAL' },
  })
  assert.equal('temperature' in writer.generationConfig, false)
  assert.equal('topP' in writer.generationConfig, false)
  assert.equal('topK' in writer.generationConfig, false)
  assert.equal('candidateCount' in writer.generationConfig, false)

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
  assert.deepEqual(buildJ4AnswerBody(prompt).generationConfig, {
    maxOutputTokens: 256,
    thinkingConfig: { thinkingLevel: 'MINIMAL' },
  })
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
    maxAttempts: 4_808,
    maxLogicalRequests: {
      answer: 5,
      judge: 5,
      writer: 1_192,
    },
    maxTokens: {
      geminiInput: 8_333_333,
      geminiOutputIncludingThinking: 1_000_000,
      judgeInput: 1_000_000,
      judgeOutput: 250_000,
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
        cumulativeCapUsd: 2.5,
        cumulativeQuestions: 5,
        maxAttempts: 4_808,
        maxLogicalRequests: { answer: 5, judge: 5, writer: 1_192 },
      },
      {
        cumulativeCapUsd: 7.5,
        cumulativeQuestions: 15,
        maxAttempts: 14_472,
        maxLogicalRequests: { answer: 15, judge: 15, writer: 3_588 },
      },
      {
        cumulativeCapUsd: 12.5,
        cumulativeQuestions: 25,
        maxAttempts: 24_628,
        maxLogicalRequests: { answer: 25, judge: 25, writer: 6_107 },
      },
      {
        cumulativeCapUsd: 17.5,
        cumulativeQuestions: 35,
        maxAttempts: 34_516,
        maxLogicalRequests: { answer: 35, judge: 35, writer: 8_559 },
      },
      {
        cumulativeCapUsd: 22.5,
        cumulativeQuestions: 45,
        maxAttempts: 44_416,
        maxLogicalRequests: { answer: 45, judge: 45, writer: 11_014 },
      },
      {
        cumulativeCapUsd: 27.5,
        cumulativeQuestions: 55,
        maxAttempts: 54_136,
        maxLogicalRequests: { answer: 55, judge: 55, writer: 13_424 },
      },
      {
        cumulativeCapUsd: 30,
        cumulativeQuestions: 60,
        maxAttempts: 59_088,
        maxLogicalRequests: { answer: 60, judge: 60, writer: 14_652 },
      },
    ],
  )
})

test('J4 administrative authority exactly clamps runtime scope without reading keys', async () => {
  const loaded = await loadJ4LiveAuthority({ repoRoot: REPO_ROOT })
  assert.equal(loaded.authority.runId, J4_LIVE_RUN_ID)
  assert.equal(J4_LIVE_RUN_ID, 'j4-longmemeval-s60-v2')
  assert.equal(loaded.authority.cumulativeQuestions, 5)
  assert.equal(loaded.authority.cumulativeCapUsd, 2.5)
  assert.equal(loaded.authority.fromCumulativeQuestions, 0)
  assert.equal(loaded.authority.previousCheckpointSha256, null)
  assert.equal(loaded.authoritySha256, J4_V2_AUTHORITY_SHA256)
  assert.equal(J4_CARRIED_ACCOUNTED_USD, 0.0004494)
  assert.equal(J4_FRESH_METER_CAP_USD, 2.4995506)
  assert.equal(
    Number((
      loaded.authority.cumulativeCapUsd - J4_CARRIED_ACCOUNTED_USD
    ).toFixed(7)),
    J4_FRESH_METER_CAP_USD,
  )

  const config = {
    tranches: [{
      cumulativeCapUsd: 2.5,
      cumulativeQuestions: 5,
      questions: 5,
    }],
  }
  const safeFakeEnv = {
    GEMINI_API_KEY: 'test-gemini-not-a-real-key',
    OPENAI_API_KEY: 'test-openai-not-a-real-key',
    PALARI_J4_CONFIRM_SPEND: '1',
    PALARI_J4_CUMULATIVE_QUESTIONS: '5',
    PALARI_J4_SPEND_CAP_USD: '2.5',
  }
  assert.deepEqual(
    assertJ4LiveEnvironment(safeFakeEnv, config, loaded.authority),
    {
      capUsd: 2.5,
      cumulativeQuestions: 5,
      geminiApiKey: safeFakeEnv.GEMINI_API_KEY,
      openaiApiKey: safeFakeEnv.OPENAI_API_KEY,
    },
  )
  assert.throws(
    () => assertJ4LiveEnvironment({
      ...safeFakeEnv,
      PALARI_J4_CUMULATIVE_QUESTIONS: '15',
      PALARI_J4_SPEND_CAP_USD: '7.5',
    }, {
      tranches: [{
        cumulativeCapUsd: 7.5,
        cumulativeQuestions: 15,
        questions: 10,
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

test('J4 v2 real config pins replacement provenance and exact artifacts', async () => {
  const loaded = await loadJ4LiveConfig({ repoRoot: REPO_ROOT })
  assert.equal(loaded.config.runId, 'j4-longmemeval-s60-v2')
  assert.equal(loaded.config.artifacts.length, 19)
  assert.deepEqual(loaded.config.predecessor, J4_REPLACEMENT_PREDECESSOR)
  assert.equal(loaded.config.predictions.path, J4_LIVE_PREDICTIONS_PATH)
  assert.equal(loaded.predictionsSha256, J4_V2_PREDICTIONS_SHA256)
  assert.equal(loaded.configSha256, J4_V2_CONFIG_SHA256)
})

test('J4 v2 config rejects omissions and artifact or predecessor tampering', async () => {
  const loaded = await loadJ4LiveConfig({ repoRoot: REPO_ROOT })
  const temporary = await mkdtemp(join(tmpdir(), 'palari-j4-config-'))
  try {
    const omitted = structuredClone(loaded.config)
    omitted.artifacts.pop()
    const omittedPath = join(temporary, 'omitted.json')
    await writeFile(omittedPath, `${JSON.stringify(omitted)}\n`, {
      mode: 0o600,
    })
    await assert.rejects(
      loadJ4LiveConfig({
        configPath: omittedPath,
        repoRoot: REPO_ROOT,
      }),
      /artifact paths/,
    )

    const tampered = structuredClone(loaded.config)
    tampered.artifacts[0].sha256 = '0'.repeat(64)
    const tamperedPath = join(temporary, 'tampered.json')
    await writeFile(tamperedPath, `${JSON.stringify(tampered)}\n`, {
      mode: 0o600,
    })
    await assert.rejects(
      loadJ4LiveConfig({
        configPath: tamperedPath,
        repoRoot: REPO_ROOT,
      }),
      /tracked artifact changed/,
    )

    const predecessorTampered = structuredClone(loaded.config)
    predecessorTampered.predecessor.accountedUsd = 0.0004495
    const predecessorTamperedPath = join(
      temporary,
      'predecessor-tampered.json',
    )
    await writeFile(
      predecessorTamperedPath,
      `${JSON.stringify(predecessorTampered)}\n`,
      { mode: 0o600 },
    )
    await assert.rejects(
      loadJ4LiveConfig({
        configPath: predecessorTamperedPath,
        repoRoot: REPO_ROOT,
      }),
      /replacement predecessor and carried spend/,
    )
  } finally {
    await rm(temporary, { force: true, recursive: true })
  }
})
