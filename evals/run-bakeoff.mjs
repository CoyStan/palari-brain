// Dry bake-off runner: every registered arm against the full journey
// bank, offline, deterministic, no keys. Live arms are J3 (FOUNDER
// GATE) and are not registered here.
//
// Run:  npm run bakeoff        (exit 0 iff every non-known-finding
//                               probe passes on the reference arm)

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

import { loadJourneyBankFile } from './journey-bank.mjs'
import { runBank, renderReportLines } from './harness.mjs'
import { renderReportMarkdown } from './report-markdown.mjs'
import { createKernelArm } from './arms/kernel-arm.mjs'
import { createUngovernedArm } from './arms/ungoverned-arm.mjs'
import { createV05ParityArm } from './arms/v05-parity-arm.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const bank = await loadJourneyBankFile(join(here, 'journeys.json'))
const arms = [createKernelArm(), createUngovernedArm(), createV05ParityArm()]

const report = await runBank(arms, bank)
for (const line of renderReportLines(report)) console.log(line)
const resultsDir = join(here, 'results')
await mkdir(resultsDir, { recursive: true })
await writeFile(
  join(resultsDir, 'bakeoff-dry-report.md'),
  renderReportMarkdown(report),
  'utf8',
)

const reference = report.arms[0]
const unexpected = reference.summary.findings.filter((f) => !f.knownFinding)
if (unexpected.length > 0) {
  console.error(`\nUNEXPECTED FAILURES on ${reference.name}: ${unexpected.length}`)
  process.exit(1)
}
console.log(`\nBAKEOFF DRY RUN COMPLETE: ${report.arms.length} arm(s), ${bank.journeys.length} journeys, reference arm has ${reference.summary.findings.length} known finding(s) and 0 unexpected failures.`)
