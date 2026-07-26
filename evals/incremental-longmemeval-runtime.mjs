// Shared composition seam for a future incremental LongMemEval successor.
//
// The sealed v1 runner remains immutable evidence. This module owns the
// exact model and generation bindings that its runner assembled incorrectly,
// so a successor and its offline integration test can use the same real
// constructor path without copying a namespace-shaped options object.

import {
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_ANSWER_GENERATION,
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
  INCREMENTAL_LONGMEMEVAL_HARD_CAP_REDUCER_GENERATION,
} from './arms/incremental-memory-longmemeval-live-arm.mjs'
import {
  createIncrementalLongMemEvalHardCapGeminiTransport,
  IncrementalGeminiHardCapError,
} from './incremental-longmemeval-hard-cap-gemini.mjs'

export const INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT = Object.freeze({
  answerGeneration:
    INCREMENTAL_LONGMEMEVAL_HARD_CAP_ANSWER_GENERATION,
  geminiModel: INCREMENTAL_LONGMEMEVAL_HARD_CAP_MODEL,
  writerGeneration:
    INCREMENTAL_LONGMEMEVAL_HARD_CAP_REDUCER_GENERATION,
})

export function incrementalLongMemEvalGeminiEffectiveCap({
  cumulativeCapUsd,
  freshSubcapUsd,
  openingAccountedUsd = 0,
} = {}) {
  if (!Number.isFinite(cumulativeCapUsd) ||
    cumulativeCapUsd <= 0 ||
    !Number.isFinite(freshSubcapUsd) ||
    freshSubcapUsd <= 0 ||
    !Number.isFinite(openingAccountedUsd) ||
    openingAccountedUsd < 0 ||
    openingAccountedUsd > cumulativeCapUsd) {
    throw new IncrementalGeminiHardCapError(
      'CAP_INVALID',
      'The successor runtime requires coherent fresh, cumulative, and opening spend caps.',
    )
  }
  return Math.min(
    cumulativeCapUsd,
    Number((openingAccountedUsd + freshSubcapUsd).toFixed(12)),
  )
}

export async function createIncrementalLongMemEvalGeminiTransport({
  cumulativeCapUsd,
  fetchImpl,
  freshSubcapUsd,
  geminiApiKey,
  journalPath,
  maxResponseBytes,
  now,
  openingAccountedUsd = 0,
  requestTimeoutMs,
  transcriptDirectory,
} = {}) {
  const capUsd = incrementalLongMemEvalGeminiEffectiveCap({
    cumulativeCapUsd,
    freshSubcapUsd,
    openingAccountedUsd,
  })
  const transport =
    await createIncrementalLongMemEvalHardCapGeminiTransport({
      answerGeneration:
        INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT.answerGeneration,
      writerGeneration:
        INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT.writerGeneration,
      model: INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT.geminiModel,
      capUsd,
      fetchImpl,
      geminiApiKey,
      journalPath,
      maxResponseBytes,
      now,
      openingAccountedUsd,
      requireNetworkGuard: true,
      requestTimeoutMs,
      transcriptDirectory,
    })
  return Object.freeze({
    callGemini: transport.callGemini,
    closeNetworkGuard: transport.closeNetworkGuard,
    contractSha256: transport.contractSha256,
    effectiveCapUsd: capUsd,
    get geminiModelVersion() {
      return INCREMENTAL_LONGMEMEVAL_GEMINI_CONTRACT.geminiModel
    },
    installNetworkGuard: transport.installNetworkGuard,
    snapshot: transport.snapshot,
    verify: transport.verify,
  })
}
