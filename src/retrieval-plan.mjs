// Public focused entry point for the session-ephemeral retrieval-plan contract.
// The implementation lives beside the answer loop so importing the active
// answer path does not widen historical sealed runner dependency closures.

export {
  MEMORY_RETRIEVAL_PLAN_INSTRUCTIONS,
  MEMORY_RETRIEVAL_PLAN_RELATIONS,
  MEMORY_RETRIEVAL_PLAN_TOOL,
  MEMORY_RETRIEVAL_PLAN_TOOL_NAME,
  normalizeRetrievalPlan,
} from './retrieval-answer.mjs'
