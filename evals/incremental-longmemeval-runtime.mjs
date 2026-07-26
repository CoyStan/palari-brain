// Shared composition seam for a future incremental LongMemEval successor.
//
// The sealed v1 runner remains immutable evidence. This module owns the
// exact model and generation bindings that its runner assembled incorrectly,
// so a successor and its offline integration test can use the same real
// constructor path without copying a namespace-shaped options object.

import {
  createActiveBrainMeteredTransport,
  J4LiveError,
} from './active-brain-live-meter.mjs'
import {
  INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_MODEL,
  INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION,
} from './arms/incremental-memory-longmemeval-live-arm.mjs'

const DENIED_OPENAI_KEY = 'palari-deny-unmetered-openai'

export const INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT = Object.freeze({
  answerGeneration: INCREMENTAL_LONGMEMEVAL_ANSWER_GENERATION,
  geminiModel: INCREMENTAL_LONGMEMEVAL_MODEL,
  writerGeneration: INCREMENTAL_LONGMEMEVAL_REDUCER_GENERATION,
})

export async function denyIncrementalLongMemEvalRetry() {
  throw new J4LiveError(
    'INCREMENTAL_LONGMEMEVAL_RETRY_FORBIDDEN',
    'Incremental LongMemEval permits one physical dispatch per operation.',
  )
}

export async function createIncrementalLongMemEvalGeminiTransport({
  capUsd,
  fetchImpl,
  geminiApiKey,
  journalPath,
  limits,
  retryJitterImpl,
  transcriptDirectory,
} = {}) {
  const transport = await createActiveBrainMeteredTransport({
    ...INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT,
    capUsd,
    fetchImpl,
    geminiApiKey,
    journalPath,
    limits,
    openaiApiKey: DENIED_OPENAI_KEY,
    retryJitterImpl,
    transcriptDirectory,
    waitImpl: denyIncrementalLongMemEvalRetry,
  })
  return Object.freeze({
    callGemini: transport.callGemini,
    closeNetworkGuard: transport.closeNetworkGuard,
    get geminiModelVersion() {
      return transport.geminiModelVersion
    },
    installNetworkGuard: transport.installNetworkGuard,
    snapshot: transport.snapshot,
    verify: transport.verify,
  })
}
