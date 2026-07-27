// Founder-gated, one-shot journal-navigation measurement.
//
// Order is the contract:
//   preflight -> exactly three-call compatibility smoke -> durable receipt
//   -> parse/replay LongMemEval ordinal 1 -> autonomous navigation -> judge
//   -> stop before question 2.
//
// Importing this file is inert. It owns no provider retry path.

import { createHash } from 'node:crypto'
import {
  access,
  chmod,
  lstat,
  mkdir,
  readFile,
} from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createPalariBrain,
  ingestChatTurn,
  reducePendingTurns,
} from '../src/index.mjs'
import {
  JOURNAL_NAVIGATION_GEMINI_GENERATION,
  JOURNAL_NAVIGATION_GEMINI_MAX_MODEL_DISPATCHES,
  JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN,
  JOURNAL_NAVIGATION_GEMINI_SYSTEM_INSTRUCTION,
  JOURNAL_NAVIGATION_GEMINI_TOOL_CONFIG,
  JOURNAL_NAVIGATION_GEMINI_TOOLS,
  createJournalNavigationGeminiAnswerProvider,
  runJournalNavigationGeminiCompatibilitySmoke,
} from './arms/journal-navigation-gemini-live-adapter.mjs'
import {
  JOURNAL_NAVIGATION_MAX_EXPLORATION_CALLS,
  journalNavigationExchanges,
  runJournalNavigationQuestion,
} from './arms/journal-navigation-arm.mjs'
import {
  LEAN_MEMORY_REDUCER_GENERATION,
  createLeanMemoryReducer,
} from './arms/lean-memory-reducer-contract.mjs'
import {
  buildIncrementalLongMemEvalJudgeBody,
} from './incremental-longmemeval-judge.mjs'
import {
  createIncrementalLongMemEvalJudgeTransport,
} from './incremental-longmemeval-judge-transport.mjs'
import {
  createIncrementalLongMemEvalGeminiTransport,
} from './incremental-longmemeval-runtime.mjs'
import * as liveConfig from './journal-navigation-live-config.mjs'
import {
  gradeJournalNavigationPredictionsFromEvidence,
} from './journal-navigation-prediction-oracle.mjs'
import {
  parseLongMemEvalJudgeLabel,
} from './longmemeval-judge.mjs'
import {
  prepareJ4PinnedS60,
} from './longmemeval-plan.mjs'
import {
  acquireJ4RunLock,
  atomicWriteJ4,
  auditJ4TrackedFiles,
  collectJ4PrivateArtifacts,
  inspectJ4GitCutPoint,
  J4_DENY_GEMINI_KEY,
  J4_DENY_OPENAI_KEY,
  J4_GOOGLE_CREDENTIAL_ALIASES,
  verifyJ4ArtifactManifest,
} from './run-longmemeval-live.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const JOURNAL_NAVIGATION_LIVE_REPO_ROOT = dirname(here)
export const JOURNAL_NAVIGATION_LIVE_RESULTS_ROOT = 'evals/results'

// Terminal evidence exists for this one-shot identity. The seal is checked
// before dependencies, files, credentials, result paths, dataset access, or
// network so the failed run can never be resumed or rerolled.
export const JOURNAL_NAVIGATION_TERMINAL_RUN_IDS = Object.freeze([
  liveConfig.JOURNAL_NAVIGATION_LIVE_RUN_ID,
])
const terminalRunIds = new Set(JOURNAL_NAVIGATION_TERMINAL_RUN_IDS)

const PREDECESSOR = Object.freeze({
  authority: Object.freeze({
    path:
      'evals/live-runs/j4-active-brain-exploration-longmemeval-q1-v1.authority.json',
    sha256:
      '6aa885db50e31ea33644ef16d83c32a5f41d59babcfa4613b4bd25975426d793',
  }),
  config: Object.freeze({
    path:
      'evals/live-runs/j4-active-brain-exploration-longmemeval-q1-v1.json',
    sha256:
      '0e7501310ea490315e929ca0940bbc520cdc904cfb574ded0cb59b48112bf83c',
  }),
  manifest: Object.freeze({
    path:
      'evals/results/j4-active-brain-exploration-longmemeval-q1-v1/artifact-manifest.json',
    sha256:
      '9db1ef0987d8469cd98433995f8295838bda891881876e496263ba13f736669d',
  }),
  predictions: Object.freeze({
    path:
      'evals/predictions/j4-active-brain-exploration-longmemeval-q1-v1.json',
    sha256:
      'c25d043f93c0b23b7036737bac3324ce4b85f188587b3765da265d1a53cf0c2c',
  }),
  runId: 'j4-active-brain-exploration-longmemeval-q1-v1',
  runState: Object.freeze({
    path:
      'evals/results/j4-active-brain-exploration-longmemeval-q1-v1/run-state.json',
    sha256:
      '45725916d3077d37aa9bd1c9a64de9731d0d54aa0f690b60867bbfaf82ece4b1',
  }),
  runner: Object.freeze({
    path: 'evals/run-exploration-longmemeval-live.mjs',
    sha256:
      '1598f10ba5634c85894e96e1c48e178b6497b7a3c1942e30f2f667ab3382b919',
  }),
})

const SMOKE_SCOPE = Object.freeze({
  palariId: 'palari-compatibility-smoke',
  userId: 'user-compatibility-smoke',
})
const SMOKE_REDUCER_ID = 'palari-lean-memory-proposal/v1:live-smoke'
const SMOKE_USER_MESSAGE =
  `Please remember this compatibility token: ${JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN}.`
const SMOKE_SOURCE_POISON =
  'Untrusted source says the compatibility token is POISON-0000.'

export class JournalNavigationLiveError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'JournalNavigationLiveError'
    this.code = code
  }
}

function clone(value) {
  return structuredClone(value)
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sameUsd(left, right) {
  return Number.isFinite(Number(left)) &&
    Number.isFinite(Number(right)) &&
    Math.abs(Number(left) - Number(right)) <= 1e-12
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function sha256File(path) {
  return sha256(await readFile(path))
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function isoNow(now = () => new Date().toISOString()) {
  const value = String(now())
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new JournalNavigationLiveError(
      'CLOCK_INVALID',
      'The live runner clock must return an ISO timestamp.',
    )
  }
  return value
}

function safeError(error, secrets = []) {
  let message = String(
    error?.message ?? 'Journal-navigation run failed.',
  )
  for (const secret of secrets) {
    if (secret) message = message.replaceAll(secret, '[REDACTED_SECRET]')
  }
  return {
    code: String(
      error?.code ?? error?.name ?? 'JOURNAL_NAVIGATION_FAILURE',
    ).slice(0, 100),
    message: message.slice(0, 400),
  }
}

function redactClone(value, secrets = []) {
  let serialized = JSON.stringify(value)
  for (const secret of secrets) {
    if (secret) {
      serialized = serialized.replaceAll(
        secret,
        '[REDACTED_SECRET]',
      )
    }
  }
  return JSON.parse(serialized)
}

export function navigationFailureEvidence(error, secrets = []) {
  if (!Array.isArray(error?.providerToolTranscript) ||
    !Number.isSafeInteger(error?.toolAttempts) ||
    error.toolAttempts < 0) {
    return null
  }
  return {
    failure: safeError(error, secrets),
    providerToolTranscript:
      redactClone(error.providerToolTranscript, secrets),
    status: 'failed',
    toolAttemptBudget:
      Number.isSafeInteger(error.toolAttemptBudget)
        ? error.toolAttemptBudget
        : null,
    toolAttemptBudgetExhausted:
      error.toolAttemptBudgetExhausted === true,
    toolAttemptBudgetExceeded:
      error.toolAttemptBudgetExceeded === true,
    toolAttemptBudgetRemaining:
      Number.isSafeInteger(error.toolAttemptBudgetRemaining)
        ? error.toolAttemptBudgetRemaining
        : null,
    toolAttempts: error.toolAttempts,
  }
}

export function parseJournalNavigationLiveArgs(args = []) {
  if (args.length !== 2 ||
    args[0] !== '--run' ||
    args[1] !== liveConfig.JOURNAL_NAVIGATION_LIVE_RUN_ID) {
    throw new JournalNavigationLiveError(
      'RUN_ID_REQUIRED',
      'Invoke the runner with its exact frozen run ID.',
    )
  }
  return args[1]
}

export function assertJournalNavigationRunOpen(runId) {
  if (terminalRunIds.has(runId)) {
    throw new JournalNavigationLiveError(
      'RUN_TERMINAL',
      `${runId} is terminal and cannot be resumed or rerolled.`,
    )
  }
  if (runId !== liveConfig.JOURNAL_NAVIGATION_LIVE_RUN_ID) {
    throw new JournalNavigationLiveError(
      'RUN_ID_REQUIRED',
      'No matching journal-navigation identity is configured.',
    )
  }
  return runId
}

function assertDispatchAuthority(authority) {
  if (authority?.runId !==
      liveConfig.JOURNAL_NAVIGATION_LIVE_RUN_ID ||
    authority?.dispatchAuthorized !== true ||
    authority?.exactCapConfirmationRequired !== false) {
    throw new JournalNavigationLiveError(
      'FOUNDER_CAP_CONFIRMATION_REQUIRED',
      'The exact fresh subcap must be confirmed before credentials or dispatch.',
    )
  }
}

export function journalNavigationLiveResultPaths(
  repoRoot = JOURNAL_NAVIGATION_LIVE_REPO_ROOT,
) {
  const resultsRoot = resolve(
    repoRoot,
    JOURNAL_NAVIGATION_LIVE_RESULTS_ROOT,
  )
  const runDir = join(
    resultsRoot,
    liveConfig.JOURNAL_NAVIGATION_LIVE_RUN_ID,
  )
  const transcriptsDir = join(runDir, 'transcripts')
  return {
    artifactManifestPath: join(runDir, 'artifact-manifest.json'),
    geminiJournalPath: join(runDir, 'gemini-meter.jsonl'),
    geminiTranscriptsDir: join(transcriptsDir, 'gemini'),
    instancePath: join(runDir, 'instance.json'),
    judgeMeterPath: join(runDir, 'judge-meter.json'),
    judgeTranscriptsDir: join(transcriptsDir, 'openai'),
    lockPath: join(
      resultsRoot,
      `${liveConfig.JOURNAL_NAVIGATION_LIVE_RUN_ID}.lock`,
    ),
    questionResultPath: join(runDir, 'question-result.json'),
    reportJsonPath: join(runDir, 'report.json'),
    reportMarkdownPath: join(runDir, 'report.md'),
    resultsRoot,
    runDir,
    runStatePath: join(runDir, 'run-state.json'),
    smokeNavigationWorkspaceDir:
      join(runDir, 'smoke-navigation-workspace'),
    smokeReceiptPath: join(runDir, 'smoke-pass.receipt.json'),
    smokeReducerWorkspaceDir:
      join(runDir, 'smoke-reducer-workspace'),
    transcriptsDir,
    workspaceDir: join(runDir, 'question-workspace'),
  }
}

export async function auditJournalNavigationTrackedArtifacts({
  config,
  repoRoot = JOURNAL_NAVIGATION_LIVE_REPO_ROOT,
} = {}) {
  const root = resolve(repoRoot)
  const seen = new Set()
  for (const artifact of config?.artifacts ?? []) {
    const path = resolve(root, artifact.path)
    const repositoryPath = relative(root, path)
    if (!repositoryPath ||
      repositoryPath.startsWith('..') ||
      path !== resolve(root, repositoryPath) ||
      seen.has(repositoryPath)) {
      throw new JournalNavigationLiveError(
        'ARTIFACT_PATH_INVALID',
        'Runtime artifact paths must be unique and repository-relative.',
      )
    }
    const metadata = await lstat(path)
    if (!metadata.isFile() ||
      metadata.isSymbolicLink() ||
      await sha256File(path) !== artifact.sha256) {
      throw new JournalNavigationLiveError(
        'ARTIFACT_CHANGED',
        `Runtime artifact changed: ${repositoryPath}.`,
      )
    }
    seen.add(repositoryPath)
  }
  const required = [
    'evals/arms/journal-navigation-arm.mjs',
    'evals/arms/journal-navigation-gemini-live-adapter.mjs',
    'evals/arms/lean-memory-reducer-contract.mjs',
    'evals/incremental-longmemeval-hard-cap-gemini.mjs',
    'evals/incremental-longmemeval-judge-transport.mjs',
    'evals/incremental-longmemeval-judge.mjs',
    'evals/incremental-longmemeval-runtime.mjs',
    'evals/journal-navigation-live-config.mjs',
    'evals/journal-navigation-prediction-oracle.mjs',
    'evals/longmemeval-plan.mjs',
    'evals/run-journal-navigation-live.mjs',
    'evals/run-longmemeval-live.mjs',
    'src/brain.mjs',
    'src/index.mjs',
    'src/memory-exploration.mjs',
    'src/memory-reducer.mjs',
  ]
  if (required.some((path) => !seen.has(path))) {
    throw new JournalNavigationLiveError(
      'ARTIFACT_SET_INCOMPLETE',
      'The live runtime import closure is not fully pinned.',
    )
  }
  return {
    artifacts: seen.size,
    artifactSetSha256: sha256(JSON.stringify(config.artifacts)),
  }
}

export async function verifyJournalNavigationPredecessor({
  repoRoot = JOURNAL_NAVIGATION_LIVE_REPO_ROOT,
} = {}) {
  for (const entry of [
    PREDECESSOR.authority,
    PREDECESSOR.config,
    PREDECESSOR.manifest,
    PREDECESSOR.predictions,
    PREDECESSOR.runState,
    PREDECESSOR.runner,
  ]) {
    if (await sha256File(resolve(repoRoot, entry.path)) !== entry.sha256) {
      throw new JournalNavigationLiveError(
        'PREDECESSOR_CHANGED',
        `Sealed predecessor changed: ${entry.path}.`,
      )
    }
  }
  await verifyJ4ArtifactManifest(resolve(
    repoRoot,
    `evals/results/${PREDECESSOR.runId}`,
  ))
  const runState = JSON.parse(await readFile(
    resolve(repoRoot, PREDECESSOR.runState.path),
    'utf8',
  ))
  if (runState.status !== 'failed' ||
    runState.identity?.runId !== PREDECESSOR.runId ||
    runState.question?.question2Started !== false ||
    runState.exploration?.modelDispatches !== 0 ||
    runState.judge?.status !== 'not_reached' ||
    !sameUsd(runState.spend?.cumulativeAccountedUsd, 1.0120378) ||
    !sameUsd(runState.spend?.cumulativeMeasuredUsd, 0.7736072) ||
    !sameUsd(runState.spend?.cumulativeUncertainUsd, 0.2384306)) {
    throw new JournalNavigationLiveError(
      'PREDECESSOR_STATE_CHANGED',
      'Sealed predecessor state no longer matches its terminal evidence.',
    )
  }
  return {
    accountedUsd: 1.0120378,
    measuredUsd: 0.7736072,
    uncertainUsd: 0.2384306,
    manifestSha256: PREDECESSOR.manifest.sha256,
    runId: PREDECESSOR.runId,
  }
}

export function createJournalNavigationCallGate(callGemini) {
  if (typeof callGemini !== 'function') {
    throw new TypeError('A metered callGemini function is required.')
  }
  let phase = 'smoke_reducer'
  const calls = []
  let benchmarkDispatch = 0

  const expectedSmoke = [
    {
      operationId: 'smoke:reducer:1',
      phase: 'smoke_reducer',
      purpose: 'writer',
    },
    {
      operationId: 'smoke:explore:1',
      phase: 'smoke_navigation',
      purpose: 'explore',
    },
    {
      operationId: 'smoke:answer:1',
      phase: 'smoke_navigation',
      purpose: 'explore',
    },
  ]

  return Object.freeze({
    calls,

    async call(request = {}) {
      const physicalCall = calls.length + 1
      if (phase.startsWith('smoke')) {
        const expected = expectedSmoke[calls.length]
        if (!expected ||
          expected.phase !== phase ||
          request.operationId !== expected.operationId ||
          request.purpose !== expected.purpose) {
          throw new JournalNavigationLiveError(
            'SMOKE_CALL_ORDER_INVALID',
            'Compatibility smoke attempted a call outside its exact three-call sequence.',
          )
        }
      } else if (phase === 'benchmark') {
        benchmarkDispatch += 1
        if (request.purpose !== 'explore' ||
          request.operationId !==
            `question:${liveConfig.JOURNAL_NAVIGATION_LIVE_QUESTION_ID}:explore:${benchmarkDispatch}` ||
          benchmarkDispatch >
            liveConfig.JOURNAL_NAVIGATION_LIVE_SCOPE
              .mainMaximumGeminiDispatches) {
          throw new JournalNavigationLiveError(
            'BENCHMARK_CALL_INVALID',
            'Benchmark attempted a provider call outside the frozen navigation-only sequence.',
          )
        }
      } else {
        throw new JournalNavigationLiveError(
          'PROVIDER_PHASE_CLOSED',
          'Provider dispatch is closed in the current phase.',
        )
      }

      const entry = {
        operationId: request.operationId,
        physicalCall,
        provider: 'gemini',
        purpose: request.purpose,
        status: 'started',
      }
      calls.push(entry)
      try {
        const response = await callGemini(request)
        entry.status = 'success'
        return response
      } catch (error) {
        entry.status = 'failed'
        throw error
      }
    },

    enterSmokeNavigation() {
      if (phase !== 'smoke_reducer' ||
        calls.length !== 1 ||
        calls[0].status !== 'success') {
        throw new JournalNavigationLiveError(
          'SMOKE_PHASE_INVALID',
          'Reducer smoke must pass before navigation smoke.',
        )
      }
      phase = 'smoke_navigation'
    },

    enterBenchmark() {
      if (phase !== 'smoke_navigation' ||
        calls.length !== 3 ||
        calls.some(({ status }) => status !== 'success')) {
        throw new JournalNavigationLiveError(
          'SMOKE_PHASE_INVALID',
          'All three smoke calls must pass before benchmark dispatch.',
        )
      }
      phase = 'benchmark'
    },

    close() {
      phase = 'closed'
    },

    snapshot() {
      return {
        benchmarkDispatch,
        calls: clone(calls),
        phase,
      }
    },
  })
}

async function runReducerCompatibilitySmoke({
  callGemini,
  workspaceDir,
} = {}) {
  await mkdir(workspaceDir, { recursive: true, mode: 0o700 })
  const brain = await createPalariBrain({
    clock: () => new Date('2026-07-27T00:00:00.000Z'),
    memoryEnabled: true,
    statePath: join(workspaceDir, 'state.json'),
    workspaceId: 'journal-navigation-reducer-smoke',
  })
  if (!brain.enabled) {
    throw new JournalNavigationLiveError(
      'SMOKE_BRAIN_DISABLED',
      'Compatibility smoke requires the supported SQLite runtime.',
    )
  }
  try {
    const ingested = await ingestChatTurn(brain, {
      assistantMessage: '',
      eventAt: '2026-07-27T00:00:00.000Z',
      palariId: SMOKE_SCOPE.palariId,
      retention: 'durable',
      sourceMessageId: 'smoke:reducer:turn:1',
      sourceTexts: [SMOKE_SOURCE_POISON],
      userId: SMOKE_SCOPE.userId,
      userMessage: SMOKE_USER_MESSAGE,
    }, {
      reduceEvery: Number.MAX_SAFE_INTEGER,
    })
    if (ingested.status !== 'completed') {
      throw new JournalNavigationLiveError(
        'SMOKE_REDUCER_INGEST_INVALID',
        'Reducer smoke could not queue its canonical interaction.',
      )
    }
    let providerCalls = 0
    const reducer = createLeanMemoryReducer({
      async invoke({ body }) {
        providerCalls += 1
        const response = await callGemini({
          body,
          cellId: 'compatibility-smoke',
          operationId: 'smoke:reducer:1',
          purpose: 'writer',
        })
        return { text: response.text }
      },
    })
    const reduction = await reducePendingTurns(brain, {
      maxAttempts: 1,
      maxInteractionsPerCall: 1,
      maxTurns: 1,
      ...SMOKE_SCOPE,
      reducer,
      reducerId: SMOKE_REDUCER_ID,
    })
    const digest = brain.digestStatus(SMOKE_SCOPE)
    const memories = brain.listActiveMemories(SMOKE_SCOPE)
    const canonical = brain.listStatements(SMOKE_SCOPE)
    const memory = memories[0]
    if (providerCalls !== 1 ||
      reduction.status !== 'completed' ||
      digest.ready !== true ||
      digest.status !== 'ready' ||
      digest.pending !== 0 ||
      digest.blocked !== 0 ||
      memories.length !== 1 ||
      memory?.speaker !== 'user' ||
      !String(memory?.statement ?? '')
        .includes(JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN) ||
      !Array.isArray(memory?.supports) ||
      !memory.supports.some(({ quote }) =>
        SMOKE_USER_MESSAGE.includes(String(quote))) ||
      canonical.length !== 1 ||
      canonical[0].content !== SMOKE_USER_MESSAGE ||
      JSON.stringify({ canonical, memories }).includes(SMOKE_SOURCE_POISON)) {
      throw new JournalNavigationLiveError(
        'SMOKE_REDUCER_SEMANTICS_INVALID',
        'Lean reducer wire completed but its host transaction did not preserve the canary fact.',
      )
    }
    return {
      canonicalRows: canonical.length,
      digest: clone(digest),
      digestItems: memories.length,
      memory: clone(memory),
      providerCalls,
      reduction: clone(reduction),
    }
  } finally {
    brain.close()
  }
}

async function runExplorationCompatibilitySmoke({
  callGemini,
  expectedModel,
  workspaceDir,
} = {}) {
  let adapterResult = null
  const armResult = await runJournalNavigationQuestion({
    answerProvider: async (context) => {
      adapterResult =
        await runJournalNavigationGeminiCompatibilitySmoke({
          callGemini,
          cellId: 'compatibility-smoke',
          expectedModel,
          operationIdFactory(dispatch) {
            return dispatch === 1
              ? 'smoke:explore:1'
              : 'smoke:answer:1'
          },
          providerContext: context,
        })
      return { text: adapterResult.text }
    },
    exchanges: [{
      assistantMessage: '',
      eventAt: '2026-07-27T00:00:00.000Z',
      sourceMessageId: 'session-001:0',
      sourceTexts: [SMOKE_SOURCE_POISON],
      userMessage:
        `The compatibility token is ${JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN}.`,
    }],
    maxExplorationCalls: 1,
    palariId: 'palari-compatibility-navigation-smoke',
    question: 'Run the frozen compatibility lookup.',
    questionDate: '2026-07-27T00:00:00.000Z',
    userId: 'user-compatibility-navigation-smoke',
    workspaceDir,
  })
  const toolCall = armResult.providerToolTranscript?.[0]
  const expectedEvidenceId = toolCall?.result?.matches?.[0]?.evidenceId
  if (!adapterResult ||
    adapterResult.modelDispatches !== 2 ||
    armResult.answer !== JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN ||
    armResult.toolAttempts !== 1 ||
    armResult.canonicalRows !== 1 ||
    armResult.externalReducerCalls !== 0 ||
    armResult.providerToolTranscript.length !== 1 ||
    toolCall.tool !== 'memory_find' ||
    toolCall.outcome !== 'success' ||
    !expectedEvidenceId ||
    !armResult.consultedEvidenceIds.includes(expectedEvidenceId) ||
    JSON.stringify(armResult).includes(SMOKE_SOURCE_POISON)) {
    throw new JournalNavigationLiveError(
      'SMOKE_NAVIGATION_SEMANTICS_INVALID',
      'Navigation smoke did not complete one real host lookup and one grounded continuation.',
    )
  }
  return {
    answer: armResult.answer,
    consultedEvidenceIds: clone(armResult.consultedEvidenceIds),
    expectedEvidenceId,
    modelDispatches: adapterResult.modelDispatches,
    opaqueToken: JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN,
    toolCalls: clone(armResult.providerToolTranscript),
  }
}

export async function runJournalNavigationCompatibilitySmoke({
  callGate,
  expectedModel,
  workspacePaths,
} = {}) {
  const reducer = await runReducerCompatibilitySmoke({
    callGemini: callGate.call,
    workspaceDir: workspacePaths.smokeReducerWorkspaceDir,
  })
  callGate.enterSmokeNavigation()
  const exploration = await runExplorationCompatibilitySmoke({
    callGemini: callGate.call,
    expectedModel,
    workspaceDir: workspacePaths.smokeNavigationWorkspaceDir,
  })
  return { exploration, reducer }
}

function selectPopulation(prepared = {}) {
  const instance = prepared?.executionOrder?.[0]
  const exchanges = journalNavigationExchanges({
    sessions: instance?.sessions,
  })
  const canonicalRows = exchanges.reduce(
    (total, exchange) =>
      total +
      Number(Boolean(exchange.userMessage.trim())) +
      Number(Boolean(exchange.assistantMessage.trim())),
    0,
  )
  if (prepared?.manifest?.datasetSha256 !==
      liveConfig.JOURNAL_NAVIGATION_LIVE_DATASET.sha256 ||
    instance?.questionId !==
      liveConfig.JOURNAL_NAVIGATION_LIVE_QUESTION_ID ||
    instance?.sessions?.length !==
      liveConfig.JOURNAL_NAVIGATION_LIVE_POPULATION.sessions ||
    exchanges.length !==
      liveConfig.JOURNAL_NAVIGATION_LIVE_POPULATION.interactions ||
    canonicalRows !==
      liveConfig.JOURNAL_NAVIGATION_LIVE_POPULATION.canonicalRows ||
    !String(instance?.question ?? '').trim() ||
    !String(instance?.answer ?? '').trim() ||
    !Array.isArray(instance?.answerSessionIds) ||
    instance.answerSessionIds.length < 1) {
    throw new JournalNavigationLiveError(
      'POPULATION_CHANGED',
      'The pinned ordinal-1 population changed.',
    )
  }
  return { exchanges, instance }
}

async function writeJson(path, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`
  await atomicWriteJ4(path, text)
  return sha256(text)
}

function smokeMeasuredUsd(before, after) {
  return Number((
    Number(after?.measured?.usd ?? 0) -
      Number(before?.measured?.usd ?? 0)
  ).toFixed(12))
}

async function writeAndVerifySmokeReceipt({
  artifactAudit,
  calls,
  loaded,
  meterAfter,
  meterBefore,
  paths,
  smoke,
  transcriptAudit,
} = {}) {
  const receipt = {
    artifactSetSha256: artifactAudit.artifactSetSha256,
    authoritySha256: loaded.authoritySha256,
    calls: clone(calls),
    configSha256: loaded.configSha256,
    contractSha256: transcriptAudit.contractSha256,
    datasetLoaded: false,
    fixtureSha256: sha256(JSON.stringify({
      sourcePoison: SMOKE_SOURCE_POISON,
      token: JOURNAL_NAVIGATION_GEMINI_SMOKE_TOKEN,
      userMessage: SMOKE_USER_MESSAGE,
    })),
    meterAfter: clone(meterAfter),
    meterBefore: clone(meterBefore),
    predictionsSha256: loaded.predictionsSha256,
    reducerObservationSha256: sha256(JSON.stringify(smoke.reducer)),
    runId: liveConfig.JOURNAL_NAVIGATION_LIVE_RUN_ID,
    schemaVersion: 1,
    smokeMeasuredUsd: smokeMeasuredUsd(meterBefore, meterAfter),
    status: 'passed',
    toolObservationSha256: sha256(JSON.stringify(smoke.exploration)),
    transcriptAudit: clone(transcriptAudit.transcripts),
  }
  if (receipt.calls.length !== 3 ||
    receipt.calls.some(({ status }) => status !== 'success') ||
    receipt.smokeMeasuredUsd < 0 ||
    receipt.smokeMeasuredUsd >=
      liveConfig.JOURNAL_NAVIGATION_LIVE_HARD_CAP
        .smokeMeasuredPassExclusiveUsd ||
    transcriptAudit.meter?.attempts !== 3 ||
    transcriptAudit.meter?.logicalRequests?.writer !== 1 ||
    transcriptAudit.meter?.logicalRequests?.explore !== 2 ||
    transcriptAudit.meter?.terminal !== false) {
    throw new JournalNavigationLiveError(
      'SMOKE_RECEIPT_REFUSED',
      'Compatibility smoke did not satisfy its exact call, evidence, or one-cent measured threshold.',
    )
  }
  const receiptSha256 = await writeJson(paths.smokeReceiptPath, receipt)
  const reread = JSON.parse(await readFile(paths.smokeReceiptPath, 'utf8'))
  if (!sameJson(reread, receipt) ||
    await sha256File(paths.smokeReceiptPath) !== receiptSha256 ||
    reread.datasetLoaded !== false ||
    reread.status !== 'passed') {
    throw new JournalNavigationLiveError(
      'SMOKE_RECEIPT_INVALID',
      'The durable compatibility-smoke receipt did not verify.',
    )
  }
  return { receipt, receiptSha256 }
}

function freshGeminiAccounted(snapshot) {
  const value = Number((
    Number(snapshot?.accounted?.usd ?? 0) -
      liveConfig.JOURNAL_NAVIGATION_LIVE_OPENING_SPEND.accountedUsd
  ).toFixed(12))
  if (!Number.isFinite(value) || value < -1e-12) {
    throw new JournalNavigationLiveError(
      'GEMINI_SPEND_INVALID',
      'Gemini accounted spend is below the frozen opening.',
    )
  }
  return Math.max(0, value)
}

function spendFromEvidence({ gemini, judge }) {
  const freshGemini = gemini ? freshGeminiAccounted(gemini) : 0
  const judgeAccounted = Number(judge?.accountedUsd ?? 0)
  const freshAccountedUsd = Number((
    freshGemini + judgeAccounted
  ).toFixed(12))
  const freshMeasuredUsd = Number((
    Number(gemini?.measured?.usd ?? 0) +
      Number(judge?.measured?.usd ?? 0)
  ).toFixed(12))
  const freshUncertainUsd = Number((
    Number(gemini?.uncertain?.usd ?? 0) +
      Number(judge?.uncertain?.usd ?? 0)
  ).toFixed(12))
  const opening = liveConfig.JOURNAL_NAVIGATION_LIVE_OPENING_SPEND
  return {
    cumulativeAccountedUsd: Number((
      opening.accountedUsd + freshAccountedUsd
    ).toFixed(12)),
    cumulativeMeasuredUsd: Number((
      opening.measuredUsd + freshMeasuredUsd
    ).toFixed(12)),
    cumulativeUncertainUsd: Number((
      opening.uncertainUsd + freshUncertainUsd
    ).toFixed(12)),
    freshAccountedUsd,
    freshMeasuredUsd,
    freshUncertainUsd,
    openingAccountedUsd: opening.accountedUsd,
  }
}

async function judgeSnapshot(judgeTransport) {
  return judgeTransport
    ? judgeTransport.snapshot()
    : {
        accountedUsd: 0,
        attempts: 0,
        measured: null,
        state: 'not_dispatched',
        uncertain: null,
      }
}

function renderReport(report) {
  return [
    '# Journal-navigation private live report',
    '',
    '> Private one-question evidence. Do not commit or publish answers, scores, transcripts, tool results, or benchmark content.',
    '',
    `- Status: ${report.status}`,
    `- Fresh accounted spend: $${Number(
      report.spend?.freshAccountedUsd ?? 0,
    ).toFixed(7)}`,
    `- Cumulative accounted spend: $${Number(
      report.spend?.cumulativeAccountedUsd ??
        liveConfig.JOURNAL_NAVIGATION_LIVE_OPENING_SPEND.accountedUsd,
    ).toFixed(7)}`,
    `- Smoke measured spend: $${Number(
      report.computed?.smoke?.measuredUsd ?? 0,
    ).toFixed(7)}`,
    '',
    '## Prediction grade (misses first)',
    '',
    ...(report.grades ?? []).map((grade) =>
      `- ${grade.outcome.toUpperCase()} ${grade.id}: ${grade.statement}`),
    '',
  ].join('\n')
}

async function writeTerminalBundle({
  evidence,
  forbiddenSecrets,
  judgeTransport,
  now,
  paths,
  runState,
  transport,
} = {}) {
  let gemini = evidence.meter?.smokeAfter ?? null
  if (transport) {
    const verified = await transport.verify()
    gemini = verified.meter
    runState.geminiTranscriptAudit = verified.transcripts
  }
  const judge = await judgeSnapshot(judgeTransport)
  evidence.meter ??= {}
  evidence.meter.final = gemini
  evidence.judge ??= {
    attempts: judge.attempts,
    correct: null,
    label: '',
    status: judge.attempts ? 'failed' : 'not_reached',
  }
  const grade = gradeJournalNavigationPredictionsFromEvidence({
    evidence,
    predictions: runState.predictions,
  })
  runState.grades = grade.grades
  runState.meter = { gemini, judge }
  runState.spend = spendFromEvidence({ gemini, judge })
  const report = {
    computed: grade.computed,
    grades: grade.grades,
    observations: grade.observations,
    runId: runState.identity.runId,
    schemaVersion: 1,
    spend: runState.spend,
    status: runState.status,
  }
  await writeJson(paths.runStatePath, runState)
  await writeJson(paths.reportJsonPath, report)
  await atomicWriteJ4(paths.reportMarkdownPath, renderReport(report))
  const artifacts = await collectJ4PrivateArtifacts(paths.runDir, {
    forbiddenSecrets,
  })
  await writeJson(paths.artifactManifestPath, {
    artifacts,
    generatedAt: isoNow(now),
    runId: runState.identity.runId,
    schemaVersion: 1,
  })
  await verifyJ4ArtifactManifest(paths.runDir)
  return { grade, report }
}

function initialRunState({
  artifactAudit,
  loaded,
  predecessor,
  startedAt,
} = {}) {
  return {
    completedAt: null,
    failure: null,
    identity: {
      artifactSetSha256: artifactAudit.artifactSetSha256,
      authoritySha256: loaded.authoritySha256,
      configSha256: loaded.configSha256,
      datasetSha256:
        liveConfig.JOURNAL_NAVIGATION_LIVE_DATASET.sha256,
      models: clone(liveConfig.JOURNAL_NAVIGATION_LIVE_MODELS),
      predictionsSha256: loaded.predictionsSha256,
      productCommit:
        liveConfig.JOURNAL_NAVIGATION_LIVE_PRODUCT_COMMIT,
      questionId:
        liveConfig.JOURNAL_NAVIGATION_LIVE_QUESTION_ID,
      runDate: liveConfig.JOURNAL_NAVIGATION_LIVE_RUN_DATE,
      runId: liveConfig.JOURNAL_NAVIGATION_LIVE_RUN_ID,
      schemaVersion: 1,
    },
    invocations: [{
      completedQuestions: 0,
      cumulativeCapUsd:
        liveConfig.JOURNAL_NAVIGATION_LIVE_HARD_CAP.cumulativeCapUsd,
      freshSubcapUsd:
        liveConfig.JOURNAL_NAVIGATION_LIVE_HARD_CAP.freshSubcapUsd,
      question2Started: false,
      startedAt,
    }],
    meter: { gemini: null, judge: null },
    predecessor,
    predictions: loaded.predictions.predictions.map(clone),
    question: {
      question2Started: false,
      status: 'not_started',
    },
    smoke: {
      datasetLoaded: false,
      receiptFile: null,
      receiptSha256: null,
      status: 'running',
    },
    spend: null,
    startedAt,
    status: 'running',
  }
}

export async function main({
  args = process.argv.slice(2),
  dependencies = {},
  env = process.env,
  repoRoot = JOURNAL_NAVIGATION_LIVE_REPO_ROOT,
} = {}) {
  const runId = parseJournalNavigationLiveArgs(args)
  assertJournalNavigationRunOpen(runId)

  const loadContract = dependencies.loadContract ??
    liveConfig.loadJournalNavigationLiveContract
  const loaded = await loadContract({ repoRoot })
  // This gate is intentionally before environment, result paths, or dataset.
  assertDispatchAuthority(loaded.authority)

  const auditArtifacts = dependencies.auditArtifacts ??
    auditJournalNavigationTrackedArtifacts
  const verifyPredecessor = dependencies.verifyPredecessor ??
    verifyJournalNavigationPredecessor
  const inspectGit = dependencies.inspectGitCutPoint ??
    inspectJ4GitCutPoint
  const assertEnvironment = dependencies.assertEnvironment ??
    liveConfig.assertJournalNavigationLiveEnvironment
  const auditTracked = dependencies.auditTrackedFiles ??
    auditJ4TrackedFiles
  const createGemini = dependencies.createGeminiTransport ??
    createIncrementalLongMemEvalGeminiTransport
  const createJudge = dependencies.createJudgeTransport ??
    createIncrementalLongMemEvalJudgeTransport
  const preparePopulation = dependencies.preparePopulation ??
    prepareJ4PinnedS60
  const runQuestion = dependencies.runQuestion ??
    runJournalNavigationQuestion
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch
  const now = dependencies.now ?? (() => new Date().toISOString())
  const log = dependencies.log ?? console.log
  const pathExists = dependencies.exists ?? exists
  const read = dependencies.readFile ?? readFile
  const paths = journalNavigationLiveResultPaths(repoRoot)

  const artifactAudit = await auditArtifacts({
    config: loaded.config,
    repoRoot,
  })
  const repositoryPath = (path) =>
    relative(repoRoot, resolve(repoRoot, path))
  const artifactPaths = [...new Set([
    ...loaded.config.artifacts.map(({ path }) => path),
    repositoryPath(loaded.configPath),
    repositoryPath(loaded.predictionsPath),
  ])]
  const git = await inspectGit({
    artifactPaths,
    authorityPath: repositoryPath(loaded.authorityPath),
    env,
    repoRoot,
    runDir: paths.runDir,
  })
  const lock = await acquireJ4RunLock(paths.lockPath)
  let callGate
  let evidence = {
    judge: null,
    meter: {},
    navigation: null,
    smoke: {
      calls: [],
      exploration: null,
      phaseEvents: [],
      reducer: null,
    },
  }
  let judgeTransport
  let previousUmask
  let runState
  let secrets = []
  let transport
  try {
    if (await pathExists(paths.runDir)) {
      throw new JournalNavigationLiveError(
        'RUN_ALREADY_EXISTS',
        'The one-shot identity refuses to resume, replace, or overlay.',
      )
    }
    const predecessor = await verifyPredecessor({ repoRoot })
    if (!sameUsd(
      predecessor.accountedUsd,
      liveConfig.JOURNAL_NAVIGATION_LIVE_OPENING_SPEND.accountedUsd,
    )) {
      throw new JournalNavigationLiveError(
        'OPENING_SPEND_CHANGED',
        'Sealed predecessor spend no longer matches the frozen opening.',
      )
    }
    const datasetPath = resolve(
      repoRoot,
      liveConfig.JOURNAL_NAVIGATION_LIVE_DATASET.path,
    )
    // Hashing bytes is allowed pre-smoke; parsing/selecting is not.
    if (await sha256File(datasetPath) !==
      liveConfig.JOURNAL_NAVIGATION_LIVE_DATASET.sha256) {
      throw new JournalNavigationLiveError(
        'DATASET_CHANGED',
        'LongMemEval-S bytes differ from the frozen dataset hash.',
      )
    }

    const runtime = assertEnvironment(
      env,
      loaded.config,
      loaded.authority,
    )
    secrets = [runtime.geminiApiKey, runtime.openaiApiKey]
    const trackedSecretAudit = await auditTracked({
      env,
      forbiddenSecrets: secrets,
      repoRoot,
    })
    for (const name of J4_GOOGLE_CREDENTIAL_ALIASES) {
      env[name] = J4_DENY_GEMINI_KEY
    }
    env.OPENAI_API_KEY = J4_DENY_OPENAI_KEY

    previousUmask = process.umask(0o077)
    for (const directory of [
      paths.runDir,
      paths.geminiTranscriptsDir,
      paths.judgeTranscriptsDir,
      paths.smokeNavigationWorkspaceDir,
      paths.smokeReducerWorkspaceDir,
      paths.workspaceDir,
    ]) {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await chmod(directory, 0o700)
    }
    const startedAt = isoNow(now)
    runState = initialRunState({
      artifactAudit,
      loaded,
      predecessor,
      startedAt,
    })
    runState.git = {
      administrativeHead: git.administrativeHead,
      trackedSecretAudit,
    }
    evidence.smoke.phaseEvents.push({
      datasetLoaded: false,
      type: 'smoke_started',
    })
    await writeJson(paths.runStatePath, runState)

    transport = await createGemini({
      cumulativeCapUsd:
        liveConfig.JOURNAL_NAVIGATION_LIVE_HARD_CAP.cumulativeCapUsd,
      explorationGeneration: JOURNAL_NAVIGATION_GEMINI_GENERATION,
      explorationSystemInstruction:
        JOURNAL_NAVIGATION_GEMINI_SYSTEM_INSTRUCTION,
      explorationToolConfig: JOURNAL_NAVIGATION_GEMINI_TOOL_CONFIG,
      explorationTools: JOURNAL_NAVIGATION_GEMINI_TOOLS,
      fetchImpl,
      freshSubcapUsd:
        liveConfig.JOURNAL_NAVIGATION_LIVE_HARD_CAP.freshSubcapUsd,
      geminiApiKey: runtime.geminiApiKey,
      journalPath: paths.geminiJournalPath,
      openingAccountedUsd:
        liveConfig.JOURNAL_NAVIGATION_LIVE_OPENING_SPEND.accountedUsd,
      transcriptDirectory: paths.geminiTranscriptsDir,
      writerGeneration: LEAN_MEMORY_REDUCER_GENERATION,
    })
    judgeTransport = await createJudge({
      cumulativeCapUsd:
        liveConfig.JOURNAL_NAVIGATION_LIVE_HARD_CAP.cumulativeCapUsd,
      fetchImpl,
      freshSubcapUsd:
        liveConfig.JOURNAL_NAVIGATION_LIVE_HARD_CAP.freshSubcapUsd,
      getFreshAccountedUsd: async () =>
        freshGeminiAccounted(await transport.snapshot()),
      meterPath: paths.judgeMeterPath,
      openaiApiKey: runtime.openaiApiKey,
      openingAccountedUsd:
        liveConfig.JOURNAL_NAVIGATION_LIVE_OPENING_SPEND.accountedUsd,
      transcriptDirectory: paths.judgeTranscriptsDir,
    })
    callGate = createJournalNavigationCallGate(
      transport.callGemini,
    )
    transport.installNetworkGuard()
    evidence.meter.smokeBefore = await transport.snapshot()

    const smoke = await runJournalNavigationCompatibilitySmoke({
      callGate,
      expectedModel:
        liveConfig.JOURNAL_NAVIGATION_LIVE_MODELS.exploration,
      workspacePaths: paths,
    })
    evidence.smoke.calls = clone(callGate.calls)
    evidence.smoke.reducer = smoke.reducer
    evidence.smoke.exploration = smoke.exploration
    evidence.meter.smokeAfter = await transport.snapshot()
    const transcriptAudit = await transport.verify()
    const smokeReceipt = await writeAndVerifySmokeReceipt({
      artifactAudit,
      calls: callGate.calls,
      loaded,
      meterAfter: evidence.meter.smokeAfter,
      meterBefore: evidence.meter.smokeBefore,
      paths,
      smoke,
      transcriptAudit,
    })
    evidence.smoke.phaseEvents.push({
      datasetLoaded: false,
      status: 'passed',
      type: 'smoke_receipt',
    })
    runState.smoke = {
      datasetLoaded: false,
      measuredUsd: smokeReceipt.receipt.smokeMeasuredUsd,
      receiptFile: relative(paths.runDir, paths.smokeReceiptPath),
      receiptSha256: smokeReceipt.receiptSha256,
      status: 'passed',
    }
    runState.meter.gemini = evidence.meter.smokeAfter
    await writeJson(paths.runStatePath, runState)

    // This is the first dataset parse in the run.
    const raw = await read(datasetPath)
    const population = selectPopulation(
      await preparePopulation({ raw }),
    )
    evidence.smoke.phaseEvents.push({
      datasetLoaded: true,
      type: 'dataset_loaded',
    })
    runState.smoke.datasetLoaded = true
    await writeJson(
      paths.instancePath,
      population.instance,
    )
    callGate.enterBenchmark()
    runState.question.status = 'running'
    await writeJson(paths.runStatePath, runState)

    const answerProvider =
      createJournalNavigationGeminiAnswerProvider({
        callGemini: callGate.call,
        cellId: population.instance.questionId,
        expectedModel:
          liveConfig.JOURNAL_NAVIGATION_LIVE_MODELS.exploration,
        operationIdFactory(dispatch) {
          return `question:${population.instance.questionId}:explore:${dispatch}`
        },
      })
    const navigation = await runQuestion({
      answerProvider,
      exchanges: population.exchanges,
      maxExplorationCalls:
        JOURNAL_NAVIGATION_MAX_EXPLORATION_CALLS,
      palariId: 'palari-journal-navigation-live',
      question: population.instance.question,
      questionDate: population.instance.questionDate,
      userId: 'user-journal-navigation-live',
      workspaceDir: paths.workspaceDir,
    })
    if (navigation.exchanges !==
        liveConfig.JOURNAL_NAVIGATION_LIVE_POPULATION.interactions ||
      navigation.canonicalRows !==
        liveConfig.JOURNAL_NAVIGATION_LIVE_POPULATION.canonicalRows ||
      navigation.externalReducerCalls !== 0 ||
      navigation.toolAttempts >
        liveConfig.JOURNAL_NAVIGATION_LIVE_SCOPE.mainMaximumToolCalls ||
      !String(navigation.answer ?? '').trim()) {
      throw new JournalNavigationLiveError(
        'NAVIGATION_RESULT_INVALID',
        'Autonomous navigation result differs from its frozen bounds.',
      )
    }
    evidence.navigation = clone(navigation)
    const questionResult = {
      answer: navigation.answer,
      consultedEvidenceIds: clone(navigation.consultedEvidenceIds),
      judge: null,
      navigation: clone(navigation),
      questionId: population.instance.questionId,
      schemaVersion: 1,
    }
    const answerResultSha256 = await writeJson(
      paths.questionResultPath,
      questionResult,
    )
    runState.question = {
      answerResultSha256,
      question2Started: false,
      status: 'answer_complete',
    }
    runState.meter.gemini = await transport.snapshot()
    await writeJson(paths.runStatePath, runState)

    const judgeResponse = await judgeTransport.callJudge({
      body: buildIncrementalLongMemEvalJudgeBody(
        population.instance,
        navigation.answer,
      ),
      cellId: population.instance.questionId,
      operationId:
        `question:${population.instance.questionId}:navigation:judge`,
    })
    if (judgeResponse.validated !== true) {
      throw new JournalNavigationLiveError(
        'JUDGE_RESULT_INVALID',
        'Official judge result was not provider-validated.',
      )
    }
    const correct = parseLongMemEvalJudgeLabel(judgeResponse.text)
    evidence.judge = {
      attempts: 1,
      correct,
      label: judgeResponse.text,
      status: 'complete',
    }
    questionResult.judge = {
      correct,
      finishReason: judgeResponse.finishReason,
      measured: judgeResponse.measured,
      modelVersion: judgeResponse.modelVersion,
      serviceTier: judgeResponse.serviceTier,
      text: judgeResponse.text,
    }
    const resultSha256 = await writeJson(
      paths.questionResultPath,
      questionResult,
    )
    const completedAt = isoNow(now)
    runState.completedAt = completedAt
    runState.invocations[0].completedAt = completedAt
    runState.invocations[0].completedQuestions = 1
    runState.question = {
      completedAt,
      question2Started: false,
      resultSha256,
      status: 'complete',
    }
    runState.status = 'complete'
    callGate.close()
    const terminal = await writeTerminalBundle({
      evidence,
      forbiddenSecrets: secrets,
      judgeTransport,
      now,
      paths,
      runState,
      transport,
    })
    if (terminal.report.spend.freshAccountedUsd >
        liveConfig.JOURNAL_NAVIGATION_LIVE_HARD_CAP.freshSubcapUsd +
          1e-12 ||
      terminal.report.spend.cumulativeAccountedUsd >
        liveConfig.JOURNAL_NAVIGATION_LIVE_HARD_CAP.cumulativeCapUsd +
          1e-12) {
      throw new JournalNavigationLiveError(
        'SPEND_CAP_EXCEEDED',
        'Reconciled spend exceeds a frozen cap.',
      )
    }
    log(
      'Journal navigation stopped after LongMemEval-S ordinal 1; ' +
      `private report: ${paths.reportMarkdownPath}`,
    )
    return {
      grade: terminal.grade,
      report: terminal.report,
      result: questionResult,
      runState,
    }
  } catch (error) {
    callGate?.close()
    if (runState) {
      const failedAt = isoNow(now)
      runState.completedAt = failedAt
      runState.failure = safeError(error, secrets)
      runState.invocations[0].completedAt = failedAt
      runState.invocations[0].question2Started = false
      runState.question.question2Started = false
      runState.question.status = 'failed'
      runState.smoke.status =
        runState.smoke.status === 'passed' ? 'passed' : 'failed'
      runState.status = 'failed'
      if (runState.smoke.status === 'passed' &&
        evidence.navigation === null) {
        evidence.navigation =
          navigationFailureEvidence(error, secrets)
      }
      if (callGate) {
        evidence.smoke.calls = clone(callGate.calls.slice(0, 3))
      }
      if (transport) {
        evidence.meter.smokeAfter ??=
          await transport.snapshot().catch(() => null)
      }
      await writeTerminalBundle({
        evidence,
        forbiddenSecrets: secrets,
        judgeTransport,
        now,
        paths,
        runState,
        transport,
      }).catch(async (bundleError) => {
        runState.failureBundle = safeError(bundleError, secrets)
        await writeJson(paths.runStatePath, runState).catch(() => {})
      })
    }
    throw error
  } finally {
    transport?.closeNetworkGuard()
    if (previousUmask !== undefined) process.umask(previousUmask)
    await lock.release()
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : ''
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `${error?.code ?? 'JOURNAL_NAVIGATION_FAILED'}: ` +
      `${error?.message ?? 'Journal-navigation live run failed.'}`,
    )
    process.exitCode = 1
  })
}
