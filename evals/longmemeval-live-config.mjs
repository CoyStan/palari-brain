// Frozen configuration surface for the founder-gated J4 LongMemEval run.
//
// Importing this module is inert: it reads no credentials, opens no files, and
// performs no network work. The runner explicitly loads and verifies the
// tracked config only after canonical dataset validation.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { buildMemoryExtractionRequest } from '../src/memory-extraction.mjs'
import {
  MEMORY_EXTRACTION_RESPONSE_MIME_TYPE,
  MEMORY_EXTRACTION_RESPONSE_SCHEMA,
  MEMORY_EXTRACTION_SOURCE_KINDS,
  MEMORY_EXTRACTION_TYPES,
} from '../src/memory-extraction-schema.mjs'
import {
  LONGMEMEVAL_JUDGE_MODEL,
  LONGMEMEVAL_JUDGE_REQUEST,
  longMemEvalJudgeProvenance,
} from './longmemeval-judge.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  J4_PUBLIC_SAMPLE_QUESTION_IDS,
  J4_S60_STATS,
  J4_S_DATASET_CONTRACT,
  J4_STAGED_EXECUTION_ORDER_SHA256,
  J4_STAGED_TRANCHE_MANIFEST_SHA256,
  J4_V3_COMPATIBILITY_SMOKE_STATS,
  J4_V3_EXTRACTION_SCHEMA_CONTRACT,
  J4_V3_FIRST_TRANCHE_COST_ESTIMATE,
  J4_V3_FIRST_TRANCHE_REQUEST_STATS,
  J4_V5_FIRST_TRANCHE_COST_ESTIMATE,
  J4_V5_GEMINI_GENERATION_LIMITS,
  J4_V5_TRANCHE_GATES,
  SEALED_U8_QUESTION_IDS,
  estimatePalariLongMemEvalCost,
} from './longmemeval-plan.mjs'

export const J4_LIVE_RUN_ID = 'j4-longmemeval-s60-v6'
export const J4_LIVE_CONFIG_PATH =
  `evals/live-runs/${J4_LIVE_RUN_ID}.json`
export const J4_LIVE_AUTHORITY_PATH =
  `evals/live-runs/${J4_LIVE_RUN_ID}.authority.json`
export const J4_LIVE_PREDICTIONS_PATH =
  `evals/predictions/${J4_LIVE_RUN_ID}.json`
export const J4_GEMINI_MODEL = 'gemini-3.5-flash-lite'
export const J4_LIVE_RESULTS_ROOT = 'evals/results'
export const J4_CARRIED_ACCOUNTED_USD = 0.1952121
export const J4_CARRIED_MEASURED_USD = 0.1927111
export const J4_CARRIED_UNCERTAIN_USD = 0.002501
export const J4_FRESH_METER_CAP_USD = 6.8047879
export const J4_CUMULATIVE_CAP_USD = Number((
  J4_CARRIED_ACCOUNTED_USD + J4_FRESH_METER_CAP_USD
).toFixed(12))
export const J4_V6_CARRIED_ACCOUNTED_USD = 0.7721877
export const J4_V6_CARRIED_MEASURED_USD = 0.7696867
export const J4_V6_CARRIED_UNCERTAIN_USD = 0.002501
export const J4_V6_FRESH_METER_CAP_USD = 5
export const J4_V6_CUMULATIVE_CAP_USD = Number((
  J4_V6_CARRIED_ACCOUNTED_USD + J4_V6_FRESH_METER_CAP_USD
).toFixed(12))
export const J4_PREDECESSOR_CHAIN = deepFreeze({
  openingAccountedUsd: J4_CARRIED_ACCOUNTED_USD,
  runs: [
    {
      attempts: 1,
      completedQuestions: 0,
      currentRunAccountedUsd: 0.0004494,
      failedQuestionOrdinal: null,
      logicalRequests: { writer: 1 },
      openingAccountedUsd: 0,
      private: {
        artifactManifestPath:
          'evals/results/j4-longmemeval-s60-v1/artifact-manifest.json',
        artifactManifestSha256:
          '271c9685ffdd15392d71452a4d7e223958e340266b89d983402d02bced8448ad',
        checkpointPath:
          'evals/results/j4-longmemeval-s60-v1/checkpoint.json',
        checkpointSha256:
          'f985bdd31e43ca6c9bc4e02c03864f9431e7a72953daba456a3aefaea8cfa215',
        meterPath: 'evals/results/j4-longmemeval-s60-v1/meter.jsonl',
        meterSha256:
          'e819c456ddf40de85ea73706087fd208f38653a7e597967f0500242c50ba6a90',
      },
      runId: 'j4-longmemeval-s60-v1',
      smokeLogicalOperations: 0,
      smokeStatus: 'failed',
      status: 'failed',
      tracked: {
        authorityPath:
          'evals/live-runs/j4-longmemeval-s60-v1.authority.json',
        authoritySha256:
          '4354ee1f952694c756d0ec4e64d7facbc734456301e58ac2d9a930cb57609c13',
        configPath: 'evals/live-runs/j4-longmemeval-s60-v1.json',
        configSha256:
          '7e3619893e66984e4548c84cb23ab6c097f8372fbd29028b592e99a4f649d5ce',
        predictionsPath: 'evals/predictions/j4-longmemeval-s60.json',
        predictionsSha256:
          '07a262c01efa13697266c4e5d52829b518e9e16076e7b6046c78122ae0011028',
      },
    },
    {
      attempts: 24,
      completedQuestions: 0,
      currentRunAccountedUsd: 0.0146198,
      failedQuestionOrdinal: 1,
      logicalRequests: { writer: 24 },
      openingAccountedUsd: 0.0004494,
      private: {
        artifactManifestPath:
          'evals/results/j4-longmemeval-s60-v2/artifact-manifest.json',
        artifactManifestSha256:
          '99363dcde4c75c215545dd085fe40936422898cca26d24ad17b23b6cb28cb754',
        checkpointPath:
          'evals/results/j4-longmemeval-s60-v2/checkpoint.json',
        checkpointSha256:
          '33f28062c27292908d6a11ae67893552c335f1688b0ac45657cf55b9ade1c91f',
        meterPath: 'evals/results/j4-longmemeval-s60-v2/meter.jsonl',
        meterSha256:
          'c4c529cd830cd99143bfde1eaa41373c9d572457980be9b47d416bb1810df3a5',
      },
      runId: 'j4-longmemeval-s60-v2',
      smokeLogicalOperations: 1,
      smokeStatus: 'completed',
      status: 'failed',
      tracked: {
        authorityPath:
          'evals/live-runs/j4-longmemeval-s60-v2.authority.json',
        authoritySha256:
          '51091b6d280c099c32f12e2a75a0e11c85e9690a2dd92cee3c24a5ffc7a4a253',
        configPath: 'evals/live-runs/j4-longmemeval-s60-v2.json',
        configSha256:
          '7f63c0ea2e9e5f4e27e965d60118ce28e6b95e1aa7c74de0784a455d9e38df68',
        predictionsPath: 'evals/predictions/j4-longmemeval-s60-v2.json',
        predictionsSha256:
          'ccdf0b9bd8cc12256657c574d3189d6f4aebb9dd5e6e60ee0aaaaee63671714f',
      },
    },
    {
      attempts: 1,
      completedQuestions: 0,
      currentRunAccountedUsd: 0.002501,
      currentRunUncertainUsd: 0.002501,
      failedQuestionOrdinal: null,
      logicalRequests: { writer: 1 },
      openingAccountedUsd: 0.0150692,
      private: {
        artifactManifestPath:
          'evals/results/j4-longmemeval-s60-v3/artifact-manifest.json',
        artifactManifestSha256:
          'e6ccbe31d795ddb37b869291a5d1722af04c0f923afa486f2be168b8c35aaaa6',
        checkpointPath:
          'evals/results/j4-longmemeval-s60-v3/checkpoint.json',
        checkpointSha256:
          '68cbbb061c8237ca872ae412211368f4c919200627352e8fea9a9f6fff3adbd3',
        meterPath: 'evals/results/j4-longmemeval-s60-v3/meter.jsonl',
        meterSha256:
          'abc8ceb3797f5b061b16a3ad0397d229c7acbf005668be565a81e0fbde484277',
      },
      runId: 'j4-longmemeval-s60-v3',
      smokeLogicalOperations: 0,
      smokeStatus: 'failed',
      status: 'failed',
      tracked: {
        authorityPath:
          'evals/live-runs/j4-longmemeval-s60-v3.authority.json',
        authoritySha256:
          '4b4dbc036a23737d6c729e5ee153d362caad0b60f0bae12a64a0bd2da8f71735',
        configPath: 'evals/live-runs/j4-longmemeval-s60-v3.json',
        configSha256:
          '91bc18330bb92b83b1a28d32d21d8dfbc4ea2b0cffa3044e31c0e5c3a12b6b88',
        predictionsPath: 'evals/predictions/j4-longmemeval-s60-v3.json',
        predictionsSha256:
          '201a41bd326f19d350ab45719f95fcf73a1d5d0159cf60c4ccee9992281460bf',
      },
    },
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
  ],
})

// Keep the v1-v4 export byte-for-byte compatible with the historical active
// runner. V6 extends that sealed chain without changing its consumers.
export const J4_V6_PREDECESSOR_CHAIN = deepFreeze({
  openingAccountedUsd: J4_V6_CARRIED_ACCOUNTED_USD,
  runs: [
    ...J4_PREDECESSOR_CHAIN.runs,
    {
      attempts: 1_203,
      completedQuestions: 5,
      currentRunAccountedUsd: 0.5769756,
      failedQuestionOrdinal: null,
      logicalRequests: { answer: 6, judge: 5, writer: 1_192 },
      openingAccountedUsd: 0.1952121,
      private: {
        artifactManifestPath:
          'evals/results/j4-longmemeval-s60-v5/artifact-manifest.json',
        artifactManifestSha256:
          '22250ab01b8202319dd54d739561ef54d1b3685efb8e5fae8aed92d3d9dba1d6',
        checkpointPath:
          'evals/results/j4-longmemeval-s60-v5/checkpoint.json',
        checkpointSha256:
          'bc46d9272f1d788fb06b826a6219c8448b19b0f361aaa0c9d9b68bd53fca8805',
        meterPath: 'evals/results/j4-longmemeval-s60-v5/meter.jsonl',
        meterSha256:
          '22d8d51dd9844409ed6f4640c81903f6916b5cff325ee4561b4e4d94cdb0abe8',
      },
      runId: 'j4-longmemeval-s60-v5',
      smokeLogicalOperations: 2,
      smokeStatus: 'completed',
      status: 'paused',
      tracked: {
        authorityPath:
          'evals/live-runs/j4-longmemeval-s60-v5.authority.json',
        authoritySha256:
          '0f0ce76625a2e9e16bd3fbd171bb08568e88111811ad4d2fadd5f5889e1f45ba',
        configPath: 'evals/live-runs/j4-longmemeval-s60-v5.json',
        configSha256:
          '7319f3ae754eaca9935f70c8a2e8a66ccfde949a02729e7662d1d71f89bc4f3f',
        predictionsPath: 'evals/predictions/j4-longmemeval-s60-v5.json',
        predictionsSha256:
          '9adbc808c93fda63397ac7b304af7347443ca2940adf722d231c60165f08e7d6',
      },
    },
  ],
})
export const J4_PREDICTION_ROWS_SHA256 =
  '12eabc841b63aac5164e828d64bd0e118750337192e3b5984f7d7a3924272351'
export const J4_REQUIRED_ARTIFACT_PATHS = Object.freeze([
  'evals/arms/kernel-longmemeval-live-arm.mjs',
  'evals/live-transcript.mjs',
  'evals/longmemeval-judge.mjs',
  'evals/longmemeval-live-config.mjs',
  'evals/longmemeval-live-meter.mjs',
  'evals/longmemeval-plan.mjs',
  'evals/run-longmemeval-live.mjs',
  'src/adapter.mjs',
  'src/gate.mjs',
  'src/gemini.mjs',
  'src/longmemeval.mjs',
  'src/memory-briefing.mjs',
  'src/memory-extraction.mjs',
  'src/memory-extraction-schema.mjs',
  'src/memory-store.mjs',
  'src/recall.mjs',
  'src/routing-budgets.mjs',
  'src/store.mjs',
  'src/util.mjs',
  'src/v05-memory-extraction.mjs',
])
export const J4_RETRY_LIMIT = 3
export const J4_REQUEST_TIMEOUT_MS = 60_000
export const J4_MAX_RESPONSE_BYTES = 4 * 1024 * 1024
export const J4_PRICES_USD_PER_TOKEN = Object.freeze({
  geminiInput: 0.30 / 1_000_000,
  geminiOutputIncludingThinking: 2.50 / 1_000_000,
  judgeInput: 2.50 / 1_000_000,
  judgeOutput: 10.00 / 1_000_000,
})

function roundedUsd(value) {
  return Number(Number(value).toFixed(7))
}

export const J4_V4_CUMULATIVE_COST_ESTIMATE = deepFreeze({
  capUsd: 2.5,
  carriedAccountedUsd: 0.0175702,
  compatibilitySmoke: J4_V3_COMPATIBILITY_SMOKE_STATS,
  conservative: {
    cumulativeUsd: roundedUsd(
      0.0175702 +
      J4_V3_FIRST_TRANCHE_COST_ESTIMATE.conservative.freshUsd,
    ),
    freshUsd: roundedUsd(
      J4_V3_FIRST_TRANCHE_COST_ESTIMATE.conservative.freshUsd,
    ),
    tokens: J4_V3_FIRST_TRANCHE_COST_ESTIMATE.conservative.tokens,
  },
  expected: {
    cumulativeUsd: roundedUsd(
      0.0175702 +
      J4_V3_FIRST_TRANCHE_COST_ESTIMATE.expected.freshUsd,
    ),
    freshUsd: roundedUsd(
      J4_V3_FIRST_TRANCHE_COST_ESTIMATE.expected.freshUsd,
    ),
    tokens: J4_V3_FIRST_TRANCHE_COST_ESTIMATE.expected.tokens,
  },
  freshMeterCapUsd: 2.4824298,
  methodVersion: 'j4-v4-mime-enum-three-predecessors-v1',
  requestStats: J4_V3_FIRST_TRANCHE_REQUEST_STATS,
  schema: J4_V3_EXTRACTION_SCHEMA_CONTRACT,
})

export const J4_V5_CUMULATIVE_COST_ESTIMATE = deepFreeze({
  capUsd: 7,
  carriedAccountedUsd: 0.1952121,
  carriedMeasuredUsd: 0.1927111,
  carriedUncertainUsd: 0.002501,
  compatibilitySmoke: J4_V3_COMPATIBILITY_SMOKE_STATS,
  conservative: {
    cumulativeUsd: roundedUsd(
      0.1952121 +
      J4_V5_FIRST_TRANCHE_COST_ESTIMATE.conservative.freshUsd,
    ),
    freshUsd: roundedUsd(
      J4_V5_FIRST_TRANCHE_COST_ESTIMATE.conservative.freshUsd,
    ),
    tokens: J4_V5_FIRST_TRANCHE_COST_ESTIMATE.conservative.tokens,
  },
  expected: {
    cumulativeUsd: roundedUsd(
      0.1952121 +
      J4_V5_FIRST_TRANCHE_COST_ESTIMATE.expected.freshUsd,
    ),
    freshUsd: roundedUsd(
      J4_V5_FIRST_TRANCHE_COST_ESTIMATE.expected.freshUsd,
    ),
    tokens: J4_V5_FIRST_TRANCHE_COST_ESTIMATE.expected.tokens,
  },
  freshMeterCapUsd: 6.8047879,
  methodVersion: 'j4-v5-fixed-2000-four-predecessors-v1',
  requestStats: J4_V3_FIRST_TRANCHE_REQUEST_STATS,
  schema: J4_V3_EXTRACTION_SCHEMA_CONTRACT,
})

const j4V6S60Estimate = estimatePalariLongMemEvalCost(J4_S60_STATS)

export const J4_V6_TRANCHE_GATES = Object.freeze([
  Object.freeze({
    cumulativeCapUsd: J4_V6_CUMULATIVE_CAP_USD,
    cumulativeQuestions: 60,
    questions: 60,
  }),
])

export const J4_V6_CUMULATIVE_COST_ESTIMATE = deepFreeze({
  capUsd: J4_V6_CUMULATIVE_CAP_USD,
  carriedAccountedUsd: J4_V6_CARRIED_ACCOUNTED_USD,
  carriedMeasuredUsd: J4_V6_CARRIED_MEASURED_USD,
  carriedUncertainUsd: J4_V6_CARRIED_UNCERTAIN_USD,
  compatibilitySmoke: {
    ...J4_V3_COMPATIBILITY_SMOKE_STATS,
    writerCalls: 2,
  },
  expected: {
    cumulativeUsd: roundedUsd(
      J4_V6_CARRIED_ACCOUNTED_USD + j4V6S60Estimate.totalUsd,
    ),
    freshUsd: roundedUsd(j4V6S60Estimate.totalUsd),
    tokens: j4V6S60Estimate.tokens,
  },
  freshMeterCapUsd: J4_V6_FRESH_METER_CAP_USD,
  methodVersion: 'j4-v6-s60-one-repair-five-predecessors-v1',
  projectionExceedsCap: j4V6S60Estimate.totalUsd >
    J4_V6_FRESH_METER_CAP_USD,
  repairEnvelope:
    'Every writer has at most one host-guided proposal repair. The $5.00 meter, not this uncapped projection, is the billing boundary.',
  requestStats: J4_S60_STATS,
  schema: J4_V3_EXTRACTION_SCHEMA_CONTRACT,
})

function cumulativeLimits({
  cumulativeCapUsd,
  cumulativeQuestions,
  maxAttempts,
  answer,
  judge,
  writer,
}) {
  return Object.freeze({
    cumulativeCapUsd,
    cumulativeQuestions,
    meter: Object.freeze({
      maxAttempts,
      maxLogicalRequests: Object.freeze({ answer, judge, writer }),
      maxTokens: Object.freeze({
        geminiInput: Math.floor(cumulativeCapUsd * 1_000_000 / 0.30),
        geminiOutputIncludingThinking: Math.floor(
          cumulativeCapUsd * 1_000_000 / 2.50,
        ),
        judgeInput: Math.floor(cumulativeCapUsd * 1_000_000 / 2.50),
        judgeOutput: Math.floor(cumulativeCapUsd * 1_000_000 / 10.00),
      }),
      maxResponseBytes: J4_MAX_RESPONSE_BYTES,
      requestTimeoutMs: J4_REQUEST_TIMEOUT_MS,
      retryLimit: J4_RETRY_LIMIT,
    }),
  })
}

// One invocation may attempt every S-60 question. Each logical writer
// operation has at most one separately metered host-guided proposal repair.
// The meter can still stop before question 60 when the $5 fresh cap binds.
export const J4_CUMULATIVE_LIMITS = Object.freeze([
  cumulativeLimits({
    answer: 61,
    cumulativeCapUsd: J4_V6_CUMULATIVE_CAP_USD,
    cumulativeQuestions: 60,
    judge: 60,
    maxAttempts: 117_700,
    writer: 29_304,
  }),
])

export const J4_TRANCHE_1_LIMITS = J4_CUMULATIVE_LIMITS[0].meter

export function j4LimitsForCumulativeQuestions(value) {
  const found = J4_CUMULATIVE_LIMITS.find(
    (entry) => entry.cumulativeQuestions === Number(value),
  )
  if (!found) {
    throw new J4ConfigError(
      'LIMITS_GATE_INVALID',
      'J4 has no frozen limits for that cumulative boundary.',
    )
  }
  return found.meter
}

export const J4_GEMINI_WRITER_GENERATION = Object.freeze({
  maxOutputTokens: J4_V5_GEMINI_GENERATION_LIMITS.writerMaxOutputTokens,
  responseFormat: Object.freeze({
    text: Object.freeze({
      mimeType: MEMORY_EXTRACTION_RESPONSE_MIME_TYPE,
      schema: MEMORY_EXTRACTION_RESPONSE_SCHEMA,
    }),
  }),
  thinkingConfig: Object.freeze({ thinkingLevel: 'MINIMAL' }),
})

export const J4_GEMINI_ANSWER_GENERATION = Object.freeze({
  maxOutputTokens: J4_V5_GEMINI_GENERATION_LIMITS.answerMaxOutputTokens,
  thinkingConfig: Object.freeze({ thinkingLevel: 'MINIMAL' }),
})

export const J4_OFFICIAL_FACT_TEMPLATE = [
  'I will give you several facts extracted from history chats between you and a user. Please answer the question based on the relevant facts.',
  '',
  '',
  'History Chats:',
  '',
  '{}',
  '',
  'Current Date: {}',
  'Question: {}',
  'Answer:',
].join('\n')

export class J4ConfigError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'J4ConfigError'
    this.code = code
  }
}

export function j4Sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function formatTemplate(template, values) {
  let index = 0
  const output = template.replaceAll('{}', () => String(values[index++] ?? ''))
  if (index !== values.length) {
    throw new J4ConfigError(
      'ANSWER_TEMPLATE_ARITY',
      'J4 answer template/value arity mismatch.',
    )
  }
  return output
}

export function formatJ4QuestionDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new J4ConfigError(
      'QUESTION_DATE_INVALID',
      'J4 question date must be a valid timestamp.',
    )
  }
  return date.toISOString().slice(0, 10).replaceAll('-', '/')
}

export function buildJ4AnswerPrompt({
  facts = '',
  question = '',
  questionDate,
} = {}) {
  return formatTemplate(J4_OFFICIAL_FACT_TEMPLATE, [
    String(facts),
    formatJ4QuestionDate(questionDate),
    String(question),
  ])
}

export function buildJ4WriterBody(turn = {}) {
  const request = buildMemoryExtractionRequest({ turn })
  return {
    contents: request.contents,
    generationConfig: {
      maxOutputTokens: J4_GEMINI_WRITER_GENERATION.maxOutputTokens,
      responseFormat: {
        text: {
          mimeType:
            J4_GEMINI_WRITER_GENERATION.responseFormat.text.mimeType,
          schema:
            J4_GEMINI_WRITER_GENERATION.responseFormat.text.schema,
        },
      },
      thinkingConfig: {
        thinkingLevel:
          J4_GEMINI_WRITER_GENERATION.thinkingConfig.thinkingLevel,
      },
    },
    store: false,
    systemInstruction: request.systemInstruction,
  }
}

export function buildJ4AnswerBody(prompt, {
  generation = J4_GEMINI_ANSWER_GENERATION,
} = {}) {
  return {
    contents: [{
      parts: [{ text: String(prompt) }],
      role: 'user',
    }],
    generationConfig: {
      maxOutputTokens: generation.maxOutputTokens,
      thinkingConfig: {
        thinkingLevel: generation.thinkingConfig.thinkingLevel,
      },
    },
    store: false,
  }
}

export function j4ExtractionPromptSha256() {
  const body = buildJ4WriterBody({
    assistantMessage: '',
    palariId: 'palari-longmemeval-j4',
    palariName: 'Palari',
    sourceMessageId: 'session:0',
    sourceTexts: [],
    userId: 'user-longmemeval-j4',
    userMessage: '',
    userName: 'user',
  })
  return j4Sha256(JSON.stringify({
    generationConfig: body.generationConfig,
    systemInstruction: body.systemInstruction,
  }))
}

export function j4ExecutionQuestionIds() {
  const sentinels = new Set(J4_FIRST_TRANCHE_QUESTION_IDS)
  return [
    ...J4_FIRST_TRANCHE_QUESTION_IDS,
    ...J4_PUBLIC_SAMPLE_QUESTION_IDS
      .filter((questionId) => !sentinels.has(questionId))
      .sort(),
  ]
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new J4ConfigError('CONFIG_SCHEMA', `${label} must be an object.`)
  }
}

function assertExactKeys(value, keys, label) {
  assertPlainObject(value, label)
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new J4ConfigError(
      'CONFIG_SCHEMA',
      `${label} keys differ from the frozen schema.`,
    )
  }
}

function assertEqual(actual, expected, label) {
  if (stableStringify(actual) !== stableStringify(expected)) {
    throw new J4ConfigError(
      'CONFIG_MISMATCH',
      `${label} differs from the frozen J4 contract.`,
    )
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  )
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function assertSha(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value ?? ''))) {
    throw new J4ConfigError('CONFIG_SCHEMA', `${label} must be one SHA-256.`)
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function validatePredictions(value) {
  assertExactKeys(value, [
    'basisDefinitions',
    'decisionReference',
    'executionPredictions',
    'frozenAt',
    'method',
    'models',
    'population',
    'predictions',
    'promptConfig',
    'rowArraySha256',
    'rowSource',
    'runId',
    'schemaVersion',
    'status',
    'summary',
  ], 'J4 predictions')
  assertEqual(value.schemaVersion, 1, 'prediction schema version')
  assertEqual(value.status, 'FINAL', 'prediction status')
  assertEqual(value.runId, J4_LIVE_RUN_ID, 'prediction run ID')
  assertEqual(value.models, {
    answer: J4_GEMINI_MODEL,
    judge: LONGMEMEVAL_JUDGE_MODEL,
    writer: J4_GEMINI_MODEL,
  }, 'prediction models')
  assertEqual(value.promptConfig, {
    answer: {
      chainOfThought: false,
      maxOutputTokens: J4_V5_GEMINI_GENERATION_LIMITS.answerMaxOutputTokens,
      store: false,
      template: 'official-longmemeval-fact-memory',
      thinkingLevel: J4_V5_GEMINI_GENERATION_LIMITS.thinkingLevel,
    },
    judge: {
      parser: 'official-response-contains-yes',
      unchanged: true,
    },
    writer: {
      maxOutputTokens: J4_V5_GEMINI_GENERATION_LIMITS.writerMaxOutputTokens,
      maxRepairs: 1,
      repairIsTransportRetry: false,
      responseFormat: 'APPLICATION_JSON+json-schema',
      schemaSha256: J4_V3_EXTRACTION_SCHEMA_CONTRACT.sha256,
      sourceKindVocabulary: MEMORY_EXTRACTION_SOURCE_KINDS,
      store: false,
      thinkingLevel: J4_V5_GEMINI_GENERATION_LIMITS.thinkingLevel,
      typeVocabulary: MEMORY_EXTRACTION_TYPES,
    },
  }, 'prediction prompt config')
  assertEqual(value.decisionReference, {
    cumulativeHardCapUsd: J4_V6_CUMULATIVE_CAP_USD,
    date: '2026-07-30',
    document: 'docs/DECISIONS.md',
    entry: 'FOUNDER GO — J4 v6 one-shot S-60 repair run',
    freshHardCapUsd: J4_V6_FRESH_METER_CAP_USD,
    questions: 60,
  }, 'prediction founder decision reference')
  if (value.method?.finalizedBeforeProviderCalls !== true) {
    throw new J4ConfigError(
      'PREDICTIONS_SCHEMA',
      'J4 predictions must state that they were finalized before calls.',
    )
  }
  assertPlainObject(value.population, 'prediction population')
  assertEqual(
    value.population.executionOrderSha256,
    J4_STAGED_EXECUTION_ORDER_SHA256,
    'prediction execution-order hash',
  )
  assertEqual(value.population.questions, 60, 'prediction question count')
  assertEqual(
    value.population.selectedQuestionIdsSha256,
    'c720306125284ae03813ed131a044cd6b22d5301ad817da2907a6043768baa3a',
    'prediction selected-ID hash',
  )
  assertPlainObject(value.basisDefinitions, 'prediction basis definitions')
  if (!Array.isArray(value.predictions)) {
    throw new J4ConfigError(
      'PREDICTIONS_SCHEMA',
      'J4 predictions must contain an ordered predictions array.',
    )
  }
  const expectedIds = j4ExecutionQuestionIds()
  const actualIds = value.predictions.map((entry) => entry?.questionId)
  assertEqual(actualIds, expectedIds, 'prediction question order')
  if (new Set(actualIds).size !== expectedIds.length) {
    throw new J4ConfigError(
      'PREDICTIONS_SCHEMA',
      'J4 prediction question IDs must be unique.',
    )
  }
  for (let index = 0; index < value.predictions.length; index += 1) {
    const entry = value.predictions[index]
    assertExactKeys(entry, [
      'basisCode',
      'isAbstention',
      'ordinal',
      'predictedFailureStage',
      'predictedOfficialCorrect',
      'questionId',
      'questionType',
    ], `J4 prediction ${index + 1}`)
    assertEqual(entry.ordinal, index + 1, `prediction ${index + 1} ordinal`)
    if (typeof entry.predictedOfficialCorrect !== 'boolean') {
      throw new J4ConfigError(
        'PREDICTIONS_SCHEMA',
        `Prediction ${index + 1} must predict a Boolean official outcome.`,
      )
    }
    if (!['answer', 'none', 'retrieval', 'write'].includes(
      entry.predictedFailureStage,
    )) {
      throw new J4ConfigError(
        'PREDICTIONS_SCHEMA',
        `Prediction ${index + 1} has an invalid failure stage.`,
      )
    }
    if (entry.isAbstention !== entry.questionId.endsWith('_abs') ||
      entry.predictedOfficialCorrect !==
        (entry.predictedFailureStage === 'none') ||
      typeof entry.questionType !== 'string' ||
      !Object.hasOwn(value.basisDefinitions, entry.basisCode)) {
      throw new J4ConfigError(
        'PREDICTIONS_SCHEMA',
        `Prediction ${index + 1} has inconsistent metadata or basis.`,
      )
    }
  }
  assertEqual(
    j4Sha256(JSON.stringify(value.predictions)),
    J4_PREDICTION_ROWS_SHA256,
    'prediction row-array hash',
  )
  assertEqual(
    value.rowArraySha256,
    J4_PREDICTION_ROWS_SHA256,
    'declared prediction row-array hash',
  )
  assertEqual(value.rowSource, {
    path: 'evals/predictions/j4-longmemeval-s60-v5.json',
    runId: 'j4-longmemeval-s60-v5',
    sha256:
      '9adbc808c93fda63397ac7b304af7347443ca2940adf722d231c60165f08e7d6',
  }, 'prediction row source')
  assertEqual(value.executionPredictions, {
    capStopIsTerminal: true,
    completedQuestionsMaximum: 55,
    completedQuestionsMinimum: 35,
    noRegrade: true,
    noReroll: true,
    predictedCapStopBeforeQuestion60: true,
    smokeAnswerPasses: true,
    smokeWriterPassesWithinOneRepair: true,
  }, 'execution predictions')
  assertPlainObject(value.decisionReference, 'prediction decision reference')
  assertPlainObject(value.method, 'prediction method')
  assertPlainObject(value.promptConfig, 'prediction prompt config')
  assertPlainObject(value.summary, 'prediction summary')
  assertEqual(value.summary, {
    byType: {
      'knowledge-update': '9/10',
      'multi-session': '6/10',
      'single-session-assistant': '0/10',
      'single-session-preference': '4/10',
      'single-session-user': '10/10',
      'temporal-reasoning': '7/10',
    },
    failureStages: {
      answer: 0,
      retrieval: 16,
      write: 8,
    },
    predictedCorrect: 36,
    predictedIncorrect: 24,
  }, 'prediction summary')
  assertEqual(value.method, {
    finalizedBeforeProviderCalls: true,
    hypotheses: [
      'direct-user write boundary',
      'lexical FTS recall with a five-term query limit and no stemming',
    ],
    note:
      'All 60 outcome rows remain byte-identical to v5. V6 adds one bounded host-guided repair for a rejected writer proposal, carries five terminal predecessors, and starts from zero completed questions. The prior five-question result was not used to revise any outcome row. Historical spend projects the $5 fresh cap may stop the run before question 60; such a cap stop is the preregistered execution finding, not authority to rerun.',
  }, 'prediction method')
  return value
}

export function j4V6DerivedContract() {
  return deepFreeze({
    costEstimate: J4_V6_CUMULATIVE_COST_ESTIMATE,
    dataset: {
      path: 'data/longmemeval_s_cleaned.json',
      sha256: J4_S_DATASET_CONTRACT.sha256,
    },
    generation: {
      answerMaxOutputTokens:
        J4_V5_GEMINI_GENERATION_LIMITS.answerMaxOutputTokens,
      judgeMaxTokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
      judgeN: LONGMEMEVAL_JUDGE_REQUEST.n,
      judgeTemperature: LONGMEMEVAL_JUDGE_REQUEST.temperature,
      thinkingLevel: J4_V5_GEMINI_GENERATION_LIMITS.thinkingLevel,
      writerMaxOutputTokens:
        J4_V5_GEMINI_GENERATION_LIMITS.writerMaxOutputTokens,
      writerMaxRepairs: 1,
    },
    limits: J4_CUMULATIVE_LIMITS,
    models: {
      answer: J4_GEMINI_MODEL,
      judge: LONGMEMEVAL_JUDGE_MODEL,
      writer: J4_GEMINI_MODEL,
    },
    population: {
      executionOrderSha256: J4_STAGED_EXECUTION_ORDER_SHA256,
      questions: 60,
      sealedQuestionIds: SEALED_U8_QUESTION_IDS,
      trancheManifestSha256: J4_STAGED_TRANCHE_MANIFEST_SHA256,
    },
    predecessorChain: J4_V6_PREDECESSOR_CHAIN,
    pricesUsdPerToken: J4_PRICES_USD_PER_TOKEN,
    prompts: {
      answerTemplateSha256: j4Sha256(J4_OFFICIAL_FACT_TEMPLATE),
      extractionPromptSha256: j4ExtractionPromptSha256(),
      judgeSourceSha256: longMemEvalJudgeProvenance.sourceSha256,
    },
    tranches: J4_V6_TRANCHE_GATES,
  })
}

function validateConfig(config) {
  assertExactKeys(config, [
    'artifacts',
    'contractSha256',
    'predictions',
    'runDate',
    'runId',
    'schemaVersion',
  ], 'J4 live config')
  assertEqual(config.schemaVersion, 1, 'config schema version')
  assertEqual(config.runId, J4_LIVE_RUN_ID, 'config run ID')
  assertEqual(config.runDate, '2026-07-30', 'config run date')
  const derived = j4V6DerivedContract()
  assertEqual(config.contractSha256, j4Sha256(
    stableStringify(derived),
  ), 'derived contract hash')
  assertEqual(derived.dataset, {
    path: 'data/longmemeval_s_cleaned.json',
    sha256: J4_S_DATASET_CONTRACT.sha256,
  }, 'dataset identity')
  assertEqual(derived.models, {
    answer: J4_GEMINI_MODEL,
    judge: LONGMEMEVAL_JUDGE_MODEL,
    writer: J4_GEMINI_MODEL,
  }, 'provider models')
  assertEqual(derived.limits, J4_CUMULATIVE_LIMITS, 'cumulative hard limits')
  assertEqual(
    derived.pricesUsdPerToken,
    J4_PRICES_USD_PER_TOKEN,
    'provider prices',
  )
  assertEqual(derived.population, {
    executionOrderSha256: J4_STAGED_EXECUTION_ORDER_SHA256,
    questions: 60,
    sealedQuestionIds: SEALED_U8_QUESTION_IDS,
    trancheManifestSha256: J4_STAGED_TRANCHE_MANIFEST_SHA256,
  }, 'population contract')
  assertEqual(derived.costEstimate, J4_V6_CUMULATIVE_COST_ESTIMATE, 'cost estimate')
  assertEqual(
    derived.predecessorChain,
    J4_V6_PREDECESSOR_CHAIN,
    'replacement predecessor chain and carried spend',
  )
  assertEqual(derived.tranches, J4_V6_TRANCHE_GATES, 'tranche gates')
  assertEqual(derived.prompts, {
    answerTemplateSha256: j4Sha256(J4_OFFICIAL_FACT_TEMPLATE),
    extractionPromptSha256: j4ExtractionPromptSha256(),
    judgeSourceSha256: longMemEvalJudgeProvenance.sourceSha256,
  }, 'prompt hashes')
  assertExactKeys(
    config.predictions,
    ['path', 'sha256'],
    'prediction reference',
  )
  assertSha(config.predictions.sha256, 'prediction hash')
  if (config.predictions.path !== J4_LIVE_PREDICTIONS_PATH) {
    throw new J4ConfigError(
      'CONFIG_MISMATCH',
      'J4 config prediction path differs from the frozen contract.',
    )
  }
  if (!Array.isArray(config.artifacts) || config.artifacts.length < 1) {
    throw new J4ConfigError(
      'CONFIG_SCHEMA',
      'J4 config must hash-pin its tracked implementation artifacts.',
    )
  }
  const paths = new Set()
  for (const artifact of config.artifacts) {
    assertExactKeys(artifact, ['path', 'sha256'], 'J4 artifact')
    if (typeof artifact.path !== 'string' ||
      !artifact.path ||
      artifact.path.startsWith('/') ||
      artifact.path.split('/').includes('..') ||
      paths.has(artifact.path)) {
      throw new J4ConfigError(
        'CONFIG_SCHEMA',
        'J4 artifact paths must be unique safe repository-relative paths.',
      )
    }
    assertSha(artifact.sha256, `artifact ${artifact.path} hash`)
    paths.add(artifact.path)
  }
  assertEqual(
    [...paths].sort(),
    [...J4_REQUIRED_ARTIFACT_PATHS].sort(),
    'tracked evaluation artifact paths',
  )
  return deepFreeze({
    ...config,
    ...derived,
  })
}

export async function loadJ4LiveConfig({
  configPath = J4_LIVE_CONFIG_PATH,
  repoRoot,
} = {}) {
  if (!repoRoot) {
    throw new J4ConfigError(
      'CONFIG_REPO_ROOT',
      'J4 config loading requires the repository root.',
    )
  }
  const root = resolve(repoRoot)
  const configText = await readFile(resolve(root, configPath), 'utf8')
  let config
  try {
    config = validateConfig(JSON.parse(configText))
  } catch (error) {
    if (error instanceof J4ConfigError) throw error
    throw new J4ConfigError(
      'CONFIG_JSON',
      'J4 live config is not valid JSON.',
      { cause: error },
    )
  }
  const predictionsText = await readFile(
    resolve(root, config.predictions.path),
    'utf8',
  )
  if (j4Sha256(predictionsText) !== config.predictions.sha256) {
    throw new J4ConfigError(
      'PREDICTIONS_HASH',
      'J4 FINAL predictions differ from their frozen hash.',
    )
  }
  let predictionContract
  try {
    predictionContract = JSON.parse(predictionsText)
  } catch (error) {
    throw new J4ConfigError(
      'PREDICTIONS_JSON',
      'J4 FINAL predictions are not valid JSON.',
      { cause: error },
    )
  }
  assertExactKeys(predictionContract, [
    'decisionReference',
    'executionPredictions',
    'frozenAt',
    'method',
    'models',
    'population',
    'promptConfig',
    'rowArraySha256',
    'rowSource',
    'runId',
    'schemaVersion',
    'status',
    'summary',
  ], 'J4 prediction contract')
  assertEqual(predictionContract.rowSource, {
    path: 'evals/predictions/j4-longmemeval-s60-v5.json',
    runId: 'j4-longmemeval-s60-v5',
    sha256:
      '9adbc808c93fda63397ac7b304af7347443ca2940adf722d231c60165f08e7d6',
  }, 'prediction row source')
  const rowSourceText = await readFile(
    resolve(root, predictionContract.rowSource.path),
    'utf8',
  )
  if (j4Sha256(rowSourceText) !== predictionContract.rowSource.sha256) {
    throw new J4ConfigError(
      'PREDICTION_ROW_SOURCE_CHANGED',
      'J4 inherited outcome rows differ from their frozen terminal source.',
    )
  }
  let rowSource
  try {
    rowSource = JSON.parse(rowSourceText)
  } catch (cause) {
    throw new J4ConfigError(
      'PREDICTION_ROW_SOURCE_INVALID',
      'J4 inherited outcome rows are not valid JSON.',
      { cause },
    )
  }
  const predictions = validatePredictions({
    ...predictionContract,
    basisDefinitions: rowSource.basisDefinitions,
    predictions: rowSource.predictions,
  })
  for (const artifact of config.artifacts) {
    const text = await readFile(resolve(root, artifact.path))
    if (j4Sha256(text) !== artifact.sha256) {
      throw new J4ConfigError(
        'ARTIFACT_HASH',
        `J4 tracked artifact changed: ${artifact.path}.`,
      )
    }
  }
  return deepFreeze({
    config,
    configPath,
    configSha256: j4Sha256(configText),
    predictions,
    predictionsSha256: j4Sha256(predictionsText),
  })
}

export async function loadJ4LiveAuthority({
  authorityPath = J4_LIVE_AUTHORITY_PATH,
  repoRoot,
} = {}) {
  if (!repoRoot) {
    throw new J4ConfigError(
      'AUTHORITY_REPO_ROOT',
      'J4 authority loading requires the repository root.',
    )
  }
  const text = await readFile(resolve(repoRoot, authorityPath), 'utf8')
  let authority
  try {
    authority = JSON.parse(text)
  } catch (error) {
    throw new J4ConfigError(
      'AUTHORITY_JSON',
      'J4 live authority is not valid JSON.',
      { cause: error },
    )
  }
  assertExactKeys(authority, [
    'cumulativeCapUsd',
    'cumulativeQuestions',
    'decisionReference',
    'founderGoDate',
    'fromCumulativeQuestions',
    'previousCheckpointSha256',
    'runId',
    'schemaVersion',
  ], 'J4 live authority')
  assertEqual(authority.schemaVersion, 1, 'authority schema version')
  assertEqual(authority.runId, J4_LIVE_RUN_ID, 'authority run ID')
  const gateIndex = J4_V6_TRANCHE_GATES.findIndex((entry) =>
    entry.cumulativeQuestions === authority.cumulativeQuestions &&
    entry.cumulativeCapUsd === authority.cumulativeCapUsd)
  if (gateIndex < 0) {
    throw new J4ConfigError(
      'AUTHORITY_GATE_INVALID',
      'J4 authority is not one frozen tranche gate.',
    )
  }
  const expectedFrom = gateIndex === 0
    ? 0
    : J4_V6_TRANCHE_GATES[gateIndex - 1].cumulativeQuestions
  if (authority.fromCumulativeQuestions !== expectedFrom ||
    (expectedFrom === 0 && authority.previousCheckpointSha256 !== null) ||
    (expectedFrom > 0 &&
      !/^[a-f0-9]{64}$/.test(authority.previousCheckpointSha256 ?? ''))) {
    throw new J4ConfigError(
      'AUTHORITY_PREDECESSOR_INVALID',
      'J4 authority must name the immediately preceding checkpoint boundary.',
    )
  }
  if (typeof authority.founderGoDate !== 'string' ||
    typeof authority.decisionReference !== 'string' ||
    !authority.founderGoDate ||
    !authority.decisionReference) {
    throw new J4ConfigError(
      'AUTHORITY_SCHEMA',
      'J4 authority must identify the founder GO and decision record.',
    )
  }
  return deepFreeze({
    authority,
    authorityPath,
    authoritySha256: j4Sha256(text),
  })
}

export function assertJ4LiveEnvironment(env, config, authority) {
  if (env.PALARI_J4_CONFIRM_SPEND !== '1') {
    throw new J4ConfigError(
      'SPEND_NOT_CONFIRMED',
      'PALARI_J4_CONFIRM_SPEND must equal 1.',
    )
  }
  const cumulativeQuestions = Number(env.PALARI_J4_CUMULATIVE_QUESTIONS)
  const capUsd = Number(env.PALARI_J4_SPEND_CAP_USD)
  const gate = config.tranches.find((entry) =>
    entry.cumulativeQuestions === cumulativeQuestions &&
    entry.cumulativeCapUsd === capUsd)
  if (!gate) {
    throw new J4ConfigError(
      'TRANCHE_AUTHORITY_MISMATCH',
      'J4 question boundary and cumulative cap are not one frozen gate.',
    )
  }
  if (!authority ||
    authority.runId !== J4_LIVE_RUN_ID ||
    authority.cumulativeQuestions !== cumulativeQuestions ||
    authority.cumulativeCapUsd !== capUsd) {
    throw new J4ConfigError(
      'TRANCHE_NOT_AUTHORIZED',
      'The runtime boundary does not match the current founder authority.',
    )
  }
  const geminiApiKey = String(env.GEMINI_API_KEY ?? '').trim()
  const openaiApiKey = String(env.OPENAI_API_KEY ?? '').trim()
  if (!geminiApiKey) {
    throw new J4ConfigError('NO_GEMINI_KEY', 'GEMINI_API_KEY is absent.')
  }
  if (!openaiApiKey) {
    throw new J4ConfigError('NO_OPENAI_KEY', 'OPENAI_API_KEY is absent.')
  }
  return {
    capUsd,
    cumulativeQuestions,
    geminiApiKey,
    openaiApiKey,
  }
}
