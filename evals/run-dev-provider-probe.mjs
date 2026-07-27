#!/usr/bin/env node
// CLI for the ungated development probe. See `evals/dev-provider-probe.mjs`
// for what this is and, more importantly, what it is not.
//
//   PALARI_PROBE_CONFIRM_SPEND=1 npm run probe -- --attempts 3
//
// Produces no score, writes nothing under `evals/results/`, and has no run
// identity. Spending is still founder-gated by PALARI_PROBE_CONFIRM_SPEND.

import { runDevProviderProbe } from './dev-provider-probe.mjs'

export function parseDevProbeArgs(argv = []) {
  const options = { attempts: 1, maxRepairs: 1 }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--attempts' || flag === '--repairs') {
      const value = Number(argv[index + 1])
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new TypeError(`${flag} requires a non-negative integer.`)
      }
      if (flag === '--attempts') options.attempts = value
      else options.maxRepairs = value
      index += 1
      continue
    }
    throw new TypeError(`Unknown probe flag: ${flag}`)
  }
  return options
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const summary = await runDevProviderProbe(
      parseDevProbeArgs(process.argv.slice(2)),
    )
    process.exitCode = summary.rejected ? 1 : 0
  } catch (error) {
    console.error(`${error?.code ?? 'PROBE_FAILED'}: ${error?.message ?? error}`)
    process.exitCode = 1
  }
}
