// J3 founder-gated live bake-off.
//
// This runner is inert when imported. The CLI path performs a strict
// preflight, writes an ignored pre-call checkpoint for each arm/journey
// cell, and never reruns a completed, failed, or interrupted cell.

import { spawnSync } from 'node:child_process'
import {
  access,
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

import { createKernelLiveArm } from './arms/kernel-live-arm.mjs'
import { createMem0LiveArm } from './arms/mem0-live-arm.mjs'
import { loadJourneyBank } from './journey-bank.mjs'
import { loadLiveRunConfig } from './live-run-config.mjs'
import { verifyLiveTranscriptArtifacts } from './live-transcript.mjs'
import {
  LIVE_CAP_USD,
  LiveRunError,
  aggregateLiveCells,
  assertFrozenLiveInputs,
  assertLiveEnvironment,
  createBlankMeterState,
  createMeteredOpenAITransport,
  executeLiveJourney,
  reconcileMeterJournal,
  renderLiveReportMarkdown,
  sha256,
} from './live-runtime.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = dirname(here)
const resultsRoot = join(here, 'results')
const legacyRunDir = join(resultsRoot, 'j3-live-v1')
const runLockPath = join(resultsRoot, 'j3-live-series.lock')
const denyUnmeteredKey = 'palari-deny-unmetered-openai'
const MEM0_VERSION = '3.1.1'
const armNames = ['palari-brain-kernel-live', 'mem0-oss-live']
const requiredTrackedFiles = [
  'AGENTS.md',
  'STATUS.md',
  'docs/BAKEOFF-J3-HEALING.md',
  'docs/DECISIONS.md',
  'evals/arms/kernel-live-arm.mjs',
  'evals/arms/mem0-live-arm.mjs',
  'evals/live-runtime.mjs',
  'evals/live-run-config.mjs',
  'evals/live-transcript.mjs',
  'evals/run-bakeoff-live.mjs',
  'package-lock.json',
  'package.json',
  'tests/live-bakeoff.contract.test.mjs',
  'tests/live-healing.contract.test.mjs',
  'tests/live-run-config.test.mjs',
  'tests/live-transcript.test.mjs',
]

async function assertInstalledMem0Version() {
  const [packageText, lockText, installedText] = await Promise.all([
    readFile(join(repoRoot, 'package.json'), 'utf8'),
    readFile(join(repoRoot, 'package-lock.json'), 'utf8'),
    readFile(join(repoRoot, 'node_modules', 'mem0ai', 'package.json'), 'utf8'),
  ])
  let packageJson
  let lockJson
  let installed
  try {
    packageJson = JSON.parse(packageText)
    lockJson = JSON.parse(lockText)
    installed = JSON.parse(installedText)
  } catch {
    throw new LiveRunError(
      'MEM0_VERSION_MISMATCH',
      'Mem0 package metadata is not valid JSON.',
    )
  }
  if (packageJson.devDependencies?.mem0ai !== MEM0_VERSION ||
    packageJson.dependencies?.mem0ai !== undefined ||
    lockJson.packages?.['']?.devDependencies?.mem0ai !== MEM0_VERSION ||
    lockJson.packages?.['node_modules/mem0ai']?.version !== MEM0_VERSION ||
    installed.version !== MEM0_VERSION ||
    installed.license !== 'Apache-2.0') {
    throw new LiveRunError(
      'MEM0_VERSION_MISMATCH',
      `J3 repair runs require exact eval-only mem0ai@${MEM0_VERSION}.`,
    )
  }
  return {
    license: installed.license,
    version: installed.version,
  }
}

function command(args) {
  const childEnv = { ...process.env }
  delete childEnv.OPENAI_API_KEY
  delete childEnv.MEM0_API_KEY
  const result = spawnSync(args[0], args.slice(1), {
    cwd: repoRoot,
    encoding: 'utf8',
    env: childEnv,
  })
  if (result.status !== 0) {
    throw new LiveRunError(
      'PREFLIGHT_COMMAND_FAILED',
      `${args.join(' ')} failed during live preflight.`,
    )
  }
  return result.stdout.trim()
}

function assertGitCutPoint({ requiredFiles = requiredTrackedFiles, runDir } = {}) {
  if (command(['git', 'status', '--porcelain', '--untracked-files=all'])) {
    throw new LiveRunError(
      'DIRTY_TRACKED_WORKTREE',
      'Tracked or untracked worktree changes exist; live code must be committed first.',
    )
  }
  if (command(['git', 'branch', '--show-current']) !== 'main') {
    throw new LiveRunError('NOT_MAIN', 'J3 live execution must run from main.')
  }
  const head = command(['git', 'rev-parse', 'HEAD'])
  const originMain = command(['git', 'rev-parse', 'origin/main'])
  if (head !== originMain) {
    throw new LiveRunError(
      'UNPUSHED_LIVE_CODE',
      'HEAD differs from origin/main; live code must be pushed first.',
    )
  }
  for (const path of requiredFiles) {
    command(['git', 'ls-files', '--error-unmatch', '--', path])
  }
  const ignored = spawnSync('git', ['check-ignore', '-q', relative(repoRoot, runDir)], {
    cwd: repoRoot,
    env: Object.fromEntries(
      Object.entries(process.env)
        .filter(([key]) => !['MEM0_API_KEY', 'OPENAI_API_KEY'].includes(key)),
    ),
  })
  if (ignored.status !== 0) {
    throw new LiveRunError(
      'RESULTS_NOT_IGNORED',
      'Live result directory is not ignored by git.',
    )
  }
  return head
}

async function atomicWrite(path, text) {
  const parent = dirname(path)
  await mkdir(parent, { recursive: true })
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  let handle
  try {
    handle = await open(temporary, 'wx', 0o600)
    await handle.writeFile(text, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    await rename(temporary, path)
    await syncDirectory(parent)
  } catch (error) {
    await handle?.close().catch(() => {})
    await unlink(temporary).catch((unlinkError) => {
      if (unlinkError?.code !== 'ENOENT') throw unlinkError
    })
    throw error
  }
}

async function syncDirectory(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

export async function acquireExclusiveRunLock(path = runLockPath) {
  const parent = dirname(path)
  await mkdir(parent, { recursive: true })
  await syncDirectory(dirname(parent))
  let handle
  try {
    handle = await open(path, 'wx', 0o600)
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new LiveRunError(
        'LIVE_RUN_LOCKED',
        'Another J3 live runner owns the durable run lock; do not start a second process.',
      )
    }
    throw error
  }
  try {
    await handle.writeFile(`${JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
    })}\n`, 'utf8')
    await handle.sync()
    await syncDirectory(parent)
  } catch (error) {
    await handle.close().catch(() => {})
    await unlink(path).catch(() => {})
    throw error
  }
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

async function atomicWriteJson(path, value) {
  await atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function checkpointIdentity(repoCommit, bankVersion, { config, configHash }) {
  return {
    bankSha256: config.bank.sha256,
    bankVersion,
    capUsd: config.budget.cumulativeCapUsd,
    configSha256: configHash,
    mem0Version: MEM0_VERSION,
    model: config.model.chat,
    openingAccountedUsd: config.budget.openingAccountedUsd,
    predecessors: config.budget.predecessors.map((entry) => ({
      accountedUsd: entry.accountedUsd,
      meterSha256: entry.meterSha256,
      runId: entry.runId,
    })),
    predictionsSha256: config.predictions.sha256,
    repoCommit,
    runDate: config.runDate,
    runId: config.runId,
    version: 2,
  }
}

function cellId(journeyId, armName) {
  return `${journeyId}::${armName}`
}

function safeCellPath(id) {
  return id.replaceAll(/[^A-Za-z0-9_.-]/g, '_')
}

export function buildLiveCheckpoint(bank, identity) {
  const cells = []
  for (const journey of bank.journeys) {
    for (const armName of armNames) {
      const id = cellId(journey.id, armName)
      cells.push({
        armName,
        cellId: id,
        journeyId: journey.id,
        resultFile: null,
        resultSha256: null,
        status: 'pending',
        workspace: join('workspaces', safeCellPath(id)),
      })
    }
  }
  return {
    cells,
    events: [],
    identity,
    meter: createBlankMeterState(),
    status: 'running',
  }
}

function sameIdentity(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function assertCheckpointResumable(checkpoint, identity, bank) {
  if (!checkpoint || typeof checkpoint !== 'object' || !bank) {
    throw new LiveRunError(
      'BAD_CHECKPOINT_SCHEMA',
      'Existing live checkpoint has an invalid top-level schema.',
    )
  }
  if (!sameIdentity(checkpoint.identity, identity)) {
    throw new LiveRunError(
      'CHECKPOINT_IDENTITY_MISMATCH',
      'Existing live checkpoint belongs to a different run identity.',
    )
  }
  if (checkpoint.status === 'complete') {
    throw new LiveRunError('RUN_ALREADY_COMPLETE', 'The J3 live run is already complete.')
  }
  if (checkpoint.status !== 'running') {
    throw new LiveRunError(
      'TERMINAL_CHECKPOINT',
      'The existing live checkpoint is not resumable.',
    )
  }
  const expected = buildLiveCheckpoint(bank, identity)
  if (!Array.isArray(checkpoint.cells) ||
    checkpoint.cells.length !== expected.cells.length ||
    !Array.isArray(checkpoint.events) ||
    !checkpoint.meter) {
    throw new LiveRunError(
      'BAD_CHECKPOINT_SCHEMA',
      'Existing live checkpoint is missing its frozen plan, events, or meter.',
    )
  }
  let sawPending = false
  const expectedEvents = []
  for (let index = 0; index < expected.cells.length; index += 1) {
    const cell = checkpoint.cells[index]
    const planned = expected.cells[index]
    if (!cell ||
      cell.armName !== planned.armName ||
      cell.cellId !== planned.cellId ||
      cell.journeyId !== planned.journeyId ||
      cell.workspace !== planned.workspace ||
      !['completed', 'failed', 'in_progress', 'pending'].includes(cell.status)) {
      throw new LiveRunError(
        'CHECKPOINT_PLAN_MISMATCH',
        'Existing live checkpoint differs from the frozen 34-cell plan.',
      )
    }
    if (cell.status === 'failed' || cell.status === 'in_progress') {
      throw new LiveRunError(
        'TERMINAL_CHECKPOINT',
        'A failed or interrupted cell exists; rerun is forbidden.',
      )
    }
    if (cell.status === 'completed') {
      if (sawPending ||
        cell.resultFile !== join('cells', `${safeCellPath(cell.cellId)}.json`) ||
        !/^[a-f0-9]{64}$/.test(cell.resultSha256 ?? '') ||
        typeof cell.startedAt !== 'string' ||
        typeof cell.completedAt !== 'string') {
        throw new LiveRunError(
          'CHECKPOINT_PLAN_MISMATCH',
          'Completed live cells must be one valid contiguous plan prefix.',
        )
      }
      expectedEvents.push(
        { cellId: cell.cellId, status: 'in_progress' },
        { cellId: cell.cellId, status: 'completed' },
      )
    } else {
      sawPending = true
      if (cell.resultFile !== null || cell.resultSha256 !== null) {
        throw new LiveRunError(
          'CHECKPOINT_PLAN_MISMATCH',
          'Pending live cells cannot carry result metadata.',
        )
      }
    }
  }
  const actualEvents = checkpoint.events.map((event) => {
    if (!event || typeof event.timestamp !== 'string') {
      throw new LiveRunError(
        'BAD_CHECKPOINT_SCHEMA',
        'Checkpoint events must carry durable timestamps.',
      )
    }
    return { cellId: event.cellId, status: event.status }
  })
  if (JSON.stringify(actualEvents) !== JSON.stringify(expectedEvents)) {
    throw new LiveRunError(
      'CHECKPOINT_EVENT_MISMATCH',
      'Checkpoint events differ from its completed cell prefix.',
    )
  }
  return checkpoint
}

async function createFreshCheckpoint(
  bank,
  identity,
  {
    checkpointPath,
    meterJournalPath,
    resultsRoot,
    runDir,
    transcriptDirectory,
  },
) {
  await mkdir(resultsRoot, { mode: 0o700, recursive: true })
  try {
    await mkdir(runDir, { mode: 0o700 })
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new LiveRunError(
        'RUN_ALREADY_STARTED',
        `${identity.runId} already has result artifacts; this one-shot run cannot resume.`,
      )
    }
    throw error
  }
  const checkpoint = buildLiveCheckpoint(bank, identity)
  const handle = await open(checkpointPath, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await atomicWrite(meterJournalPath, '')
  await mkdir(transcriptDirectory, { mode: 0o700 })
  await syncDirectory(runDir)
  await syncDirectory(resultsRoot)
  return checkpoint
}

function addCheckpointEvent(checkpoint, cell, status) {
  checkpoint.events.push({
    cellId: cell.cellId,
    status,
    timestamp: new Date().toISOString(),
  })
}

function sanitizedError(error) {
  return {
    code: error?.code ?? 'LIVE_CELL_FAILURE',
    message: String(error?.message ?? 'Live cell failed.').slice(0, 240),
  }
}

export function validateLiveBankShape(bank) {
  const turns = bank.journeys.reduce(
    (count, journey) => count + journey.sessions.reduce(
      (sessionCount, session) =>
        sessionCount + session.turns.filter((turn) => turn.role === 'user').length,
      0,
    ),
    0,
  )
  const probes = bank.journeys.reduce((count, journey) => count + journey.probes.length, 0)
  const directives = bank.journeys.reduce(
    (count, journey) => count + (journey.directives ?? []).length,
    0,
  )
  if (bank.journeys.length !== 17 || turns !== 22 || probes !== 27 || directives !== 2) {
    throw new LiveRunError(
      'BANK_SHAPE_MISMATCH',
      'Frozen live bank must contain 17 journeys, 22 user turns, 27 probes, and 2 directives.',
    )
  }
  const expectedChatCalls = turns * 2 + probes * 2
  if (expectedChatCalls !== 98) {
    throw new LiveRunError('CALL_PLAN_MISMATCH', 'Frozen bank no longer implies 98 chat calls.')
  }
  if (!Number.isSafeInteger(bank.version) || bank.version < 1) {
    throw new LiveRunError('BANK_VERSION_MISSING', 'Frozen live bank must carry its version.')
  }
  return {
    bankVersion: bank.version,
    directives,
    journeys: bank.journeys.length,
    probes,
    turns,
  }
}

function makeArm(cell, transport, { liveConfig, runDir }) {
  const workspaceDir = join(runDir, cell.workspace)
  if (cell.armName === 'palari-brain-kernel-live') {
    return createKernelLiveArm({
      callChat: transport.callChat,
      liveConfig,
      workspaceDir,
    })
  }
  if (cell.armName === 'mem0-oss-live') {
    return createMem0LiveArm({
      callChat: transport.callChat,
      liveConfig,
      sentinels: transport.sentinels,
      transportBaseURL: transport.baseURL,
      workspaceDir,
    })
  }
  throw new LiveRunError('UNKNOWN_LIVE_ARM', `Unknown live arm ${cell.armName}.`)
}

export async function validateCompletedCellResults(
  checkpoint,
  bank,
  { baseDir = legacyRunDir, requireAll = false } = {},
) {
  const results = []
  for (const cell of checkpoint.cells) {
    if (cell.status !== 'completed' || !cell.resultFile || !cell.resultSha256) {
      if (requireAll) {
        throw new LiveRunError('INCOMPLETE_LIVE_BANK', 'Not every live cell completed.')
      }
      continue
    }
    const journey = bank.journeys.find((entry) => entry.id === cell.journeyId)
    if (!journey) {
      throw new LiveRunError('CELL_RESULT_IDENTITY_MISMATCH', 'Completed cell journey is unknown.')
    }
    let text
    try {
      text = await readFile(join(baseDir, cell.resultFile), 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new LiveRunError(
          'CELL_RESULT_MISSING',
          `Completed cell ${cell.cellId} has no durable result file.`,
        )
      }
      throw error
    }
    if (sha256(text) !== cell.resultSha256) {
      throw new LiveRunError('CELL_RESULT_HASH_MISMATCH', 'A live cell result changed.')
    }
    let result
    try {
      result = JSON.parse(text)
    } catch {
      throw new LiveRunError('CELL_RESULT_BAD_JSON', 'A live cell result is not valid JSON.')
    }
    if (result?.journeyId !== journey.id ||
      result?.category !== journey.category ||
      !Array.isArray(result?.probes) ||
      result.probes.length !== journey.probes.length) {
      throw new LiveRunError(
        'CELL_RESULT_IDENTITY_MISMATCH',
        `Completed cell ${cell.cellId} does not match its frozen journey.`,
      )
    }
    for (let index = 0; index < journey.probes.length; index += 1) {
      const authored = journey.probes[index]
      const observed = result.probes[index]
      if (observed?.probeId !== authored.id ||
        observed?.dimension !== authored.dimension ||
        typeof observed?.pass !== 'boolean') {
        throw new LiveRunError(
          'CELL_RESULT_IDENTITY_MISMATCH',
          `Completed cell ${cell.cellId} has a changed probe plan.`,
        )
      }
    }
    results.push({
      armName: cell.armName,
      result,
    })
  }
  return results
}

function printReport(report, meter, capUsd = LIVE_CAP_USD) {
  for (const arm of report.arms) {
    console.log(`arm: ${arm.name} — ${arm.summary.passedProbes}/${arm.summary.totalProbes} authored probes pass`)
    for (const [dimension, score] of Object.entries(arm.byDimension).sort()) {
      console.log(`  ${dimension}: ${score.passed}/${score.passed + score.failed}`)
    }
    for (const finding of arm.summary.findings) {
      console.log(
        `  FAIL ${finding.journeyId}:${finding.probeId} — ${finding.reasons.join('; ')}`,
      )
    }
  }
  console.log(
    `measured spend: $${meter.measured.usd.toFixed(6)} / $${capUsd.toFixed(2)}`,
  )
  console.log(`conservatively accounted spend: $${meter.accounted.usd.toFixed(6)}`)
  console.log(`provider retries: ${meter.retries.length}`)
  console.log('J3 LIVE RUN COMPLETE — results remain local and unpublished.')
}

export function parseLiveRunArgs(args = []) {
  if (args.length !== 2 || args[0] !== '--run' || typeof args[1] !== 'string') {
    throw new LiveRunError(
      'LIVE_RUN_ID_REQUIRED',
      'Invoke with exactly: node evals/run-bakeoff-live.mjs --run j3-live-vN',
    )
  }
  return args[1]
}

function assertConfiguredBankShape(bankShape, config) {
  for (const field of ['journeys', 'turns', 'probes', 'directives']) {
    if (bankShape[field] !== config.bank[field]) {
      throw new LiveRunError(
        'CONFIG_BANK_SHAPE_MISMATCH',
        `Run config bank.${field} does not match the validated bank.`,
      )
    }
  }
}

async function collectArtifactEntries(root, relativeDir = '') {
  const directory = join(root, relativeDir)
  const entries = await readdir(directory, { withFileTypes: true })
  const artifacts = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = relativeDir ? join(relativeDir, entry.name) : entry.name
    if (relativePath === 'artifact-manifest.json') continue
    if (entry.isDirectory()) {
      artifacts.push(...await collectArtifactEntries(root, relativePath))
      continue
    }
    if (!entry.isFile()) {
      throw new LiveRunError(
        'UNSUPPORTED_RESULT_ARTIFACT',
        `Result artifact ${relativePath} is not a regular file.`,
      )
    }
    const absolutePath = join(root, relativePath)
    const [contents, metadata] = await Promise.all([
      readFile(absolutePath),
      stat(absolutePath),
    ])
    artifacts.push({
      bytes: contents.byteLength,
      mode: (metadata.mode & 0o777).toString(8).padStart(3, '0'),
      path: relativePath,
      sha256: sha256(contents),
    })
  }
  return artifacts
}

export function selectComparableLiveCells(cells, expectedArms = armNames) {
  const completedArmsByJourney = new Map()
  for (const cell of cells) {
    const journeyId = cell?.result?.journeyId
    if (typeof journeyId !== 'string' || !expectedArms.includes(cell?.armName)) {
      throw new LiveRunError(
        'BAD_COMPLETED_CELL',
        'Completed live-cell selection received an unknown arm or journey.',
      )
    }
    const arms = completedArmsByJourney.get(journeyId) ?? new Set()
    arms.add(cell.armName)
    completedArmsByJourney.set(journeyId, arms)
  }
  const pairedJourneyIds = new Set(
    [...completedArmsByJourney]
      .filter(([, arms]) => expectedArms.every((arm) => arms.has(arm)))
      .map(([journeyId]) => journeyId),
  )
  return {
    comparableCells: cells.filter((cell) =>
      pairedJourneyIds.has(cell.result.journeyId)),
    unpairedCompletedCells: cells
      .filter((cell) => !pairedJourneyIds.has(cell.result.journeyId))
      .map((cell) => `${cell.result.journeyId}::${cell.armName}`),
  }
}

async function writeTerminalBundle({
  bank,
  bankShape,
  checkpoint,
  error = null,
  hashes,
  identity,
  liveConfig,
  meter,
  paths,
}) {
  let ledgerAudit
  let transcriptAudit
  try {
    const replay = await reconcileMeterJournal(
      paths.meterJournalPath,
      meter,
      {
        allowTerminalFailure: Boolean(error),
        liveConfig,
      },
    )
    ledgerAudit = {
      accountedUsd: replay.accounted.usd,
      attempts: replay.attempts,
      ok: true,
      sequence: replay.sequence,
    }
  } catch (auditError) {
    if (!error) throw auditError
    ledgerAudit = {
      error: sanitizedError(auditError),
      ok: false,
    }
  }
  try {
    transcriptAudit = {
      ...await verifyLiveTranscriptArtifacts({
        directory: paths.transcriptDirectory,
        journalPath: paths.meterJournalPath,
      }),
      ok: true,
    }
  } catch (auditError) {
    if (!error) throw auditError
    transcriptAudit = {
      error: sanitizedError(auditError),
      ok: false,
    }
  }
  const cells = await validateCompletedCellResults(
    checkpoint,
    bank,
    { baseDir: paths.runDir },
  )
  const { comparableCells, unpairedCompletedCells } =
    selectComparableLiveCells(cells)
  const report = aggregateLiveCells(comparableCells)
  const failure = error ? sanitizedError(error) : null
  const summary = {
    bankShape,
    checkpointEvents: checkpoint.events,
    comparableCompletedCells: comparableCells.length,
    completedCells: cells.length,
    failure,
    hashes,
    integrity: {
      ledger: ledgerAudit,
      transcripts: transcriptAudit,
    },
    meter,
    plannedCells: checkpoint.cells.length,
    report,
    run: identity,
    status: failure ? 'failed' : 'complete',
    totalAccountedUsd: Number(
      (identity.openingAccountedUsd + meter.accounted.usd).toFixed(10),
    ),
    unpairedCompletedCells,
  }
  const summaryText = `${JSON.stringify(summary, null, 2)}\n`
  const markdown = renderLiveReportMarkdown({
    checkpointEvents: checkpoint.events,
    meter,
    report,
    run: identity,
  }) + [
    '',
    '## Terminal state',
    '',
    `- Status: ${summary.status}`,
    `- Completed cells: ${summary.completedCells}/${summary.plannedCells}`,
    `- Comparable paired cells: ${summary.comparableCompletedCells}`,
    `- Unpaired completed cells excluded from scores: ${unpairedCompletedCells.length}`,
    `- Opening accounted spend: $${identity.openingAccountedUsd.toFixed(8)}`,
    `- Combined accounted spend: $${summary.totalAccountedUsd.toFixed(8)}`,
    ...(failure
      ? [`- Failure: \`${failure.code}\` — ${failure.message}`]
      : []),
    '',
  ].join('\n')
  await atomicWrite(paths.runSummaryPath, summaryText)
  await atomicWrite(paths.rawReportPath, summaryText)
  await atomicWrite(paths.markdownReportPath, markdown)
  if (failure) {
    await atomicWriteJson(paths.failurePath, {
      failure,
      runId: identity.runId,
      timestamp: new Date().toISOString(),
    })
  }
  checkpoint.meter = meter
  checkpoint.report = {
    markdown: relative(paths.runDir, paths.markdownReportPath),
    markdownSha256: sha256(markdown),
    raw: relative(paths.runDir, paths.rawReportPath),
    rawSha256: sha256(summaryText),
    summary: relative(paths.runDir, paths.runSummaryPath),
    summarySha256: sha256(summaryText),
  }
  checkpoint.status = failure ? 'failed' : 'complete'
  checkpoint.terminalAt = new Date().toISOString()
  if (!failure) checkpoint.completedAt = checkpoint.terminalAt
  await atomicWriteJson(paths.checkpointPath, checkpoint)

  const artifacts = await collectArtifactEntries(paths.runDir)
  await atomicWriteJson(paths.artifactManifestPath, {
    artifacts,
    excludes: ['artifact-manifest.json'],
    generatedAt: new Date().toISOString(),
    runId: identity.runId,
    schemaVersion: 1,
  })
  return summary
}

export async function main({
  args = process.argv.slice(2),
  env = process.env,
} = {}) {
  const runId = parseLiveRunArgs(args)
  const loaded = await loadLiveRunConfig({ repoRoot, runId })
  const liveConfig = loaded.config
  const paths = {
    artifactManifestPath: join(resultsRoot, runId, 'artifact-manifest.json'),
    checkpointPath: join(resultsRoot, runId, 'checkpoint.json'),
    failurePath: join(resultsRoot, runId, 'failure.json'),
    markdownReportPath: join(resultsRoot, runId, 'report.md'),
    meterJournalPath: join(resultsRoot, runId, 'meter.jsonl'),
    rawReportPath: join(resultsRoot, runId, 'report.json'),
    runDir: join(resultsRoot, runId),
    runSummaryPath: join(resultsRoot, runId, 'run-summary.json'),
    transcriptDirectory: join(resultsRoot, runId, 'transcripts'),
  }
  const [bankText, predictionsText] = await Promise.all([
    readFile(join(repoRoot, ...liveConfig.bank.path.split('/')), 'utf8'),
    readFile(join(repoRoot, ...liveConfig.predictions.path.split('/')), 'utf8'),
  ])
  const hashes = assertFrozenLiveInputs({
    bankText,
    configHash: loaded.configHash,
    liveConfig,
    predictionsText,
  })
  const bank = loadJourneyBank(bankText)
  const bankShape = validateLiveBankShape(bank)
  assertConfiguredBankShape(bankShape, liveConfig)
  const mem0 = await assertInstalledMem0Version()
  hashes.mem0Package = mem0
  const environment = assertLiveEnvironment(env, liveConfig)
  process.env.OPENAI_API_KEY = denyUnmeteredKey
  const repoCommit = assertGitCutPoint({
    requiredFiles: [
      ...requiredTrackedFiles,
      `evals/live-runs/${runId}.json`,
      liveConfig.bank.path,
      liveConfig.predictions.path,
    ],
    runDir: paths.runDir,
  })
  const identity = checkpointIdentity(repoCommit, bank.version, {
    config: liveConfig,
    configHash: loaded.configHash,
  })
  const runLock = await acquireExclusiveRunLock()
  try {
    const checkpoint = await createFreshCheckpoint(bank, identity, {
      checkpointPath: paths.checkpointPath,
      meterJournalPath: paths.meterJournalPath,
      resultsRoot,
      runDir: paths.runDir,
      transcriptDirectory: paths.transcriptDirectory,
    })
    let report = null
    let runError = null
    let transport = null
    try {
      await reconcileMeterJournal(
        paths.meterJournalPath,
        checkpoint.meter,
        { liveConfig },
      )

      process.env.MEM0_DIR = join(paths.runDir, 'mem0-meta')
      transport = await createMeteredOpenAITransport({
        apiKey: environment.apiKey,
        capUsd: environment.capUsd,
        initialState: checkpoint.meter,
        journalPath: paths.meterJournalPath,
        liveConfig,
        transcriptDirectory: paths.transcriptDirectory,
      })
      environment.apiKey = null
      // Any accidental client that bypasses the local proxy receives a deny
      // sentinel. Git subprocesses are separately given a key-free environment.
      process.env.OPENAI_BASE_URL = transport.baseURL
      transport.installNetworkGuard()

      for (const cell of checkpoint.cells) {
        const journey = bank.journeys.find((entry) => entry.id === cell.journeyId)
        const workspaceDir = join(paths.runDir, cell.workspace)
        if (await pathExists(workspaceDir)) {
          throw new LiveRunError(
            'STALE_CELL_WORKSPACE',
            `Pending cell ${cell.cellId} already has a workspace; rerun is unsafe.`,
          )
        }

        cell.status = 'in_progress'
        cell.startedAt = new Date().toISOString()
        addCheckpointEvent(checkpoint, cell, 'in_progress')
        checkpoint.meter = transport.snapshot()
        await atomicWriteJson(paths.checkpointPath, checkpoint)

        try {
          const arm = makeArm(cell, transport, {
            liveConfig,
            runDir: paths.runDir,
          })
          const result = await executeLiveJourney({
            arm,
            cellId: cell.cellId,
            journey,
            liveConfig,
            meter: transport,
          })
          const resultFile = join('cells', `${safeCellPath(cell.cellId)}.json`)
          const resultText = `${JSON.stringify(result, null, 2)}\n`
          await atomicWrite(join(paths.runDir, resultFile), resultText)
          cell.completedAt = new Date().toISOString()
          cell.resultFile = resultFile
          cell.resultSha256 = sha256(resultText)
          cell.status = 'completed'
          delete cell.error
          addCheckpointEvent(checkpoint, cell, 'completed')
          checkpoint.meter = transport.snapshot()
          await atomicWriteJson(paths.checkpointPath, checkpoint)
          console.log(`checkpointed ${cell.cellId}`)
        } catch (error) {
          cell.error = sanitizedError(error)
          cell.failedAt = new Date().toISOString()
          cell.status = 'failed'
          addCheckpointEvent(checkpoint, cell, 'failed')
          checkpoint.meter = transport.snapshot()
          checkpoint.status = 'failed'
          await atomicWriteJson(paths.checkpointPath, checkpoint)
          throw error
        }
      }

      const cells = await validateCompletedCellResults(
        checkpoint,
        bank,
        { baseDir: paths.runDir, requireAll: true },
      )
      report = aggregateLiveCells(cells)
      if (report.arms.length !== 2 ||
        report.arms.some((arm) => arm.summary.totalProbes !== 27)) {
        throw new LiveRunError(
          'LIVE_DENOMINATOR_MISMATCH',
          'Live report must contain exactly 27 authored probes per arm.',
        )
      }
    } catch (error) {
      runError = error
    }

    if (transport) {
      try {
        await transport.close()
      } catch (closeError) {
        const closeFailure = sanitizedError(closeError)
        runError = runError
          ? new LiveRunError(
            'LIVE_RUN_AND_CLOSE_FAILED',
            `${sanitizedError(runError).code}: ${sanitizedError(runError).message} ` +
              `Transport close also failed (${closeFailure.code}: ${closeFailure.message}).`,
            { cause: runError },
          )
          : new LiveRunError(
            'TRANSPORT_CLOSE_FAILED',
            `Meter transport failed to close (${closeFailure.code}: ${closeFailure.message}).`,
            { cause: closeError },
          )
      }
    }

    const meter = transport?.snapshot() ?? checkpoint.meter
    if (runError) {
      await writeTerminalBundle({
        bank,
        bankShape,
        checkpoint,
        error: runError,
        hashes,
        identity,
        liveConfig,
        meter,
        paths,
      })
      throw runError
    }

    let summary
    try {
      summary = await writeTerminalBundle({
        bank,
        bankShape,
        checkpoint,
        hashes,
        identity,
        liveConfig,
        meter,
        paths,
      })
    } catch (error) {
      await writeTerminalBundle({
        bank,
        bankShape,
        checkpoint,
        error,
        hashes,
        identity,
        liveConfig,
        meter,
        paths,
      })
      throw error
    }
    printReport(report, meter, liveConfig.budget.cumulativeCapUsd)
    return summary
  } finally {
    await runLock.release()
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const code = error?.code ?? 'J3_LIVE_FAILED'
    console.error(`${code}: ${error?.message ?? 'J3 live run failed.'}`)
    process.exitCode = 1
  })
}
