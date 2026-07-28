#!/usr/bin/env node
// CLI for the five-case trust benchmark. Offline, deterministic, no spend.
//
//   npm run trust-bench                       # Palari's own adapter
//   npm run trust-bench -- --adapter ./my-adapter.mjs
//
// An external adapter module must export createTrustAdapter() returning the
// interface documented in evals/trust-benchmark.mjs. Predictions for every
// framework live in evals/predictions.md (P-set 5) and were registered
// before this harness first ran.

import { pathToFileURL } from 'node:url'

import { runTrustBenchmark } from './trust-benchmark.mjs'
import { createPalariTrustAdapter } from './arms/palari-trust-adapter.mjs'

export function parseTrustBenchmarkArgs(argv = []) {
  const options = { adapter: null }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--adapter') {
      const value = argv[index + 1]
      if (!value) throw new TypeError('--adapter requires a module path.')
      options.adapter = value
      index += 1
      continue
    }
    throw new TypeError(`Unknown trust-benchmark flag: ${argv[index]}`)
  }
  return options
}

async function resolveAdapter(options) {
  if (!options.adapter) return createPalariTrustAdapter()
  const module = await import(pathToFileURL(options.adapter).href)
  if (typeof module.createTrustAdapter !== 'function') {
    throw new TypeError(
      'An external adapter module must export createTrustAdapter().',
    )
  }
  return module.createTrustAdapter()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseTrustBenchmarkArgs(process.argv.slice(2))
    const report = await runTrustBenchmark(await resolveAdapter(options))
    console.log(`trust benchmark ${report.version} — ${report.adapter}`)
    for (const result of report.results) {
      console.log(
        `  ${result.pass ? 'PASS' : 'FAIL'}  ${result.title} — ${result.detail}`,
      )
    }
    console.log(`${report.passed}/${report.total} cases passed.`)
    process.exitCode = report.passed === report.total ? 0 : 1
  } catch (error) {
    console.error(`TRUST_BENCH_FAILED: ${error?.message ?? error}`)
    process.exitCode = 1
  }
}
