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
  rename,
  unlink,
} from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createKernelLiveArm } from './arms/kernel-live-arm.mjs'
import { createMem0LiveArm } from './arms/mem0-live-arm.mjs'
import { loadJourneyBank } from './journey-bank.mjs'
import {
  LIVE_BANK_SHA256,
  LIVE_CAP_USD,
  LIVE_CONFIG_SHA256,
  LIVE_MODEL,
  LIVE_PREDICTIONS_SHA256,
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
const runDir = join(resultsRoot, 'j3-live-v1')
const checkpointPath = join(runDir, 'checkpoint.json')
const meterJournalPath = join(runDir, 'meter.jsonl')
const rawReportPath = join(runDir, 'report.json')
const markdownReportPath = join(runDir, 'report.md')
const runLockPath = join(resultsRoot, 'j3-live-v1.lock')
const runDate = '2026-07-23'
const denyUnmeteredKey = 'palari-deny-unmetered-openai'
const armNames = ['palari-brain-kernel-live', 'mem0-oss-live']
const requiredTrackedFiles = [
  'evals/arms/kernel-live-arm.mjs',
  'evals/arms/mem0-live-arm.mjs',
  'evals/live-runtime.mjs',
  'evals/run-bakeoff-live.mjs',
  'tests/live-bakeoff.contract.test.mjs',
]

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

function assertGitCutPoint() {
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
  for (const path of requiredTrackedFiles) {
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

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
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

function checkpointIdentity(repoCommit, bankVersion) {
  return {
    bankSha256: LIVE_BANK_SHA256,
    bankVersion,
    capUsd: LIVE_CAP_USD,
    configSha256: LIVE_CONFIG_SHA256,
    model: LIVE_MODEL,
    predictionsSha256: LIVE_PREDICTIONS_SHA256,
    repoCommit,
    runDate,
    version: 1,
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

async function createOrLoadCheckpoint(bank, identity) {
  await mkdir(runDir, { recursive: true })
  if (!(await pathExists(checkpointPath))) {
    const checkpoint = buildLiveCheckpoint(bank, identity)
    const handle = await open(checkpointPath, 'wx', 0o600)
    try {
      await handle.writeFile(`${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await syncDirectory(runDir)
    await syncDirectory(resultsRoot)
    return checkpoint
  }
  const checkpoint = await readJson(checkpointPath)
  return assertCheckpointResumable(checkpoint, identity, bank)
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

function makeArm(cell, transport) {
  const workspaceDir = join(runDir, cell.workspace)
  if (cell.armName === 'palari-brain-kernel-live') {
    return createKernelLiveArm({
      callChat: transport.callChat,
      workspaceDir,
    })
  }
  if (cell.armName === 'mem0-oss-live') {
    return createMem0LiveArm({
      callChat: transport.callChat,
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
  { baseDir = runDir, requireAll = false } = {},
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

function printReport(report, meter) {
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
    `measured spend: $${meter.measured.usd.toFixed(6)} / $${LIVE_CAP_USD.toFixed(2)}`,
  )
  console.log(`conservatively accounted spend: $${meter.accounted.usd.toFixed(6)}`)
  console.log(`provider retries: ${meter.retries.length}`)
  console.log('J3 LIVE RUN COMPLETE — results remain local and unpublished.')
}

export async function main() {
  const [bankText, predictionsText] = await Promise.all([
    readFile(join(here, 'journeys.json'), 'utf8'),
    readFile(join(here, 'predictions-bakeoff.md'), 'utf8'),
  ])
  const hashes = assertFrozenLiveInputs({ bankText, predictionsText })
  const bank = loadJourneyBank(bankText)
  const bankShape = validateLiveBankShape(bank)
  const environment = assertLiveEnvironment(process.env)
  process.env.OPENAI_API_KEY = denyUnmeteredKey
  const repoCommit = assertGitCutPoint()
  const identity = checkpointIdentity(repoCommit, bank.version)
  const runLock = await acquireExclusiveRunLock()
  try {
  const checkpoint = await createOrLoadCheckpoint(bank, identity)
  await reconcileMeterJournal(meterJournalPath, checkpoint.meter)
  await validateCompletedCellResults(checkpoint, bank)

  process.env.MEM0_DIR = join(runDir, 'mem0-meta')
  const transport = await createMeteredOpenAITransport({
    apiKey: environment.apiKey,
    capUsd: environment.capUsd,
    initialState: checkpoint.meter,
    journalPath: meterJournalPath,
  })
  environment.apiKey = null
  // Any accidental client that bypasses the local proxy receives a deny
  // sentinel. Git subprocesses are separately given a key-free environment.
  process.env.OPENAI_BASE_URL = transport.baseURL
  transport.installNetworkGuard()

  try {
    for (const cell of checkpoint.cells) {
      if (cell.status === 'completed') continue
      const journey = bank.journeys.find((entry) => entry.id === cell.journeyId)
      const workspaceDir = join(runDir, cell.workspace)
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
      await atomicWriteJson(checkpointPath, checkpoint)

      try {
        const arm = makeArm(cell, transport)
        const result = await executeLiveJourney({
          arm,
          cellId: cell.cellId,
          journey,
          meter: transport,
        })
        const resultFile = join('cells', `${safeCellPath(cell.cellId)}.json`)
        const resultText = `${JSON.stringify(result, null, 2)}\n`
        await atomicWrite(join(runDir, resultFile), resultText)
        cell.completedAt = new Date().toISOString()
        cell.resultFile = resultFile
        cell.resultSha256 = sha256(resultText)
        cell.status = 'completed'
        delete cell.error
        addCheckpointEvent(checkpoint, cell, 'completed')
        checkpoint.meter = transport.snapshot()
        await atomicWriteJson(checkpointPath, checkpoint)
        console.log(`checkpointed ${cell.cellId}`)
      } catch (error) {
        cell.error = sanitizedError(error)
        cell.failedAt = new Date().toISOString()
        cell.status = 'failed'
        addCheckpointEvent(checkpoint, cell, 'failed')
        checkpoint.meter = transport.snapshot()
        checkpoint.status = 'failed'
        await atomicWriteJson(checkpointPath, checkpoint)
        throw error
      }
    }

    const cells = await validateCompletedCellResults(
      checkpoint,
      bank,
      { requireAll: true },
    )
    const report = aggregateLiveCells(cells)
    if (report.arms.length !== 2 ||
      report.arms.some((arm) => arm.summary.totalProbes !== 27)) {
      throw new LiveRunError(
        'LIVE_DENOMINATOR_MISMATCH',
        'Live report must contain exactly 27 authored probes per arm.',
      )
    }
    const meter = transport.snapshot()
    const raw = {
      bankShape,
      checkpointEvents: checkpoint.events,
      hashes,
      meter,
      report,
      run: identity,
    }
    const rawText = `${JSON.stringify(raw, null, 2)}\n`
    const markdown = renderLiveReportMarkdown({
      checkpointEvents: checkpoint.events,
      meter,
      report,
      run: identity,
    })
    await atomicWrite(rawReportPath, rawText)
    await atomicWrite(markdownReportPath, markdown)
    checkpoint.meter = meter
    checkpoint.report = {
      markdown: relative(runDir, markdownReportPath),
      markdownSha256: sha256(markdown),
      raw: relative(runDir, rawReportPath),
      rawSha256: sha256(rawText),
    }
    checkpoint.status = 'complete'
    checkpoint.completedAt = new Date().toISOString()
    await atomicWriteJson(checkpointPath, checkpoint)
    printReport(report, meter)
    return raw
  } finally {
    await transport.close()
  }
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
