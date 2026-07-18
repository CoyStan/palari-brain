#!/usr/bin/env node
// U8 live-slice runner — PREPARED BY THE AGENT, EXECUTED BY THE FOUNDER.
// FOUNDER GATE (charter): any live provider call is the founder's
// decision. This script makes the gate mechanical:
//   --plan (default)  spend-free: select the 10-question slice, print
//                     counts, cost table, dataset sha256, and the
//                     slice ids to pin into evals/predictions.md.
//   --dry             spend-free: run the full path on the real slice
//                     with the deterministic mock extractor and stub
//                     provider (plumbing check, zero tokens).
//   --live            requires PALARI_CONFIRM_SPEND=1 AND a provider
//                     key in env AND evals/predictions.md containing
//                     "PREDICTIONS FINAL" — pre-registration is
//                     enforced in code, not by promise.
// Results land in evals/results/ with provenance: dataset sha256,
// model, prompt-config hash, date. No key is ever logged or stored.
//
// Dataset (license MIT — verdict in docs/DECISIONS.md): place at
//   data/longmemeval_s_cleaned.json   (or pass --data <path>)
// from https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned
// — data/ is gitignored; never commit it.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { promptConfigHash } from '../src/eval-prompt-config.mjs'
import { loadLongMemEvalInstances } from '../src/longmemeval.mjs'
import {
  assertLiveRunAllowed,
  candidateModels,
  estimateSliceCostUSD,
  estimateSliceTokens,
  selectSlice,
} from '../src/slice.mjs'
import { createKernelStore } from '../src/store.mjs'
import { createGatedStore } from '../src/gate.mjs'
import { answerQuestion, ingestLongMemEvalInstance, stubProvider } from '../src/adapter.mjs'
import { buildMemoryExtractionRequest, deterministicMockMemoryExtraction } from '../src/memory-extraction.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const mode = args.includes('--live') ? 'live' : args.includes('--dry') ? 'dry' : 'plan'
const dataPath = args.includes('--data')
  ? args[args.indexOf('--data') + 1]
  : join(repoRoot, 'data', 'longmemeval_s_cleaned.json')

async function loadDataset() {
  let raw
  try {
    raw = await readFile(dataPath, 'utf8')
  } catch {
    console.error(`Dataset not found at ${dataPath}.`)
    console.error('Download (MIT, verdict in docs/DECISIONS.md) from:')
    console.error('  https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned')
    console.error('and place the file there, or pass --data <path>. data/ is gitignored.')
    process.exit(2)
  }
  const sha256 = createHash('sha256').update(raw).digest('hex')
  return { instances: loadLongMemEvalInstances(raw), sha256 }
}

async function openWorkspace(workspaceId) {
  const root = join(repoRoot, 'data', 'run-workspaces')
  await mkdir(root, { recursive: true })
  const store = await createKernelStore({
    memoryEnabled: true,
    statePath: join(root, `${workspaceId}-state.json`),
    workspaceId,
  })
  return { gated: createGatedStore(store), store }
}

const { instances, sha256 } = await loadDataset()
const slice = selectSlice(instances, { size: 10 })
const tokens = estimateSliceTokens(slice)

if (mode === 'plan') {
  console.log(`Dataset: ${dataPath}`)
  console.log(`Dataset sha256: ${sha256}`)
  console.log(`Prompt-config hash: ${promptConfigHash()}`)
  console.log(`\nSlice (${slice.length} questions) — pin these ids into evals/predictions.md:`)
  for (const q of slice) {
    const sess = q.sessions.length
    const turns = q.sessions.reduce((n, s) => n + s.turns.filter((t) => t.role === 'user').length, 0)
    console.log(`  ${q.questionId}  [${q.questionType}${q.isAbstention ? ', abstention' : ''}]  sessions=${sess} userTurns=${turns}`)
  }
  console.log(`\nTotals: sessions=${tokens.sessions} userTurns=${tokens.userTurns} historyChars=${tokens.historyChars}`)
  console.log('\nCost estimates (re-verify prices at spend time):')
  for (const model of candidateModels) {
    const cost = estimateSliceCostUSD(tokens, model)
    console.log(`  ${model.model.padEnd(24)} ~$${cost.usd.toFixed(2)}  (${(cost.inputTokens / 1e6).toFixed(2)}M in / ${(cost.outputTokens / 1e6).toFixed(2)}M out)  ${model.notes}`)
  }
  console.log('\nNext: founder reviews docs/U8-PREP.md, finalizes evals/predictions.md, sets the gate env vars, runs --live.')
  process.exit(0)
}

if (mode === 'dry') {
  console.log('DRY RUN — zero provider calls, deterministic mock extractor + stub provider.')
  const results = []
  for (const q of slice) {
    const { gated, store } = await openWorkspace(`dry-${q.questionId}`)
    const stats = await ingestLongMemEvalInstance(gated, q, {
      extractor: deterministicMockMemoryExtraction,
      extractorId: 'deterministic-mock',
      palariId: 'palari-eval',
      userId: 'user-eval',
    })
    const answer = await answerQuestion(gated, {
      palariId: 'palari-eval',
      provider: stubProvider,
      question: q.question,
      questionDate: q.questionDate,
      userId: 'user-eval',
    })
    results.push({ abstained: answer.abstained, answer: answer.answer.slice(0, 200), ingested: stats.memoriesWritten, questionId: q.questionId, questionType: q.questionType })
    console.log(`  ${q.questionId}: ingested=${stats.memoriesWritten} abstained=${answer.abstained}`)
    store.close()
  }
  console.log(`\nDry run complete over ${results.length} questions. This validates plumbing only — it says nothing about answer quality.`)
  process.exit(0)
}

// ---- live ----
const { provider: providerName } = assertLiveRunAllowed(process.env)
const predictions = await readFile(join(repoRoot, 'evals', 'predictions.md'), 'utf8').catch(() => '')
if (!predictions.includes('PREDICTIONS FINAL')) {
  console.error('FOUNDER GATE: evals/predictions.md must contain "PREDICTIONS FINAL" (with the slice ids pinned) BEFORE any live scoring run. Pre-registration is the law.')
  process.exit(3)
}
const model = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'gemini-2.5-flash-lite'

async function geminiCall(body) {
  const key = process.env.GEMINI_API_KEY
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
}

if (providerName !== 'gemini') {
  console.error('Anthropic runner not wired yet — the extraction request format is Gemini-native. Translating it is a follow-up once the founder picks the provider. Refusing rather than improvising.')
  process.exit(4)
}

const liveExtractor = async ({ turn }) => geminiCall(buildMemoryExtractionRequest({ turn }))
const liveProvider = async ({ prompt }) => ({
  text: await geminiCall({ contents: [{ parts: [{ text: prompt }], role: 'user' }] }),
})

const runStamp = new Date().toISOString()
const results = []
for (const q of slice) {
  const { gated, store } = await openWorkspace(`live-${q.questionId}`)
  const stats = await ingestLongMemEvalInstance(gated, q, {
    extractor: liveExtractor,
    extractorId: `live-${model}`,
    palariId: 'palari-eval',
    userId: 'user-eval',
  })
  const answer = await answerQuestion(gated, {
    palariId: 'palari-eval',
    provider: liveProvider,
    question: q.question,
    questionDate: q.questionDate,
    userId: 'user-eval',
  })
  results.push({
    abstained: answer.abstained,
    answer: answer.answer,
    expectedAnswer: q.answer,
    ingested: stats.memoriesWritten,
    questionId: q.questionId,
    questionType: q.questionType,
    totalCandidates: answer.totalCandidates,
  })
  console.log(`  ${q.questionId}: ingested=${stats.memoriesWritten} abstained=${answer.abstained}`)
  store.close()
}
const outDir = join(repoRoot, 'evals', 'results')
await mkdir(outDir, { recursive: true })
const outPath = join(outDir, `slice-${runStamp.slice(0, 10)}-${model}.json`)
await writeFile(outPath, JSON.stringify({
  datasetSha256: sha256,
  date: runStamp,
  model,
  promptConfigHash: promptConfigHash(),
  results,
  sliceIds: slice.map((q) => q.questionId),
}, null, 2))
console.log(`\nLive slice complete. Results (with provenance) at ${outPath}`)
console.log('Grade against evals/predictions.md — failing categories FIRST. A bad number is a finding, not a retry.')
