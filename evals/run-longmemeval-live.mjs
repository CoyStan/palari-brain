// Founder-gated J4 LongMemEval runner.
//
// Importing this module is inert. The CLI validates the canonical dataset,
// frozen evaluation artifacts, administrative tranche authority, and a clean
// pushed main before it captures either provider credential. Live evidence is
// written only below gitignored evals/results/.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  access,
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
} from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertExactExtractionEnvelope,
  assertValidatedJ4GeminiResponse,
  runKernelLongMemEvalQuestion,
} from './arms/kernel-longmemeval-live-arm.mjs'
import * as j4Config from './longmemeval-live-config.mjs'
import {
  J4_FIRST_TRANCHE_QUESTION_IDS,
  SEALED_U8_QUESTION_IDS,
  prepareJ4PinnedS60,
} from './longmemeval-plan.mjs'
import {
  LONGMEMEVAL_JUDGE_MODEL,
  LONGMEMEVAL_JUDGE_REQUEST,
  buildLongMemEvalJudgePrompt,
  parseLongMemEvalJudgeLabel,
} from './longmemeval-judge.mjs'
import {
  J4LiveError,
  createJ4MeteredTransport,
} from './longmemeval-live-meter.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const J4_REPO_ROOT = dirname(here)
export const J4_DENY_GEMINI_KEY = 'palari-deny-unmetered-gemini'
export const J4_DENY_OPENAI_KEY = 'palari-deny-unmetered-openai'
export const J4_GOOGLE_CREDENTIAL_ALIASES = Object.freeze([
  'GEMINI_API_KEY',
  'GENAI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_CLOUD_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GOOGLE_GEMINI_API_KEY',
  'GOOGLE_GENAI_API_KEY',
])

const questionTypes = Object.freeze([
  'knowledge-update',
  'multi-session',
  'single-session-assistant',
  'single-session-preference',
  'single-session-user',
  'temporal-reasoning',
])

const credentialPatterns = Object.freeze([
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/u,
  /\bAIza[0-9A-Za-z_-]{20,}\b/u,
])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isoNow(now = () => new Date().toISOString()) {
  const value = String(now())
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new J4LiveError(
      'CLOCK_INVALID',
      'J4 runner clock must return an ISO-compatible timestamp.',
    )
  }
  return value
}

function safeName(value) {
  const source = String(value ?? '')
  const slug = source.replaceAll(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 80)
  if (!slug) {
    throw new J4LiveError('QUESTION_ID_INVALID', 'J4 question ID is invalid.')
  }
  return `${slug}-${sha256(source).slice(0, 12)}`
}

function assertExact(actual, expected, code, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new J4LiveError(code, message)
  }
}

export function parseJ4LiveArgs(args = []) {
  if (args.length !== 2 ||
    args[0] !== '--run' ||
    args[1] !== j4Config.J4_LIVE_RUN_ID) {
    throw new J4LiveError(
      'RUN_ID_REQUIRED',
      `Invoke exactly: node evals/run-longmemeval-live.mjs --run ${j4Config.J4_LIVE_RUN_ID}`,
    )
  }
  return args[1]
}

export function assertJ4LivePopulation(prepared = {}) {
  const ordered = prepared.executionOrder
  if (!Array.isArray(ordered) || ordered.length !== 60) {
    throw new J4LiveError(
      'POPULATION_COUNT',
      'J4 live population must contain exactly 60 ordered questions.',
    )
  }
  const ids = ordered.map((instance) => String(instance?.questionId ?? ''))
  const expectedIds = j4Config.j4ExecutionQuestionIds()
  assertExact(
    ids,
    expectedIds,
    'POPULATION_ORDER',
    'J4 live population differs from the frozen S-60 order.',
  )
  assertExact(
    ids.slice(0, 5),
    J4_FIRST_TRANCHE_QUESTION_IDS,
    'TRANCHE_ONE_ORDER',
    'J4 Tranche 1 differs from the exact five sentinels.',
  )
  assertExact(
    ordered.slice(0, 5).map((instance) => ({
      isAbstention: instance.isAbstention,
      questionType: instance.questionType,
    })),
    [
      { isAbstention: false, questionType: 'knowledge-update' },
      { isAbstention: false, questionType: 'single-session-preference' },
      { isAbstention: false, questionType: 'single-session-assistant' },
      { isAbstention: false, questionType: 'temporal-reasoning' },
      { isAbstention: true, questionType: 'multi-session' },
    ],
    'TRANCHE_ONE_SENTINELS',
    'J4 Tranche 1 sentinel types or abstention flags changed.',
  )
  if (new Set(ids).size !== 60 ||
    ids.some((id) => SEALED_U8_QUESTION_IDS.includes(id))) {
    throw new J4LiveError(
      'POPULATION_SEAL',
      'J4 population is duplicated or overlaps sealed U8.',
    )
  }
  const byType = Object.fromEntries(questionTypes.map((type) => [type, 0]))
  for (const instance of ordered) {
    if (!(instance.questionType in byType)) {
      throw new J4LiveError(
        'POPULATION_TYPE',
        'J4 population contains an unsupported question type.',
      )
    }
    byType[instance.questionType] += 1
  }
  assertExact(
    byType,
    Object.fromEntries(questionTypes.map((type) => [type, 10])),
    'POPULATION_STRATA',
    'J4 S-60 must contain exactly ten questions of every type.',
  )
  if (!Array.isArray(prepared.tranches) ||
    prepared.tranches.length !== 7 ||
    prepared.tranches[0]?.cumulativeQuestions !== 5 ||
    prepared.tranches[0]?.questionIds?.length !== 5) {
    throw new J4LiveError(
      'TRANCHE_PLAN_INVALID',
      'J4 staged tranche plan is missing or changed.',
    )
  }
  return {
    byType,
    executionOrder: ordered,
    firstFive: ids.slice(0, 5),
    questionIds: ids,
  }
}

export function buildJ4ImmutableIdentity({
  config,
  configSha256,
  datasetSha256,
  predictionsSha256,
} = {}) {
  if (!config || !/^[a-f0-9]{64}$/.test(String(configSha256 ?? '')) ||
    !/^[a-f0-9]{64}$/.test(String(datasetSha256 ?? '')) ||
    !/^[a-f0-9]{64}$/.test(String(predictionsSha256 ?? ''))) {
    throw new J4LiveError(
      'IDENTITY_INPUT_INVALID',
      'J4 immutable identity requires config, dataset, and prediction hashes.',
    )
  }
  const artifacts = (config.artifacts ?? []).map((entry) => ({
    path: entry.path,
    sha256: entry.sha256,
  }))
  return {
    artifactSetSha256: sha256(JSON.stringify(artifacts)),
    configSha256,
    datasetSha256,
    executionOrderSha256: config.population.executionOrderSha256,
    models: clone(config.models),
    predictionsSha256,
    runId: config.runId,
    schemaVersion: 1,
    trancheManifestSha256: config.population.trancheManifestSha256,
  }
}

export function buildJ4Checkpoint({
  identity,
  population,
  predictions,
} = {}) {
  if (!identity || !Array.isArray(population?.executionOrder) ||
    !Array.isArray(predictions?.predictions)) {
    throw new J4LiveError(
      'CHECKPOINT_INPUT_INVALID',
      'J4 checkpoint requires identity, population, and FINAL predictions.',
    )
  }
  const predictionById = new Map(
    predictions.predictions.map((entry) => [entry.questionId, entry]),
  )
  const questions = population.executionOrder.map((instance, index) => {
    const prediction = predictionById.get(instance.questionId)
    if (!prediction) {
      throw new J4LiveError(
        'PREDICTION_MISSING',
        `J4 prediction is missing for ${instance.questionId}.`,
      )
    }
    const name = `${String(index + 1).padStart(2, '0')}-${safeName(instance.questionId)}`
    return {
      isAbstention: instance.isAbstention,
      ordinal: index + 1,
      prediction: clone(prediction),
      questionId: instance.questionId,
      questionType: instance.questionType,
      resultFile: null,
      resultSha256: null,
      status: 'pending',
      workspace: join('workspaces', name),
    }
  })
  return {
    events: [],
    identity: clone(identity),
    invocations: [],
    meter: null,
    questions,
    schemaVersion: 1,
    smoke: {
      completedAt: null,
      geminiModelVersion: null,
      startedAt: null,
      status: 'pending',
    },
    status: 'ready',
  }
}

function completedPrefixLength(questions) {
  let count = 0
  let sawPending = false
  for (const question of questions) {
    if (question.status === 'completed') {
      if (sawPending) {
        throw new J4LiveError(
          'CHECKPOINT_PREFIX',
          'Completed J4 questions must be one contiguous prefix.',
        )
      }
      count += 1
      continue
    }
    sawPending = true
    if (question.status !== 'pending') {
      throw new J4LiveError(
        'CHECKPOINT_TERMINAL_QUESTION',
        'An interrupted or failed J4 question makes the run terminal.',
      )
    }
  }
  return count
}

export function assertJ4Checkpoint({
  checkpoint,
  identity,
  population,
} = {}) {
  if (!checkpoint || checkpoint.schemaVersion !== 1 ||
    !Array.isArray(checkpoint.questions) ||
    !Array.isArray(checkpoint.events) ||
    !Array.isArray(checkpoint.invocations)) {
    throw new J4LiveError(
      'CHECKPOINT_SCHEMA',
      'J4 checkpoint has an invalid top-level schema.',
    )
  }
  assertExact(
    checkpoint.identity,
    identity,
    'CHECKPOINT_IDENTITY',
    'J4 checkpoint belongs to different immutable evaluation artifacts.',
  )
  if (checkpoint.questions.length !== 60 ||
    checkpoint.questions.length !== population.executionOrder.length) {
    throw new J4LiveError(
      'CHECKPOINT_PLAN',
      'J4 checkpoint does not contain the frozen 60-question plan.',
    )
  }
  for (let index = 0; index < checkpoint.questions.length; index += 1) {
    const cell = checkpoint.questions[index]
    const instance = population.executionOrder[index]
    if (cell.ordinal !== index + 1 ||
      cell.questionId !== instance.questionId ||
      cell.questionType !== instance.questionType ||
      cell.isAbstention !== instance.isAbstention ||
      typeof cell.workspace !== 'string' ||
      !['completed', 'failed', 'in_progress', 'pending'].includes(cell.status)) {
      throw new J4LiveError(
        'CHECKPOINT_PLAN',
        'J4 checkpoint differs from the frozen question plan.',
      )
    }
    if (cell.status === 'completed') {
      if (typeof cell.resultFile !== 'string' ||
        !/^[a-f0-9]{64}$/.test(String(cell.resultSha256 ?? '')) ||
        typeof cell.startedAt !== 'string' ||
        typeof cell.completedAt !== 'string') {
        throw new J4LiveError(
          'CHECKPOINT_RESULT',
          'Completed J4 question lacks durable result evidence.',
        )
      }
    } else if (cell.status === 'pending' &&
      (cell.resultFile !== null || cell.resultSha256 !== null)) {
      throw new J4LiveError(
        'CHECKPOINT_RESULT',
        'Pending J4 question cannot carry result evidence.',
      )
    }
  }
  const completed = completedPrefixLength(checkpoint.questions)
  if (completed > 0 && checkpoint.smoke?.status !== 'completed') {
    throw new J4LiveError(
      'CHECKPOINT_SMOKE',
      'Completed J4 questions require one completed smoke suite.',
    )
  }
  if (checkpoint.smoke?.status === 'in_progress' ||
    checkpoint.smoke?.status === 'failed') {
    throw new J4LiveError(
      'CHECKPOINT_SMOKE_TERMINAL',
      'An interrupted or failed J4 smoke suite cannot be rerun.',
    )
  }
  return { checkpoint, completed }
}

export function planJ4Invocation({
  authority,
  checkpoint,
  checkpointSha256 = null,
  config,
} = {}) {
  const gate = config?.tranches?.find((candidate) =>
    candidate.cumulativeQuestions === authority?.cumulativeQuestions &&
    candidate.cumulativeCapUsd === authority?.cumulativeCapUsd)
  if (!gate) {
    throw new J4LiveError(
      'AUTHORITY_GATE',
      'J4 authority is not one frozen cumulative tranche gate.',
    )
  }
  const completed = completedPrefixLength(checkpoint.questions)
  if (authority?.fromCumulativeQuestions !== completed) {
    throw new J4LiveError(
      'AUTHORITY_FROM_BOUNDARY',
      'J4 authority does not begin at the checkpointed cumulative boundary.',
    )
  }
  if ((completed === 0 && authority?.previousCheckpointSha256 !== null) ||
    (completed > 0 &&
      (!/^[a-f0-9]{64}$/.test(String(checkpointSha256 ?? '')) ||
        authority?.previousCheckpointSha256 !== checkpointSha256))) {
    throw new J4LiveError(
      'AUTHORITY_PREDECESSOR',
      'J4 authority does not pin the exact preceding checkpoint.',
    )
  }
  const priorBoundaries = new Set([0, ...config.tranches.map(
    (candidate) => candidate.cumulativeQuestions,
  )])
  if (!priorBoundaries.has(completed) ||
    gate.cumulativeQuestions <= completed) {
    throw new J4LiveError(
      'AUTHORITY_PROGRESS',
      'J4 authority does not advance exactly from a completed boundary.',
    )
  }
  const selected = checkpoint.questions.slice(
    completed,
    gate.cumulativeQuestions,
  )
  if (selected.length !== gate.questions ||
    selected.some((question) => question.status !== 'pending')) {
    throw new J4LiveError(
      'AUTHORITY_SCOPE',
      'J4 authority does not select exactly its next pending tranche.',
    )
  }
  return {
    capUsd: gate.cumulativeCapUsd,
    completedBefore: completed,
    questionIds: selected.map((question) => question.questionId),
    questions: selected,
    targetQuestions: gate.cumulativeQuestions,
  }
}

export function assertJ4GitCutPoint({
  artifactPaths = [],
  authorityPath,
  branch,
  head,
  ignored,
  originMain,
  statusText,
  trackedPaths = [],
} = {}) {
  if (statusText) {
    throw new J4LiveError(
      'DIRTY_WORKTREE',
      'J4 live execution requires a clean worktree.',
    )
  }
  if (branch !== 'main') {
    throw new J4LiveError('NOT_MAIN', 'J4 live execution requires main.')
  }
  if (!head || head !== originMain) {
    throw new J4LiveError(
      'UNPUSHED_MAIN',
      'J4 live execution requires HEAD to equal origin/main.',
    )
  }
  if (!ignored) {
    throw new J4LiveError(
      'RESULTS_NOT_IGNORED',
      'J4 live result directory must be ignored by git.',
    )
  }
  const tracked = new Set(trackedPaths)
  const required = [...artifactPaths, authorityPath].filter(Boolean)
  const missing = required.filter((path) => !tracked.has(path))
  if (missing.length) {
    throw new J4LiveError(
      'UNTRACKED_LIVE_ARTIFACT',
      `J4 required tracked files are missing: ${missing.join(', ')}`,
    )
  }
  return { administrativeHead: head }
}

function keyFreeEnvironment(env = process.env) {
  const keyNames = new Set([
    ...J4_GOOGLE_CREDENTIAL_ALIASES,
    'OPENAI_API_KEY',
  ])
  const sanitized = {}
  for (const name of Object.keys(env)) {
    // Check the name before dereferencing the value. This lets every git
    // preflight finish without capturing either provider credential.
    if (keyNames.has(name)) continue
    sanitized[name] = env[name]
  }
  return sanitized
}

function gitCommand(repoRoot, args, env = process.env) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: keyFreeEnvironment(env),
  })
  if (result.status !== 0) {
    throw new J4LiveError(
      'GIT_PREFLIGHT_FAILED',
      `git ${args.join(' ')} failed during J4 preflight.`,
    )
  }
  return result.stdout.trim()
}

export async function inspectJ4GitCutPoint({
  artifactPaths,
  authorityPath,
  env = process.env,
  repoRoot = J4_REPO_ROOT,
  runDir,
} = {}) {
  const required = [...new Set([...artifactPaths, authorityPath])]
  const trackedPaths = required.map((path) =>
    gitCommand(repoRoot, ['ls-files', '--error-unmatch', '--', path], env))
  const ignored = spawnSync(
    'git',
    ['check-ignore', '-q', relative(repoRoot, runDir)],
    {
      cwd: repoRoot,
      env: keyFreeEnvironment(env),
    },
  ).status === 0
  return assertJ4GitCutPoint({
    artifactPaths,
    authorityPath,
    branch: gitCommand(repoRoot, ['branch', '--show-current'], env),
    head: gitCommand(repoRoot, ['rev-parse', 'HEAD'], env),
    ignored,
    originMain: gitCommand(repoRoot, ['rev-parse', 'origin/main'], env),
    statusText: gitCommand(
      repoRoot,
      ['status', '--porcelain', '--untracked-files=all'],
      env,
    ),
    trackedPaths,
  })
}

async function syncDirectory(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

export async function atomicWriteJ4(path, text) {
  const parent = dirname(path)
  await mkdir(parent, { recursive: true, mode: 0o700 })
  await chmod(parent, 0o700)
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  let handle
  try {
    handle = await open(temporary, 'wx', 0o600)
    await handle.writeFile(text, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    await rename(temporary, path)
    await chmod(path, 0o600)
    await syncDirectory(parent)
  } catch (error) {
    await handle?.close().catch(() => {})
    await unlink(temporary).catch((unlinkError) => {
      if (unlinkError?.code !== 'ENOENT') throw unlinkError
    })
    throw error
  }
}

async function atomicWriteJson(path, value) {
  await atomicWriteJ4(path, `${JSON.stringify(value, null, 2)}\n`)
}

export async function acquireJ4RunLock(path) {
  const parent = dirname(path)
  await mkdir(parent, { recursive: true, mode: 0o700 })
  let handle
  try {
    handle = await open(path, 'wx', 0o600)
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new J4LiveError(
        'RUN_LOCKED',
        'Another J4 process owns the exclusive run lock.',
      )
    }
    throw error
  }
  await handle.writeFile(`${JSON.stringify({
    pid: process.pid,
    startedAt: new Date().toISOString(),
  })}\n`, 'utf8')
  await handle.sync()
  await syncDirectory(parent)
  let released = false
  return {
    async release() {
      if (released) return
      released = true
      await handle.close()
      await unlink(path)
      await syncDirectory(parent)
    },
  }
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

function assertSecretFreeBuffer(buffer, forbiddenSecrets) {
  for (const secret of forbiddenSecrets) {
    if (secret && buffer.includes(Buffer.from(secret))) {
      throw new J4LiveError(
        'SECRET_ARTIFACT',
        'A J4 artifact contains a captured provider credential.',
      )
    }
  }
  const text = buffer.toString('utf8')
  if (credentialPatterns.some((pattern) => pattern.test(text))) {
    throw new J4LiveError(
      'CREDENTIAL_PATTERN_ARTIFACT',
      'A J4 artifact contains a credential-like value.',
    )
  }
}

export async function collectJ4PrivateArtifacts(
  root,
  {
    exclude = new Set(['artifact-manifest.json']),
    forbiddenSecrets = [],
  } = {},
) {
  const artifacts = []
  async function walk(relativePath = '') {
    const directory = relativePath ? join(root, relativePath) : root
    const metadata = await lstat(directory)
    if (!metadata.isDirectory() || (metadata.mode & 0o777) !== 0o700) {
      throw new J4LiveError(
        'ARTIFACT_DIRECTORY_MODE',
        'Every J4 result directory must be a mode-0700 directory.',
      )
    }
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name))) {
      const child = relativePath
        ? join(relativePath, entry.name)
        : entry.name
      if (!relativePath && exclude.has(child)) continue
      const path = join(root, child)
      const childMetadata = await lstat(path)
      if (childMetadata.isSymbolicLink()) {
        throw new J4LiveError(
          'ARTIFACT_SYMLINK',
          'J4 result artifacts cannot contain symbolic links.',
        )
      }
      if (childMetadata.isDirectory()) {
        await walk(child)
        continue
      }
      if (!childMetadata.isFile() ||
        (childMetadata.mode & 0o777) !== 0o600) {
        throw new J4LiveError(
          'ARTIFACT_FILE_MODE',
          'Every J4 result artifact must be a mode-0600 regular file.',
        )
      }
      const contents = await readFile(path)
      assertSecretFreeBuffer(contents, forbiddenSecrets)
      artifacts.push({
        bytes: contents.length,
        mode: '600',
        path: child,
        sha256: sha256(contents),
      })
    }
  }
  await walk()
  return artifacts
}

export async function auditJ4TrackedFiles({
  env = process.env,
  forbiddenSecrets = [],
  repoRoot = J4_REPO_ROOT,
  trackedPaths = null,
} = {}) {
  const paths = trackedPaths ?? gitCommand(
    repoRoot,
    ['ls-files', '-z'],
    env,
  ).split('\0').filter(Boolean)
  for (const trackedPath of paths) {
    const path = resolve(repoRoot, trackedPath)
    const repositoryPath = relative(repoRoot, path)
    if (!repositoryPath ||
      repositoryPath.startsWith('..') ||
      resolve(repoRoot, repositoryPath) !== path) {
      throw new J4LiveError(
        'TRACKED_PATH_INVALID',
        'J4 tracked-file secret audit encountered an unsafe path.',
      )
    }
    const metadata = await lstat(path)
    if (!metadata.isFile()) {
      throw new J4LiveError(
        'TRACKED_FILE_INVALID',
        'J4 tracked-file secret audit accepts only regular files.',
      )
    }
    assertSecretFreeBuffer(await readFile(path), forbiddenSecrets)
  }
  return {
    files: paths.length,
    trackedPathsSha256: sha256(`${paths.join('\0')}\0`),
  }
}

export async function verifyJ4ArtifactManifest(runDir) {
  const path = join(runDir, 'artifact-manifest.json')
  const text = await readFile(path, 'utf8')
  const manifest = JSON.parse(text)
  const actual = await collectJ4PrivateArtifacts(runDir)
  assertExact(
    actual,
    manifest.artifacts,
    'ARTIFACT_MANIFEST_MISMATCH',
    'Existing J4 artifacts differ from their paused-run manifest.',
  )
  return manifest
}

export function buildJ4JudgeBody(instance, hypothesis) {
  return {
    max_tokens: LONGMEMEVAL_JUDGE_REQUEST.maxTokens,
    messages: [{
      content: buildLongMemEvalJudgePrompt({
        answer: instance.answer,
        hypothesis,
        isAbstention: instance.isAbstention,
        question: instance.question,
        questionType: instance.questionType,
      }),
      role: 'user',
    }],
    model: LONGMEMEVAL_JUDGE_MODEL,
    n: LONGMEMEVAL_JUDGE_REQUEST.n,
    temperature: LONGMEMEVAL_JUDGE_REQUEST.temperature,
  }
}

export async function runJ4SmokeSuite({
  callGemini,
} = {}) {
  if (typeof callGemini !== 'function') {
    throw new TypeError('J4 smoke suite requires the metered Gemini call.')
  }
  const writer = assertValidatedJ4GeminiResponse(
    await callGemini({
      body: j4Config.buildJ4WriterBody({
        assistantMessage: 'Understood.',
        palariId: 'palari-longmemeval-j4',
        palariName: 'Palari',
        sourceMessageId: 'j4-smoke:0',
        sourceTexts: [],
        userId: 'user-longmemeval-j4',
        userMessage: 'For this compatibility check, I prefer blue.',
        userName: 'user',
      }),
      cellId: 'j4-compatibility-smoke',
      operationId: 'smoke:gemini-writer',
      purpose: 'writer',
    }),
    'writer',
  )
  assertExactExtractionEnvelope(writer.text)
  return {
    geminiModelVersion: writer.modelVersion,
    logicalOperations: 1,
  }
}

function observedFailureStage(instance, armResult, officialCorrect) {
  if (officialCorrect) return 'none'
  if (instance.isAbstention) return 'answer'
  if (Number(armResult?.ingest?.memoryRows ?? 0) === 0) return 'write'
  if (armResult?.retrieval?.at10?.all !== true) return 'retrieval'
  return 'answer'
}

const meterUsageFields = Object.freeze([
  'geminiInputTokens',
  'geminiOutputTokens',
  'judgeInputTokens',
  'judgeOutputTokens',
  'usd',
])

export function assertValidatedJ4JudgeResponse(response) {
  if (response?.validated !== true ||
    response.finishReason !== 'stop' ||
    response.modelVersion !== LONGMEMEVAL_JUDGE_MODEL ||
    typeof response.text !== 'string' ||
    !response.text.trim() ||
    !response.usage ||
    meterUsageFields.some((field) =>
      !Number.isFinite(response.usage[field]) || response.usage[field] < 0) ||
    response.usage.geminiInputTokens !== 0 ||
    response.usage.geminiOutputTokens !== 0 ||
    response.usage.judgeInputTokens < 1 ||
    response.usage.judgeOutputTokens < 1 ||
    !response.usageDetails ||
    Object.keys(response.usageDetails).length !== 0) {
    throw new J4LiveError(
      'JUDGE_RESULT_UNVALIDATED',
      'J4 requires a fully validated official-judge transport result.',
    )
  }
  return response
}

function usageDelta(after = {}, before = {}) {
  return Object.fromEntries(meterUsageFields.map((field) => [
    field,
    Number(after[field] ?? 0) - Number(before[field] ?? 0),
  ]))
}

export function buildJ4QuestionMeterEvidence(before = {}, after = {}) {
  const purposes = new Set([
    ...Object.keys(before.logicalRequests ?? {}),
    ...Object.keys(after.logicalRequests ?? {}),
  ])
  return {
    accountedDelta: usageDelta(after.accounted, before.accounted),
    attempts: Number(after.attempts ?? 0) - Number(before.attempts ?? 0),
    cumulativeAccounted: clone(after.accounted ?? {}),
    cumulativeMeasured: clone(after.measured ?? {}),
    logicalRequests: Object.fromEntries([...purposes].sort().map((purpose) => [
      purpose,
      Number(after.logicalRequests?.[purpose] ?? 0) -
        Number(before.logicalRequests?.[purpose] ?? 0),
    ])),
    measuredDelta: usageDelta(after.measured, before.measured),
    retries: (after.retries ?? []).slice((before.retries ?? []).length),
    sequence: Number(after.sequence ?? 0) - Number(before.sequence ?? 0),
    uncertainDelta: usageDelta(after.uncertain, before.uncertain),
  }
}

export function countJ4WriterRequests(instance = {}) {
  return (instance.sessions ?? []).reduce((total, session) =>
    total + (session.turns ?? []).filter((turn) =>
      turn?.role === 'user').length, 0)
}

export function assertJ4QuestionMeterEvidence({
  capUsd,
  evidence,
  expectedWriterRequests,
} = {}) {
  const logical = evidence?.logicalRequests ?? {}
  const logicalTotal =
    Number(logical.writer ?? 0) +
    Number(logical.answer ?? 0) +
    Number(logical.judge ?? 0)
  if (!Number.isSafeInteger(expectedWriterRequests) ||
    expectedWriterRequests < 0 ||
    Number(logical.writer ?? 0) !== expectedWriterRequests ||
    Number(logical.answer ?? 0) !== 1 ||
    Number(logical.judge ?? 0) !== 1 ||
    !Number.isSafeInteger(evidence?.attempts) ||
    evidence.attempts !== logicalTotal + (evidence.retries?.length ?? 0) ||
    evidence.sequence !== evidence.attempts * 2) {
    throw new J4LiveError(
      'QUESTION_METER_CARDINALITY',
      'J4 question call, attempt, retry, or ledger-event counts differ.',
    )
  }
  for (const field of meterUsageFields) {
    const accounted = Number(evidence.accountedDelta?.[field])
    const measured = Number(evidence.measuredDelta?.[field])
    const uncertain = Number(evidence.uncertainDelta?.[field])
    if (!Number.isFinite(accounted) ||
      !Number.isFinite(measured) ||
      !Number.isFinite(uncertain) ||
      accounted < 0 ||
      measured < 0 ||
      uncertain < 0 ||
      Math.abs(accounted - measured - uncertain) > 1e-12) {
      throw new J4LiveError(
        'QUESTION_METER_USAGE',
        'J4 question usage did not reconcile to successful measured calls.',
      )
    }
  }
  if (evidence.measuredDelta.geminiInputTokens <= 0 ||
    evidence.measuredDelta.geminiOutputTokens <= 0 ||
    evidence.measuredDelta.judgeInputTokens <= 0 ||
    evidence.measuredDelta.judgeOutputTokens <= 0 ||
    !Number.isFinite(evidence.cumulativeAccounted?.usd) ||
    evidence.cumulativeAccounted.usd > capUsd) {
    throw new J4LiveError(
      'QUESTION_METER_USAGE',
      'J4 question lacks reconciled provider usage or exceeds its cap.',
    )
  }
  return evidence
}

export function buildJ4QuestionResult({
  armResult,
  instance,
  judgeResponse,
  meterEvidence = null,
  prediction,
} = {}) {
  const officialCorrect = parseLongMemEvalJudgeLabel(judgeResponse.text)
  const failureStage = observedFailureStage(
    instance,
    armResult,
    officialCorrect,
  )
  return {
    answer: armResult.answer,
    answerModelVersion: armResult.answerModelVersion,
    briefing: armResult.briefing,
    ingest: armResult.ingest,
    isAbstention: instance.isAbstention,
    judge: {
      correct: officialCorrect,
      modelVersion: judgeResponse.modelVersion,
      response: judgeResponse.text,
    },
    meter: meterEvidence ? clone(meterEvidence) : null,
    observedFailureStage: failureStage,
    prediction: {
      matched:
        prediction.predictedOfficialCorrect === officialCorrect &&
        prediction.predictedFailureStage === failureStage,
      predictedFailureStage: prediction.predictedFailureStage,
      predictedOfficialCorrect: prediction.predictedOfficialCorrect,
    },
    promptSha256: armResult.promptSha256,
    questionId: instance.questionId,
    questionType: instance.questionType,
    retrieval: armResult.retrieval,
    schemaVersion: 1,
  }
}

export async function validateJ4QuestionResult({
  cell,
  instance,
  resultText,
} = {}) {
  if (sha256(resultText) !== cell.resultSha256) {
    throw new J4LiveError(
      'QUESTION_RESULT_HASH',
      'J4 question result differs from its checkpoint hash.',
    )
  }
  let result
  try {
    result = JSON.parse(resultText)
  } catch (error) {
    throw new J4LiveError(
      'QUESTION_RESULT_JSON',
      'J4 question result is not valid JSON.',
      { cause: error },
    )
  }
  if (result.schemaVersion !== 1 ||
    result.questionId !== instance.questionId ||
    result.questionType !== instance.questionType ||
    result.isAbstention !== instance.isAbstention ||
    typeof result.judge?.correct !== 'boolean' ||
    typeof result.answer !== 'string') {
    throw new J4LiveError(
      'QUESTION_RESULT_SCHEMA',
      'J4 question result differs from its frozen instance.',
    )
  }
  return result
}

function addCheckpointEvent(checkpoint, {
  questionId = null,
  status,
  timestamp,
}) {
  checkpoint.events.push({ questionId, status, timestamp })
}

async function writeCheckpoint(paths, checkpoint) {
  await atomicWriteJson(paths.checkpointPath, checkpoint)
}

async function verifyCompletedResults(checkpoint, population, runDir) {
  const results = []
  for (let index = 0; index < checkpoint.questions.length; index += 1) {
    const cell = checkpoint.questions[index]
    if (cell.status !== 'completed') continue
    const resultText = await readFile(join(runDir, cell.resultFile), 'utf8')
    results.push(await validateJ4QuestionResult({
      cell,
      instance: population.executionOrder[index],
      resultText,
    }))
  }
  return results
}

export function buildJ4PrivateReport({
  checkpoint,
  meter,
  results,
} = {}) {
  const missesFirst = [...results].sort((left, right) =>
    Number(left.judge.correct) - Number(right.judge.correct) ||
    left.questionId.localeCompare(right.questionId))
  const byType = {}
  for (const result of results) {
    const score = (byType[result.questionType] ??= { correct: 0, total: 0 })
    score.total += 1
    if (result.judge.correct) score.correct += 1
  }
  const correct = results.filter((result) => result.judge.correct).length
  const predictionMisses = results.filter((result) =>
    !result.prediction.matched)
  return {
    byType,
    completedQuestions: results.length,
    disclaimer:
      'Private diagnostic prefix; non-representative and not publishable.',
    meter,
    missesFirst,
    officialAccuracy: {
      correct,
      total: results.length,
    },
    predictionMisses,
    runId: checkpoint.identity.runId,
    schemaVersion: 1,
    status: checkpoint.status,
  }
}

function renderJ4PrivateReport(report) {
  const lines = [
    '# J4 private staged LongMemEval report',
    '',
    `> ${report.disclaimer}`,
    '',
    `- Status: ${report.status}`,
    `- Completed questions: ${report.completedQuestions}`,
    `- Preliminary official accuracy: ${report.officialAccuracy.correct}/${report.officialAccuracy.total}`,
    `- Accounted spend: $${Number(report.meter?.accounted?.usd ?? 0).toFixed(6)}`,
    `- Measured spend: $${Number(report.meter?.measured?.usd ?? 0).toFixed(6)}`,
    `- Provider retries: ${report.meter?.retries?.length ?? 0}`,
    '',
    '## Misses first',
    '',
  ]
  const misses = report.missesFirst.filter((result) => !result.judge.correct)
  if (!misses.length) lines.push('- None.')
  for (const result of misses) {
    lines.push(
      `- \`${result.questionId}\` (${result.questionType}) — ` +
      `${result.observedFailureStage}; recall@10 ` +
      `${result.retrieval?.at10?.hit ?? 'n/a'}`,
    )
  }
  lines.push('', '## Remaining completed questions', '')
  for (const result of report.missesFirst.filter((entry) =>
    entry.judge.correct)) {
    lines.push(`- \`${result.questionId}\` (${result.questionType}) — correct`)
  }
  lines.push('', '## Prediction misses', '')
  if (!report.predictionMisses.length) lines.push('- None.')
  for (const result of report.predictionMisses) {
    lines.push(
      `- \`${result.questionId}\` — predicted ` +
      `${result.prediction.predictedOfficialCorrect}/` +
      `${result.prediction.predictedFailureStage}; observed ` +
      `${result.judge.correct}/${result.observedFailureStage}`,
    )
  }
  return `${lines.join('\n')}\n`
}

async function writeTerminalArtifacts({
  checkpoint,
  forbiddenSecrets,
  paths,
  transport,
  population,
}) {
  const meter = await transport.snapshot()
  checkpoint.meter = meter
  const results = await verifyCompletedResults(
    checkpoint,
    population,
    paths.runDir,
  )
  const report = buildJ4PrivateReport({ checkpoint, meter, results })
  const reportJson = `${JSON.stringify(report, null, 2)}\n`
  const reportMarkdown = renderJ4PrivateReport(report)
  await atomicWriteJ4(paths.reportJsonPath, reportJson)
  await atomicWriteJ4(paths.reportMarkdownPath, reportMarkdown)
  checkpoint.report = {
    json: relative(paths.runDir, paths.reportJsonPath),
    jsonSha256: sha256(reportJson),
    markdown: relative(paths.runDir, paths.reportMarkdownPath),
    markdownSha256: sha256(reportMarkdown),
  }
  await writeCheckpoint(paths, checkpoint)
  const artifacts = await collectJ4PrivateArtifacts(paths.runDir, {
    forbiddenSecrets,
  })
  await atomicWriteJson(paths.artifactManifestPath, {
    artifacts,
    generatedAt: new Date().toISOString(),
    runId: checkpoint.identity.runId,
    schemaVersion: 1,
  })
  return report
}

export async function executeJ4AuthorizedTranche({
  authority,
  authoritySha256,
  checkpoint,
  config,
  forbiddenSecrets,
  identity,
  now = () => new Date().toISOString(),
  paths,
  population,
  predecessorCheckpointSha256 = null,
  runQuestion = runKernelLongMemEvalQuestion,
  transport,
  administrativeHead,
} = {}) {
  const { completed } = assertJ4Checkpoint({
    checkpoint,
    identity,
    population,
  })
  const invocation = planJ4Invocation({
    authority,
    checkpoint,
    checkpointSha256: predecessorCheckpointSha256,
    config,
  })
  if (completed !== invocation.completedBefore) {
    throw new J4LiveError(
      'INVOCATION_PREFIX_CHANGED',
      'J4 completed prefix changed while planning an invocation.',
    )
  }
  checkpoint.invocations.push({
    administrativeHead,
    authoritySha256,
    capUsd: invocation.capUsd,
    startedAt: isoNow(now),
    targetQuestions: invocation.targetQuestions,
  })
  checkpoint.status = 'running'
  await writeCheckpoint(paths, checkpoint)

  if (checkpoint.smoke.status === 'pending') {
    checkpoint.smoke.status = 'in_progress'
    checkpoint.smoke.startedAt = isoNow(now)
    addCheckpointEvent(checkpoint, {
      status: 'smoke_in_progress',
      timestamp: checkpoint.smoke.startedAt,
    })
    await writeCheckpoint(paths, checkpoint)
    try {
      const smoke = await runJ4SmokeSuite({
        callGemini: transport.callGemini,
      })
      const verified = await transport.verify()
      checkpoint.meter = verified.ledger
      checkpoint.smoke = {
        ...checkpoint.smoke,
        ...smoke,
        completedAt: isoNow(now),
        status: 'completed',
      }
      addCheckpointEvent(checkpoint, {
        status: 'smoke_completed',
        timestamp: checkpoint.smoke.completedAt,
      })
      await writeCheckpoint(paths, checkpoint)
      await collectJ4PrivateArtifacts(paths.runDir, { forbiddenSecrets })
    } catch (error) {
      checkpoint.smoke.status = 'failed'
      checkpoint.smoke.failedAt = isoNow(now)
      checkpoint.status = 'failed'
      checkpoint.failure = sanitizedRunnerError(error, forbiddenSecrets)
      await writeCheckpoint(paths, checkpoint)
      throw error
    }
  }

  for (let index = invocation.completedBefore;
    index < invocation.targetQuestions;
    index += 1) {
    const cell = checkpoint.questions[index]
    const instance = population.executionOrder[index]
    if (cell.status !== 'pending' ||
      instance.questionId !== cell.questionId) {
      throw new J4LiveError(
        'QUESTION_NOT_PENDING',
        'J4 refuses to rerun or reorder a question.',
      )
    }
    const workspacePath = join(paths.runDir, cell.workspace)
    if (await exists(workspacePath)) {
      throw new J4LiveError(
        'STALE_WORKSPACE',
        'Pending J4 question already has a workspace; rerun is forbidden.',
      )
    }
    cell.status = 'in_progress'
    cell.startedAt = isoNow(now)
    addCheckpointEvent(checkpoint, {
      questionId: cell.questionId,
      status: 'in_progress',
      timestamp: cell.startedAt,
    })
    const meterBefore = await transport.snapshot()
    checkpoint.meter = meterBefore
    await writeCheckpoint(paths, checkpoint)

    try {
      const armResult = await runQuestion({
        callGemini: transport.callGemini,
        instance,
        workspaceDir: workspacePath,
      })
      if (armResult.answerModelVersion !==
        checkpoint.smoke.geminiModelVersion) {
        throw new J4LiveError(
          'QUESTION_MODEL_VERSION',
          'J4 answer modelVersion differs from the smoke-locked version.',
        )
      }
      const judgeResponse = assertValidatedJ4JudgeResponse(
        await transport.callJudge({
          body: buildJ4JudgeBody(instance, armResult.answer),
          cellId: instance.questionId,
          model: LONGMEMEVAL_JUDGE_MODEL,
          operationId: `question:${instance.questionId}:judge`,
          purpose: 'judge',
        }),
      )
      const meterAfter = await transport.snapshot()
      const meterEvidence = assertJ4QuestionMeterEvidence({
        capUsd: invocation.capUsd,
        evidence: buildJ4QuestionMeterEvidence(
          meterBefore,
          meterAfter,
        ),
        expectedWriterRequests: countJ4WriterRequests(instance),
      })
      if (Number(armResult.ingest?.turns) !==
        countJ4WriterRequests(instance)) {
        throw new J4LiveError(
          'QUESTION_WRITER_CARDINALITY',
          'J4 arm writer observations differ from canonical user turns.',
        )
      }
      const result = buildJ4QuestionResult({
        armResult,
        instance,
        judgeResponse,
        meterEvidence,
        prediction: cell.prediction,
      })
      const resultFile = join(
        'questions',
        `${String(cell.ordinal).padStart(2, '0')}-${safeName(cell.questionId)}.json`,
      )
      const resultText = `${JSON.stringify(result, null, 2)}\n`
      await atomicWriteJ4(join(paths.runDir, resultFile), resultText)
      cell.resultFile = resultFile
      cell.resultSha256 = sha256(resultText)
      checkpoint.meter = meterAfter
      await writeCheckpoint(paths, checkpoint)

      await transport.verify()
      await validateJ4QuestionResult({ cell, instance, resultText })
      await collectJ4PrivateArtifacts(paths.runDir, { forbiddenSecrets })

      cell.completedAt = isoNow(now)
      cell.status = 'completed'
      addCheckpointEvent(checkpoint, {
        questionId: cell.questionId,
        status: 'completed',
        timestamp: cell.completedAt,
      })
      checkpoint.meter = await transport.snapshot()
      await writeCheckpoint(paths, checkpoint)
      assertJ4Checkpoint({ checkpoint, identity, population })

      // A valid but wrong answer is a product finding and does not stop the
      // tranche. Zero admitted memory on a completed answerable question is
      // the founder-requested catastrophic product pause.
      if (!instance.isAbstention &&
        Number(result.ingest?.memoryRows ?? 0) === 0) {
        checkpoint.pauseReason = 'ZERO_ADMITTED_MEMORIES'
        checkpoint.status = 'paused'
        checkpoint.pausedAt = isoNow(now)
        break
      }
    } catch (error) {
      cell.status = 'failed'
      cell.failedAt = isoNow(now)
      cell.error = sanitizedRunnerError(error, forbiddenSecrets)
      checkpoint.failure = cell.error
      checkpoint.status = 'failed'
      checkpoint.meter = await transport.snapshot().catch(() => checkpoint.meter)
      addCheckpointEvent(checkpoint, {
        questionId: cell.questionId,
        status: 'failed',
        timestamp: cell.failedAt,
      })
      await writeCheckpoint(paths, checkpoint)
      throw error
    }
  }

  if (checkpoint.status === 'running') {
    const after = completedPrefixLength(checkpoint.questions)
    if (after !== invocation.targetQuestions) {
      throw new J4LiveError(
        'TRANCHE_BOUNDARY_MISSED',
        'J4 runner did not stop at its exact authorized boundary.',
      )
    }
    checkpoint.status = after === 60 ? 'complete' : 'paused'
    checkpoint.pauseReason = after === 60
      ? null
      : 'FOUNDER_REVIEW_REQUIRED'
    checkpoint.pausedAt = isoNow(now)
  }
  checkpoint.invocations.at(-1).completedAt = isoNow(now)
  checkpoint.invocations.at(-1).completedQuestions =
    completedPrefixLength(checkpoint.questions)
  const report = await writeTerminalArtifacts({
    checkpoint,
    forbiddenSecrets,
    paths,
    population,
    transport,
  })
  return { checkpoint, report }
}

function sanitizedRunnerError(error, forbiddenSecrets = []) {
  let message = String(error?.message ?? 'J4 runner failed.')
  for (const secret of forbiddenSecrets) {
    if (secret) message = message.replaceAll(secret, '[REDACTED_SECRET]')
  }
  return {
    code: String(error?.code ?? error?.name ?? 'J4_RUNNER_FAILURE').slice(0, 80),
    message: message.slice(0, 240),
  }
}

function resultPaths(repoRoot = J4_REPO_ROOT) {
  const resultsRoot = resolve(repoRoot, j4Config.J4_LIVE_RESULTS_ROOT)
  const runDir = join(resultsRoot, j4Config.J4_LIVE_RUN_ID)
  return {
    artifactManifestPath: join(runDir, 'artifact-manifest.json'),
    checkpointPath: join(runDir, 'checkpoint.json'),
    ledgerPath: join(runDir, 'meter.jsonl'),
    lockPath: join(resultsRoot, `${j4Config.J4_LIVE_RUN_ID}.lock`),
    reportJsonPath: join(runDir, 'report.json'),
    reportMarkdownPath: join(runDir, 'report.md'),
    resultsRoot,
    runDir,
    transcriptDirectory: join(runDir, 'transcripts'),
  }
}

async function readExistingCheckpoint(path) {
  try {
    const text = await readFile(path, 'utf8')
    return {
      checkpoint: JSON.parse(text),
      checkpointSha256: sha256(text),
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

export async function main({
  args = process.argv.slice(2),
  dependencies = {},
  env = process.env,
  repoRoot = J4_REPO_ROOT,
} = {}) {
  const read = dependencies.readFile ?? readFile
  const preparePopulation =
    dependencies.preparePopulation ?? prepareJ4PinnedS60
  const loadConfig =
    dependencies.loadConfig ?? j4Config.loadJ4LiveConfig
  const loadAuthority =
    dependencies.loadAuthority ?? j4Config.loadJ4LiveAuthority
  const inspectGit =
    dependencies.inspectGitCutPoint ?? inspectJ4GitCutPoint
  const assertEnvironment =
    dependencies.assertEnvironment ?? j4Config.assertJ4LiveEnvironment
  const meterFactory =
    dependencies.createMeteredTransport ?? createJ4MeteredTransport
  const auditTrackedFiles =
    dependencies.auditTrackedFiles ?? auditJ4TrackedFiles
  const questionRunner =
    dependencies.runQuestion ?? runKernelLongMemEvalQuestion
  const log = dependencies.log ?? console.log

  parseJ4LiveArgs(args)
  const paths = resultPaths(repoRoot)

  // Non-secret preflight. Do not move credential reads above this block.
  const rawDataset = await read(
    resolve(repoRoot, 'data/longmemeval_s_cleaned.json'),
  )
  const prepared = preparePopulation({ raw: rawDataset })
  const population = assertJ4LivePopulation(prepared)
  const loaded = await loadConfig({ repoRoot })
  const loadedAuthority = await loadAuthority({ repoRoot })
  const identity = buildJ4ImmutableIdentity({
    config: loaded.config,
    configSha256: loaded.configSha256,
    datasetSha256: prepared.manifest.datasetSha256,
    predictionsSha256: loaded.predictionsSha256,
  })
  const repositoryPath = (path) =>
    relative(repoRoot, resolve(repoRoot, path))
  const artifactPaths = [...new Set([
    ...loaded.config.artifacts.map((entry) => entry.path),
    loaded.configPath,
    loaded.config.predictions.path,
  ].map(repositoryPath))]
  const authorityPath = repositoryPath(loadedAuthority.authorityPath)
  const git = await inspectGit({
    artifactPaths,
    authorityPath,
    env,
    repoRoot,
    runDir: paths.runDir,
  })
  const lock = await acquireJ4RunLock(paths.lockPath)
  let previousUmask
  try {
    const runDirectoryAlreadyExists = await exists(paths.runDir)
    const existing = await readExistingCheckpoint(paths.checkpointPath)
    if (!existing && runDirectoryAlreadyExists) {
      throw new J4LiveError(
        'STALE_RUN_DIRECTORY',
        'J4 refuses to overlay a run directory without its checkpoint.',
      )
    }
    const predecessorCheckpointSha256 =
      existing?.checkpointSha256 ?? null
    let checkpoint = existing?.checkpoint ?? buildJ4Checkpoint({
      identity,
      population,
      predictions: loaded.predictions,
    })
    if (existing) {
      assertJ4Checkpoint({ checkpoint, identity, population })
      if (checkpoint.status === 'paused') {
        await verifyJ4ArtifactManifest(paths.runDir)
      } else if (checkpoint.status !== 'ready') {
        throw new J4LiveError(
          'RUN_NOT_RESUMABLE',
          'Existing J4 run is not at a safe paused boundary.',
        )
      }
    }
    // Authority, scope, and predecessor validation are non-secret. They must
    // finish before the first credential dereference.
    planJ4Invocation({
      authority: loadedAuthority.authority,
      checkpoint,
      checkpointSha256: predecessorCheckpointSha256,
      config: loaded.config,
    })

    // This is the first point at which either key is read.
    const runtime = assertEnvironment(
      env,
      loaded.config,
      loadedAuthority.authority,
    )
    const secrets = [runtime.geminiApiKey, runtime.openaiApiKey]
    for (const name of J4_GOOGLE_CREDENTIAL_ALIASES) {
      env[name] = J4_DENY_GEMINI_KEY
    }
    env.OPENAI_API_KEY = J4_DENY_OPENAI_KEY
    const trackedSecretAudit = await auditTrackedFiles({
      env,
      forbiddenSecrets: secrets,
      repoRoot,
    })
    checkpoint.trackedSecretAudits ??= []
    checkpoint.trackedSecretAudits.push({
      ...trackedSecretAudit,
      administrativeHead: git.administrativeHead,
      completedAt: isoNow(),
    })
    previousUmask = process.umask(0o077)
    await mkdir(paths.runDir, { recursive: true, mode: 0o700 })
    await chmod(paths.runDir, 0o700)
    await mkdir(paths.transcriptDirectory, { recursive: true, mode: 0o700 })
    await chmod(paths.transcriptDirectory, 0o700)

    await writeCheckpoint(paths, checkpoint)
    const transport = await meterFactory({
      capUsd: runtime.capUsd,
      geminiApiKey: runtime.geminiApiKey,
      journalPath: paths.ledgerPath,
      limits: j4Config.j4LimitsForCumulativeQuestions(
        runtime.cumulativeQuestions,
      ),
      openaiApiKey: runtime.openaiApiKey,
      transcriptDirectory: paths.transcriptDirectory,
    })
    transport.installNetworkGuard()
    try {
      const execution = await executeJ4AuthorizedTranche({
        administrativeHead: git.administrativeHead,
        authority: loadedAuthority.authority,
        authoritySha256: loadedAuthority.authoritySha256,
        checkpoint,
        config: loaded.config,
        forbiddenSecrets: secrets,
        identity,
        paths,
        population,
        predecessorCheckpointSha256,
        runQuestion: questionRunner,
        transport,
      })
      log(
        `J4 paused after ${execution.report.completedQuestions} questions; ` +
        `private report: ${paths.reportMarkdownPath}`,
      )
      return execution
    } catch (error) {
      checkpoint.status = 'failed'
      checkpoint.failure ??= sanitizedRunnerError(error, secrets)
      checkpoint.failedAt ??= isoNow()
      const currentInvocation = checkpoint.invocations.at(-1)
      if (currentInvocation) {
        currentInvocation.completedAt ??= checkpoint.failedAt
        currentInvocation.completedQuestions ??=
          checkpoint.questions.filter((cell) =>
            cell.status === 'completed').length
      }
      try {
        await writeTerminalArtifacts({
          checkpoint,
          forbiddenSecrets: secrets,
          paths,
          population,
          transport,
        })
      } catch (bundleError) {
        checkpoint.failureBundle =
          sanitizedRunnerError(bundleError, secrets)
        await writeCheckpoint(paths, checkpoint).catch(() => {})
      }
      throw error
    } finally {
      transport.closeNetworkGuard()
    }
  } finally {
    if (previousUmask !== undefined) process.umask(previousUmask)
    await lock.release()
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : ''
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      `${error?.code ?? 'J4_LIVE_FAILED'}: ${error?.message ?? 'J4 live run failed.'}`,
    )
    process.exitCode = 1
  })
}
