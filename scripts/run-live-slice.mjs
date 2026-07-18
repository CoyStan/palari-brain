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
import { buildGeminiGenerateRequest } from '../src/gemini.mjs'
import { loadLongMemEvalInstances } from '../src/longmemeval.mjs'
import {
  assertLiveRunAllowed,
  candidateModels,
  estimateSliceCostUSD,
  estimateSliceTokens,
  selectSlice,
} from '../src/slice.mjs'
import { createKernelStore, deleteKernelStoreFile } from '../src/store.mjs'
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

function workspaceOptions(workspaceId) {
  const root = join(repoRoot, 'data', 'run-workspaces')
  return {
    memoryEnabled: true,
    root,
    statePath: join(root, `${workspaceId}-state.json`),
    workspaceId,
  }
}

async function openWorkspace(workspaceId) {
  const options = workspaceOptions(workspaceId)
  await mkdir(options.root, { recursive: true })
  const store = await createKernelStore(options)
  return { gated: createGatedStore(store), store }
}

async function resetWorkspace(workspaceId) {
  await deleteKernelStoreFile(workspaceOptions(workspaceId))
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
const model = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'gemini-3.1-flash-lite'

const retryableGeminiStatuses = new Set([429, 500, 502, 503, 504])
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function retryDelayMs(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 60_000)
  }
  if (response?.status === 429) return 60_000
  return Math.min(1000 * (2 ** (attempt - 1)), 15_000)
}

async function geminiCall(body) {
  const request = buildGeminiGenerateRequest({
    apiKey: process.env.GEMINI_API_KEY,
    body,
    model,
  })
  const maxAttempts = 6
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let res
    try {
      res = await fetch(request.url, request.init)
    } catch (cause) {
      if (attempt === maxAttempts) {
        const error = new Error(`Gemini network failure after ${maxAttempts} attempts.`, { cause })
        error.category = 'provider_transport'
        throw error
      }
      const delay = Math.min(1000 * (2 ** (attempt - 1)), 15_000)
      console.warn(`  Gemini network failure; retrying attempt ${attempt + 1}/${maxAttempts} in ${delay}ms.`)
      await sleep(delay)
      continue
    }
    if (res.ok) {
      const data = await res.json()
      return data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    }
    const responseText = await res.text()
    if (retryableGeminiStatuses.has(res.status) && attempt < maxAttempts) {
      const delay = retryDelayMs(res, attempt)
      console.warn(`  Gemini ${res.status}; retrying transport attempt ${attempt + 1}/${maxAttempts} in ${delay}ms.`)
      await sleep(delay)
      continue
    }
    const error = new Error(`Gemini ${res.status}: ${responseText.slice(0, 300)}`)
    error.category = retryableGeminiStatuses.has(res.status) ? 'provider_transport' : 'provider_request'
    throw error
  }
  throw new Error('Gemini request exhausted without a response.')
}

if (providerName !== 'gemini') {
  console.error('Anthropic runner not wired yet — the extraction request format is Gemini-native. Translating it is a follow-up once the founder picks the provider. Refusing rather than improvising.')
  process.exit(4)
}

const liveExtractor = async ({ turn }) => geminiCall(buildMemoryExtractionRequest({ turn }))
const liveProvider = async ({ prompt }) => ({
  text: await geminiCall({ contents: [{ parts: [{ text: prompt }], role: 'user' }] }),
})

const promptHash = promptConfigHash()
const sliceIds = slice.map((q) => q.questionId)
const outDir = join(repoRoot, 'evals', 'results')
const outPath = join(outDir, `slice-u8-${model}-${promptHash}.json`)
await mkdir(outDir, { recursive: true })

let runStamp = new Date().toISOString()
let results = []
try {
  const checkpoint = JSON.parse(await readFile(outPath, 'utf8'))
  const provenanceMatches = checkpoint.datasetSha256 === sha256
    && checkpoint.model === model
    && checkpoint.promptConfigHash === promptHash
    && JSON.stringify(checkpoint.sliceIds) === JSON.stringify(sliceIds)
  if (!provenanceMatches) {
    throw new Error(`Existing checkpoint provenance does not match this run: ${outPath}`)
  }
  if (checkpoint.status === 'complete') {
    throw new Error(`U8 already completed at ${outPath}; refusing to re-roll model outputs.`)
  }
  runStamp = checkpoint.date
  results = Array.isArray(checkpoint.results) ? checkpoint.results : []
  console.log(`Resuming sealed U8 checkpoint with ${results.length}/${slice.length} questions complete.`)
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

async function writeCheckpoint(status) {
  await writeFile(outPath, JSON.stringify({
    datasetSha256: sha256,
    date: runStamp,
    model,
    promptConfigHash: promptHash,
    results,
    sliceIds,
    status,
  }, null, 2))
}

const completedIds = new Set(results.map((result) => result.questionId))
for (const q of slice) {
  if (completedIds.has(q.questionId)) {
    console.log(`  ${q.questionId}: checkpointed — not re-running`)
    continue
  }
  const workspaceId = `live-${q.questionId}`
  await resetWorkspace(workspaceId)
  const { gated, store } = await openWorkspace(workspaceId)
  try {
    const stats = await ingestLongMemEvalInstance(gated, q, {
      extractor: liveExtractor,
      extractorId: `live-${model}`,
      failOnExtractorError: true,
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
      extractorErrors: stats.extractorErrors,
      ingested: stats.memoriesWritten,
      invalidPayloads: stats.invalidPayloads,
      questionId: q.questionId,
      questionType: q.questionType,
      totalCandidates: answer.totalCandidates,
      turns: stats.turns,
    })
    completedIds.add(q.questionId)
    await writeCheckpoint('in_progress')
    console.log(`  ${q.questionId}: ingested=${stats.memoriesWritten} invalidPayloads=${stats.invalidPayloads} abstained=${answer.abstained}`)
  } finally {
    store.close()
  }
}
await writeCheckpoint('complete')
console.log(`\nLive slice complete. Results (with provenance) at ${outPath}`)
console.log('Grade against evals/predictions.md — failing categories FIRST. A bad number is a finding, not a retry.')
