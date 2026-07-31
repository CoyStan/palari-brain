// Shared composition seam for the private active-retrieval seen-six runner.
// Capture fetch before constructing the fail-closed judge transport so a
// caller cannot accidentally omit the transport's explicit network boundary.

import {
  createIncrementalLongMemEvalJudgeTransport,
  IncrementalLongMemEvalJudgeTransportError,
} from './incremental-longmemeval-judge-transport.mjs'

export function captureActiveRetrievalSeenSixJudgeFactory({
  fetchImpl = globalThis.fetch,
  judgeFactory = createIncrementalLongMemEvalJudgeTransport,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_FETCH_MISSING',
      'The seen-six runtime requires a captured fetch implementation.',
    )
  }
  if (typeof judgeFactory !== 'function') {
    throw new IncrementalLongMemEvalJudgeTransportError(
      'JUDGE_FACTORY_CONFIG_INVALID',
      'The seen-six runtime requires a judge transport factory.',
    )
  }
  const capturedFetch = fetchImpl
  return Object.freeze(async (options = {}) => judgeFactory({
    ...options,
    fetchImpl: capturedFetch,
  }))
}
