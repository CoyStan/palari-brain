// U8 prep — live-slice planning (Fable 5, 2026-07-18).
// Everything here is spend-free and deterministic: slice selection,
// token/cost accounting, and the guard that makes a live run
// impossible without the founder's explicit confirmation. The live
// runner (scripts/run-live-slice.mjs) is FOUNDER GATED; this module
// is what it plans with.

// Deterministic stratified selection: sort by questionId, round-robin
// across question types (alphabetical), prefer including at least one
// abstention (_abs) case. Input order never changes the result.
export function selectSlice(instances = [], { size = 10 } = {}) {
  const pool = [...instances].sort((a, b) => a.questionId.localeCompare(b.questionId))
  if (pool.length <= size) return pool
  const byType = new Map()
  for (const instance of pool) {
    if (!byType.has(instance.questionType)) byType.set(instance.questionType, [])
    byType.get(instance.questionType).push(instance)
  }
  const types = [...byType.keys()].sort()
  const picked = []
  const pickedIds = new Set()
  // guarantee one abstention case when the pool has one
  const abstention = pool.find((i) => i.isAbstention)
  if (abstention) {
    picked.push(abstention)
    pickedIds.add(abstention.questionId)
  }
  let cursor = 0
  while (picked.length < size) {
    const type = types[cursor % types.length]
    cursor += 1
    const next = byType.get(type)?.find((i) => !pickedIds.has(i.questionId))
    if (next) {
      picked.push(next)
      pickedIds.add(next.questionId)
    }
    if (cursor > types.length * (size + pool.length)) break // pool exhausted
  }
  return picked.sort((a, b) => a.questionId.localeCompare(b.questionId))
}

const CHARS_PER_TOKEN = 4 // same heuristic as estimateBriefingTokens

// Counts what a live slice would feed the provider:
// - ingest: one extraction call per user turn; input = turn pair +
//   extraction system prompt (~350 tokens overhead per call)
// - answer: one call per question; input = briefing budget + question
export function estimateSliceTokens(instances = []) {
  let sessions = 0
  let userTurns = 0
  let historyChars = 0
  let questionChars = 0
  for (const instance of instances) {
    questionChars += String(instance.question ?? '').length
    for (const session of instance.sessions ?? []) {
      sessions += 1
      for (const turn of session.turns ?? []) {
        historyChars += String(turn.content ?? '').length
        if (turn.role === 'user') userTurns += 1
      }
    }
  }
  const extractionOverheadTokensPerCall = 350
  const answerOverheadTokensPerQuestion = 600 // briefing budget (~450) + framing
  const estIngestInputTokens = Math.ceil(historyChars / CHARS_PER_TOKEN)
    + userTurns * extractionOverheadTokensPerCall
  const estIngestOutputTokens = userTurns * 150 // bounded JSON candidates
  const estAnswerInputTokens = Math.ceil(questionChars / CHARS_PER_TOKEN)
    + instances.length * answerOverheadTokensPerQuestion
  const estAnswerOutputTokens = instances.length * 250
  return {
    estAnswerInputTokens,
    estAnswerOutputTokens,
    estIngestInputTokens,
    estIngestOutputTokens,
    historyChars,
    questions: instances.length,
    sessions,
    userTurns,
  }
}

// Price table for the founder's decision sheet (USD per million
// tokens, entered 2026-07-18 from public pricing pages — re-verify at
// spend time; prices drift).
export const candidateModels = Object.freeze([
  { inPerM: 0.25, model: 'gemini-3.1-flash-lite', notes: 'current stable Flash-Lite; extraction request format is Gemini-native', outPerM: 1.50 },
  { inPerM: 0.10, model: 'gemini-2.5-flash-lite', notes: 'legacy price; unavailable to new API users', outPerM: 0.40 },
  { inPerM: 0.50, model: 'gemini-3-flash-preview', notes: 'stronger preview; Gemini-native', outPerM: 3.00 },
  { inPerM: 1.00, model: 'claude-haiku-4-5', notes: 'needs request translation from Gemini format', outPerM: 5.00 },
])

export function estimateSliceCostUSD(tokens, { inPerM, outPerM } = {}) {
  const input = tokens.estIngestInputTokens + tokens.estAnswerInputTokens
  const output = tokens.estIngestOutputTokens + tokens.estAnswerOutputTokens
  return {
    inputTokens: input,
    outputTokens: output,
    usd: (input / 1e6) * inPerM + (output / 1e6) * outPerM,
  }
}

// The gate in code: a live run is impossible without BOTH an explicit
// spend confirmation and a provider key in the runtime environment.
// Keys are never read anywhere else, never logged, never stored.
export function assertLiveRunAllowed(env = process.env) {
  if (env.PALARI_CONFIRM_SPEND !== '1') {
    throw new Error('FOUNDER GATE: live runs require PALARI_CONFIRM_SPEND=1 set by the founder for this invocation.')
  }
  if (env.GEMINI_API_KEY) return { provider: 'gemini' }
  if (env.ANTHROPIC_API_KEY) return { provider: 'anthropic' }
  throw new Error('No provider key in the environment (GEMINI_API_KEY or ANTHROPIC_API_KEY required at run time).')
}
