// Optional answer policies. The storage kernel never imports this module.
import { recallMemory } from './memory-kernel.mjs'
import { memoryAnswerSystemInstruction } from './answer-instructions.mjs'
import { MEMORY_EXPLORATION_INSTRUCTIONS, MEMORY_EXPLORATION_TOOLS } from './memory-exploration.mjs'
import { answerWithRetrieval } from './retrieval-answer.mjs'
export { memoryAnswerSystemInstruction } from './answer-instructions.mjs'
const defaultMemoryContextChars = 100_000

export function buildAnswerPrompt({
  briefingText = '',
  question = '',
  questionDate,
} = {}) {
  const parts = [
    memoryAnswerSystemInstruction,
    String(briefingText),
    questionDate ? `Question date: ${questionDate}` : '',
    `Question: ${String(question)}`,
  ].filter(Boolean)
  return parts.join('\n\n')
}

export async function stubProvider({ briefing } = {}) {
  if (briefing?.status !== 'included') {
    return {
      abstained: true,
      text: 'I have no stored memories relevant to this question.',
    }
  }
  return {
    abstained: false,
    text: `Stored dialogue: ${briefing.included
      .map((entry) => `${entry.speaker} said ${entry.content}`)
      .join(' | ')}`,
  }
}

export async function answerQuestion(brain, {
  maxChars = defaultMemoryContextChars,
  palariId,
  provider,
  question,
  questionDate,
  userId,
} = {}) {
  const briefing = recallMemory(
    brain,
    { palariId, userId },
    { maxChars },
  )
  if ([
    'capacity_exceeded',
    'digest_incomplete',
  ].includes(briefing.status)) {
    const pending = briefing.status === 'digest_incomplete'
    return {
      abstained: null,
      answer: pending
        ? 'I could not safely answer from memory because the incremental memory digest has not caught up and the complete journal is too large.'
        : 'I could not safely check the available memory because the configured memory context is too small.',
      briefingMode: briefing.briefingMode,
      briefingStatus: briefing.status,
      complete: false,
      contractVersion: briefing.contractVersion,
      digestRevision: briefing.digestRevision,
      digestStatus: briefing.digestStatus,
      included: [],
      latencyMs: briefing.latencyMs,
      providerCalled: false,
      reductionBlocked: briefing.reductionBlocked,
      reductionPending: briefing.reductionPending,
      requiredChars: briefing.requiredChars,
      totalCandidates: briefing.totalCandidates,
    }
  }
  if (briefing.status === 'empty') {
    return {
      abstained: true,
      answer: 'I have no stored memories relevant to this question.',
      briefingMode: briefing.briefingMode,
      briefingStatus: briefing.status,
      complete: true,
      contractVersion: briefing.contractVersion,
      digestRevision: briefing.digestRevision,
      digestStatus: briefing.digestStatus,
      included: [],
      latencyMs: briefing.latencyMs,
      providerCalled: false,
      reductionBlocked: briefing.reductionBlocked,
      reductionPending: briefing.reductionPending,
      requiredChars: 0,
      totalCandidates: 0,
    }
  }
  if (typeof provider !== 'function') {
    throw new TypeError('answerQuestion requires a provider function.')
  }
  const prompt = buildAnswerPrompt({
    briefingText: briefing.text,
    question,
    questionDate,
  })
  const response = await provider({
    briefing,
    memoryText: briefing.text,
    prompt,
    question,
    questionDate,
    questionText: [
      questionDate ? `Question date: ${questionDate}` : '',
      `Question: ${String(question)}`,
    ].filter(Boolean).join('\n'),
    systemInstruction: memoryAnswerSystemInstruction,
  })
  const explicitAbstention = typeof response?.abstained === 'boolean'
    ? response.abstained
    : null
  return {
    abstained: explicitAbstention,
    answer: String(response?.text ?? response ?? ''),
    briefingMode: briefing.briefingMode,
    briefingStatus: briefing.status,
    complete: true,
    contractVersion: briefing.contractVersion,
    digestRevision: briefing.digestRevision,
    digestStatus: briefing.digestStatus,
    included: briefing.included,
    latencyMs: briefing.latencyMs,
    prompt,
    providerCalled: true,
    reductionBlocked: briefing.reductionBlocked,
    reductionPending: briefing.reductionPending,
    requiredChars: briefing.requiredChars,
    totalCandidates: briefing.totalCandidates,
  }
}

export const DEFAULT_EXPLORATION_CALLS = 6

// Bounded look-then-answer. The digest is always supplied first; exploration
// only happens if the provider asks for it. Every consultation is recorded,
// so an explored answer carries a replayable list of exactly which stored
// messages informed it — something a nearest-neighbour retriever cannot
// produce.
export async function answerWithExploration(brain, {
  maxChars = defaultMemoryContextChars,
  maxExplorationCalls = DEFAULT_EXPLORATION_CALLS,
  palariId,
  provider,
  question,
  questionDate,
  userId,
} = {}) {
  if (typeof provider !== 'function') {
    throw new TypeError('answerWithExploration requires a provider function.')
  }
  const budget = Number(maxExplorationCalls)
  if (!Number.isSafeInteger(budget) || budget < 0) {
    throw new TypeError('maxExplorationCalls must be a non-negative integer.')
  }
  const scope = { palariId, userId }
  const consulted = []
  const transcript = []

  const tools = {
    memory_find(input) {
      const found = brain.exploreFind(scope, input)
      consulted.push(...found.matches.map((match) => match.evidenceId))
      return found
    },
    memory_read(input) {
      const readResult = brain.exploreRead(scope, input)
      consulted.push(...readResult.messages.map((row) => row.evidenceId))
      return readResult
    },
    memory_timeline(input) {
      return brain.exploreTimeline(scope, input)
    },
  }

  const briefing = recallMemory(brain, scope, { maxChars })
  let calls = 0
  let exhausted = false

  const explore = async (request) => {
    const name = String(request?.tool ?? '')
    if (!Object.hasOwn(tools, name)) {
      throw new TypeError(`Unknown memory tool: ${name}`)
    }
    if (calls >= budget) {
      exhausted = true
      // Fail closed and say so, rather than looping or inventing an answer.
      return {
        exhausted: true,
        reason: 'exploration_budget_exhausted',
      }
    }
    calls += 1
    const result = tools[name](request.input ?? {})
    transcript.push({ input: request.input ?? {}, result, tool: name })
    return result
  }

  const response = await provider({
    briefing,
    explore,
    explorationInstructions: MEMORY_EXPLORATION_INSTRUCTIONS,
    explorationTools: MEMORY_EXPLORATION_TOOLS,
    memoryText: briefing.text,
    question,
    questionDate,
    questionText: [
      questionDate ? `Question date: ${questionDate}` : '',
      `Question: ${String(question)}`,
    ].filter(Boolean).join('\n'),
    systemInstruction: memoryAnswerSystemInstruction,
  })

  return {
    abstained: typeof response?.abstained === 'boolean'
      ? response.abstained
      : null,
    answer: String(response?.text ?? response ?? ''),
    briefingMode: briefing.briefingMode,
    briefingStatus: briefing.status,
    // The audit trail: exactly which stored messages informed this answer.
    consultedEvidenceIds: [...new Set(consulted)],
    digestRevision: briefing.digestRevision,
    explorationCalls: calls,
    explorationExhausted: exhausted,
    explorationTranscript: transcript,
    providerCalled: true,
    reductionBlocked: briefing.reductionBlocked,
  }
}


// One host-selected hybrid query, canonical readback, one answer callback.
// Reuse the hardened commitment boundary so baseline and iterative answers
// enforce identical evidence ownership and quote rules.
export async function answerWithSingleSearch(brain, {
  palariId, userId, question, questionDate, provider,
  searchQuery = question,
  retrievalProfile = 'simple',
  maxChars = 100_000, limit = 20, evidenceMaxChars = 20_000,
  trustedRetrievalTimeRange,
} = {}) {
  if (typeof provider !== 'function') {
    throw new TypeError('answerWithSingleSearch requires a provider function.')
  }
  let providerCalled = false
  const oneAnswer = async ({ retrieve, commitAnswer, briefing, systemInstruction }) => {
    const result = await retrieve({
      tool: 'memory_search', input: { phrase: searchQuery, limit, maxChars: evidenceMaxChars },
    })
    if (result.matches.length === 0) {
      return { abstained: true, text: 'I did not find stored evidence for this question.' }
    }
    providerCalled = true
    const proposal = await provider({
      question, questionDate, systemInstruction,
      memoryText: briefing.briefingMode === 'incremental_digest' ? briefing.text : '',
      evidence: result.matches,
      answerInstructions: 'Return {abstained, text, bases: [{evidenceId, quote}]}. Cite only exact contiguous quotes from the supplied evidence. A citation proves source ownership, not that an inference is true. If evidence is insufficient, abstain with an empty bases array.',
    })
    return commitAnswer(proposal)
  }
  oneAnswer.requiresEvidenceCommitment = true
  const answer = await answerWithRetrieval(brain, {
    palariId, userId, question, questionDate, maxChars,
    trustedRetrievalTimeRange, provider: oneAnswer,
    maxRetrievalCalls: 1, allowEmptyAbstention: true,
    briefingPolicy: 'digest', retrievalProfile,
  })
  return { ...answer, providerCalled, answerStrategy: 'single_search' }
}
