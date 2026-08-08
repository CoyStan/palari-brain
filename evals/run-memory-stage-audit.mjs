#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  buildMemoryStageAudit,
} from './memory-stage-audit.mjs'

function parseArgs(argv) {
  const options = { inputPath: '', reportPath: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--input') {
      options.inputPath = String(argv[index + 1] ?? '')
      index += 1
      continue
    }
    if (flag === '--report') {
      options.reportPath = String(argv[index + 1] ?? '')
      index += 1
      continue
    }
    throw new TypeError(`Unknown memory-stage audit flag: ${flag}`)
  }
  if (!options.inputPath) throw new TypeError('--input requires a path.')
  return options
}

function inputCases(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object' && Array.isArray(value.cases)) {
    return value.cases
  }
  throw new TypeError('Audit input must be an array or an object with cases.')
}

export async function runMemoryStageAudit({
  inputPath,
  reportPath = '',
  repoRoot = process.cwd(),
} = {}) {
  if (!inputPath) throw new TypeError('inputPath is required.')
  const input = JSON.parse(
    await readFile(resolve(repoRoot, inputPath), 'utf8'),
  )
  const report = buildMemoryStageAudit(inputCases(input))
  if (reportPath) {
    const absoluteReport = resolve(repoRoot, reportPath)
    await mkdir(dirname(absoluteReport), { recursive: true })
    await writeFile(
      absoluteReport,
      `${JSON.stringify(report, null, 2)}\n`,
      { mode: 0o600 },
    )
  }
  return report
}

const isMain = process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  try {
    const report = await runMemoryStageAudit(
      parseArgs(process.argv.slice(2)),
    )
    console.log(JSON.stringify({
      caseCount: report.caseCount,
      counts: report.counts,
      mode: report.mode,
      networkCalls: report.networkCalls,
      providerCalls: report.providerCalls,
    }, null, 2))
  } catch (error) {
    console.error(error?.stack ?? error)
    process.exitCode = 1
  }
}
