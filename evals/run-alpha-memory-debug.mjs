import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const DEFAULT_LOG_PATH = '.palari-alpha/memory-debug.jsonl'
const DEFAULT_BUDGET_PATH = '.palari-alpha/budget.json'
const BUDGET_SCHEMA = 'palari-alpha-budget/v1'
const STAGES = ['writer', 'embedder', 'reranker', 'answer']

function finiteNonnegative(value, label) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a finite nonnegative number.`)
  }
  return parsed
}

function normalizeDependency(dependency, name, required) {
  if (dependency == null && !required) return null
  if (typeof dependency === 'function') {
    return { invoke: dependency, maxCostUsd: 0 }
  }
  if (!dependency || typeof dependency.invoke !== 'function') {
    throw new Error(`${name} dependency must be a function or { invoke, maxCostUsd }.`)
  }
  return {
    invoke: dependency.invoke,
    maxCostUsd: finiteNonnegative(dependency.maxCostUsd ?? 0, `${name}.maxCostUsd`),
  }
}

function normalizeResult(result, reservedUsd, name) {
  const wrapped = result && typeof result === 'object' &&
    Object.hasOwn(result, 'output')
    ? result
    : { output: result, costUsd: 0 }
  const costUsd = finiteNonnegative(wrapped.costUsd ?? 0, `${name}.costUsd`)
  if (costUsd > reservedUsd + Number.EPSILON) {
    throw new Error(`${name} reported $${costUsd} after reserving only $${reservedUsd}.`)
  }
  return { output: wrapped.output, costUsd }
}

export function resolveAlphaFilePath(candidate, label = 'logPath') {
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    throw new Error(`${label} must be a non-empty path.`)
  }
  const root = path.resolve(process.cwd(), '.palari-alpha')
  const absolute = path.resolve(process.cwd(), candidate)
  if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} must stay inside ${root}.`)
  }
  return absolute
}

async function readBudgetState(absolute) {
  try {
    const state = JSON.parse(await readFile(absolute, 'utf8'))
    if (state?.schema !== BUDGET_SCHEMA) throw new Error('budget state has an unknown schema.')
    return finiteNonnegative(state.accountedUsd, 'budget accountedUsd')
  } catch (error) {
    if (error?.code === 'ENOENT') return 0
    if (error instanceof SyntaxError) throw new Error('budget state is not valid JSON.')
    throw error
  }
}

async function writeBudgetState(absolute, accountedUsd) {
  await mkdir(path.dirname(absolute), { recursive: true })
  const temporary = `${absolute}.tmp-${process.pid}`
  await writeFile(temporary, `${JSON.stringify({ schema: BUDGET_SCHEMA, accountedUsd })}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  await rename(temporary, absolute)
}

export function createFileBudgetStore(budgetPath = DEFAULT_BUDGET_PATH) {
  const absolute = resolveAlphaFilePath(budgetPath, 'budgetPath')
  return {
    async load() {
      return readBudgetState(absolute)
    },
    async reserve(amountUsd, capUsd) {
      const current = await readBudgetState(absolute)
      if (current + amountUsd > capUsd + Number.EPSILON) return null
      const accountedUsd = current + amountUsd
      await writeBudgetState(absolute, accountedUsd)
      return accountedUsd
    },
    async settle(reservedUsd, actualUsd) {
      const current = await readBudgetState(absolute)
      if (current + Number.EPSILON < reservedUsd) {
        throw new Error('budget state is smaller than the active reservation.')
      }
      const accountedUsd = Math.max(0, current - reservedUsd + actualUsd)
      await writeBudgetState(absolute, accountedUsd)
      return accountedUsd
    },
  }
}

function createMemoryBudgetStore() {
  let accountedUsd = 0
  return {
    async load() { return accountedUsd },
    async reserve(amountUsd, capUsd) {
      if (accountedUsd + amountUsd > capUsd + Number.EPSILON) return null
      accountedUsd += amountUsd
      return accountedUsd
    },
    async settle(reservedUsd, actualUsd) {
      accountedUsd = Math.max(0, accountedUsd - reservedUsd + actualUsd)
      return accountedUsd
    },
  }
}

export function selectAlphaQuestions(questions, selection) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('questions must be a non-empty array.')
  }
  const normalized = questions.map((question, index) => {
    if (!question || typeof question !== 'object') {
      throw new Error(`question ${index + 1} must be an object.`)
    }
    const id = String(question.id ?? '').trim()
    if (!id) throw new Error(`question ${index + 1} requires id.`)
    return { ...question, id, ordinal: index + 1 }
  })
  if (selection == null || selection === '' || selection === 'all') return normalized

  const wanted = new Set()
  for (const token of String(selection).split(',').map((part) => part.trim()).filter(Boolean)) {
    const range = token.match(/^(\d+)-(\d+)$/)
    if (range) {
      const first = Number(range[1])
      const last = Number(range[2])
      if (first < 1 || last < first || last > normalized.length) {
        throw new Error(`question range ${token} is outside 1-${normalized.length}.`)
      }
      for (let ordinal = first; ordinal <= last; ordinal += 1) wanted.add(`ordinal:${ordinal}`)
    } else if (/^\d+$/.test(token)) {
      const ordinal = Number(token)
      if (ordinal < 1 || ordinal > normalized.length) {
        throw new Error(`question ordinal ${token} is outside 1-${normalized.length}.`)
      }
      wanted.add(`ordinal:${ordinal}`)
    } else {
      wanted.add(`id:${token}`)
    }
  }

  const selected = normalized.filter((question) =>
    wanted.has(`ordinal:${question.ordinal}`) || wanted.has(`id:${question.id}`))
  const found = new Set(selected.flatMap((question) => [
    `ordinal:${question.ordinal}`,
    `id:${question.id}`,
  ]))
  const missing = [...wanted].filter((key) => !found.has(key))
  if (missing.length > 0) throw new Error(`unknown question selection: ${missing.join(', ')}`)
  return selected
}

function defaultClock() {
  return new Date().toISOString()
}

function safeError(error) {
  return {
    name: String(error?.name ?? 'Error'),
    message: String(error?.message ?? error),
  }
}

export async function runAlphaMemoryDebug({
  questions,
  dependencies,
  selection = 'all',
  maxRetries = 0,
  continueOnError = true,
  maxDollar = 0,
  logPath = DEFAULT_LOG_PATH,
  appendLog,
  budgetStore = createMemoryBudgetStore(),
  clock = defaultClock,
  runId = `alpha-${Date.now()}`,
} = {}) {
  const capUsd = finiteNonnegative(maxDollar, 'maxDollar')
  const retries = Number(maxRetries)
  if (!Number.isSafeInteger(retries) || retries < 0 || retries > 3) {
    throw new Error('maxRetries must be an integer from 0 through 3.')
  }
  if (!dependencies || typeof dependencies !== 'object') {
    throw new Error('dependencies are required.')
  }
  const stages = {
    writer: normalizeDependency(dependencies.writer, 'writer', true),
    embedder: normalizeDependency(dependencies.embedder, 'embedder', false),
    reranker: normalizeDependency(dependencies.reranker, 'reranker', false),
    answer: normalizeDependency(dependencies.answer, 'answer', true),
  }
  const selected = selectAlphaQuestions(questions, selection)
  const writeLog = appendLog ?? (async (record) => {
    const absolute = resolveAlphaFilePath(logPath)
    await mkdir(path.dirname(absolute), { recursive: true })
    await appendFile(absolute, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 })
  })

  if (!budgetStore || typeof budgetStore.load !== 'function' ||
      typeof budgetStore.reserve !== 'function' || typeof budgetStore.settle !== 'function') {
    throw new Error('budgetStore must provide load, reserve, and settle.')
  }
  const openingAccountedUsd = finiteNonnegative(await budgetStore.load(), 'opening accounted spend')
  if (openingAccountedUsd > capUsd + Number.EPSILON) {
    throw new Error(`maxDollar $${capUsd} is below prior accounted spend $${openingAccountedUsd}.`)
  }
  let spentUsd = openingAccountedUsd
  const results = []
  let stoppedForBudget = false
  const emit = async (record) => writeLog({
    schema: 'palari-alpha-debug/v1',
    mode: 'diagnostic-not-a-benchmark',
    runId,
    at: clock(),
    ...record,
  })

  await emit({
    type: 'run-start', selected: selected.map(({ id }) => id), capUsd,
    openingAccountedUsd, maxRetries: retries,
  })

  questionLoop: for (const question of selected) {
    for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
      const stageOutputs = {}
      await emit({ type: 'attempt-start', questionId: question.id, ordinal: question.ordinal, attempt })
      try {
        for (const name of STAGES) {
          const dependency = stages[name]
          if (!dependency) continue
          const reservedAccountedUsd = await budgetStore.reserve(dependency.maxCostUsd, capUsd)
          if (reservedAccountedUsd == null) {
            stoppedForBudget = true
            const budget = {
              type: 'budget-stop', questionId: question.id, ordinal: question.ordinal,
              attempt, stage: name, spentUsd, requiredReservationUsd: dependency.maxCostUsd, capUsd,
            }
            await emit(budget)
            results.push({ id: question.id, ordinal: question.ordinal, status: 'budget-stopped', attempts: attempt })
            break questionLoop
          }
          spentUsd = finiteNonnegative(reservedAccountedUsd, 'reserved accounted spend')
          let settled
          try {
            const raw = await dependency.invoke({
              question,
              attempt,
              stageOutputs: { ...stageOutputs },
            })
            settled = normalizeResult(raw, dependency.maxCostUsd, name)
          } catch (error) {
            // The reservation was persisted before dispatch. A failed or
            // interrupted transport keeps the full conservative amount.
            throw error
          }
          spentUsd = finiteNonnegative(
            await budgetStore.settle(dependency.maxCostUsd, settled.costUsd),
            'settled accounted spend',
          )
          stageOutputs[name] = settled.output
          await emit({
            type: 'stage-complete', questionId: question.id, ordinal: question.ordinal,
            attempt, stage: name, costUsd: settled.costUsd, spentUsd,
          })
        }
        results.push({
          id: question.id,
          ordinal: question.ordinal,
          status: 'completed',
          attempts: attempt,
          output: stageOutputs.answer,
          stageOutputs,
        })
        await emit({ type: 'attempt-complete', questionId: question.id, ordinal: question.ordinal, attempt })
        continue questionLoop
      } catch (error) {
        await emit({
          type: 'attempt-error', questionId: question.id, ordinal: question.ordinal,
          attempt, error: safeError(error), spentUsd,
        })
        if (attempt <= retries) continue
        results.push({ id: question.id, ordinal: question.ordinal, status: 'failed', attempts: attempt, error: safeError(error) })
        if (!continueOnError) break questionLoop
      }
    }
  }

  const summary = {
    runId,
    mode: 'diagnostic-not-a-benchmark',
    selected: selected.length,
    completed: results.filter(({ status }) => status === 'completed').length,
    failed: results.filter(({ status }) => status === 'failed').length,
    stoppedForBudget,
    openingAccountedUsd,
    freshAccountedUsd: spentUsd - openingAccountedUsd,
    spentUsd,
    capUsd,
    results,
  }
  await emit({
    type: 'run-complete', selected: summary.selected, completed: summary.completed,
    failed: summary.failed, stoppedForBudget, spentUsd, capUsd,
  })
  return summary
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (!flag.startsWith('--')) throw new Error(`unexpected argument: ${flag}`)
    if (flag === '--stop-on-error') {
      options.continueOnError = false
      continue
    }
    const value = argv[index + 1]
    if (value == null || value.startsWith('--')) throw new Error(`${flag} requires a value.`)
    index += 1
    if (flag === '--adapter') options.adapter = value
    else if (flag === '--questions') options.selection = value
    else if (flag === '--retries') options.maxRetries = Number(value)
    else if (flag === '--max-dollar') options.maxDollar = Number(value)
    else if (flag === '--log') options.logPath = value
    else throw new Error(`unknown option: ${flag}`)
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!options.adapter) {
    throw new Error('Use --adapter <module>; the module must export createAlphaRun().')
  }
  if (options.maxDollar == null) {
    throw new Error('--max-dollar is required for an alpha debug run.')
  }
  const adapterUrl = pathToFileURL(path.resolve(options.adapter)).href
  const adapter = await import(adapterUrl)
  if (typeof adapter.createAlphaRun !== 'function') {
    throw new Error('The adapter module must export createAlphaRun().')
  }
  const injected = await adapter.createAlphaRun()
  const summary = await runAlphaMemoryDebug({
    ...injected,
    ...options,
    appendLog: undefined,
    budgetStore: createFileBudgetStore(),
  })
  process.stdout.write(`${JSON.stringify({
    mode: summary.mode,
    selected: summary.selected,
    completed: summary.completed,
    failed: summary.failed,
    stoppedForBudget: summary.stoppedForBudget,
    openingAccountedUsd: summary.openingAccountedUsd,
    freshAccountedUsd: summary.freshAccountedUsd,
    spentUsd: summary.spentUsd,
    capUsd: summary.capUsd,
  }, null, 2)}\n`)
  if (summary.failed > 0 || summary.stoppedForBudget) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
