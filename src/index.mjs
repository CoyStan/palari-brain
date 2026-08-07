// palari-brain — active public entry point.
//
// The public product path stores complete visible user and Palari messages as
// canonical evidence, with speaker provenance assigned by the host. Optional
// exact quotes are a derived index only. A bounded reducer updates active
// memory after each interaction; recall sends that complete digest to the
// answer model, with canonical fallback only while it fits. The lexical v0.5
// implementation remains only as a historical eval comparator.

export {
  answerQuestion,
  answerWithExploration,
  buildActiveMemoryBriefing,
  buildAnswerPrompt,
  buildMemoryBriefing,
  createPalariBrain,
  DEFAULT_EXPLORATION_CALLS,
  DEFAULT_REDUCTION_BATCH_INTERACTIONS,
  dialogueRetentions,
  dialogueSourceKinds,
  forgetMemories,
  forgetWithReport,
  memoryFreshness,
  ingestChatTurn,
  ingestLongMemEvalInstance,
  markReducerFailureTerminal,
  memoryAnswerSystemInstruction,
  recallMemory,
  recallAllStatements,
  reducePendingTurns,
  stubProvider,
} from './brain.mjs'

export {
  ACTIVE_MEMORY_ACTION_OPS,
  ACTIVE_MEMORY_BASIS_KINDS,
  ACTIVE_MEMORY_DISPOSITION_OUTCOMES,
  ACTIVE_MEMORY_EPISTEMICS,
  ACTIVE_MEMORY_LIMITS,
  ACTIVE_MEMORY_MAX_ACTIONS,
  ACTIVE_MEMORY_MAX_BASIS,
  ACTIVE_MEMORY_MAX_DIGEST_CHARS,
  ACTIVE_MEMORY_MAX_ITEMS,
  ACTIVE_MEMORY_MAX_QUOTE_CHARS,
  ACTIVE_MEMORY_MAX_REQUEST_CHARS,
  ACTIVE_MEMORY_MAX_STATEMENT_CHARS,
  ACTIVE_MEMORY_MAX_TOPIC_CHARS,
  ACTIVE_MEMORY_REDUCER_VERSION,
  ACTIVE_MEMORY_RELATIONS,
  ACTIVE_MEMORY_SYSTEM_INSTRUCTIONS,
  buildMemoryReductionRequest,
  normalizeMemoryReductionPayload,
} from './memory-reducer.mjs'

export {
  buildStatementExtractionRequest,
  MEMORY_STATEMENT_RESPONSE_MIME_TYPE,
  MEMORY_STATEMENT_RESPONSE_SCHEMA,
  MEMORY_STATEMENT_TYPES,
  normalizeStatementExtractionPayload,
  statementQuoteOrigins,
} from './statement-extraction.mjs'

export {
  MEMORY_EXPLORATION_INSTRUCTIONS,
  MEMORY_EXPLORATION_LIMITS,
  MEMORY_EXPLORATION_TOOLS,
} from './memory-exploration.mjs'

export {
  DEFAULT_RETRIEVAL_CALLS,
  MEMORY_ANSWER_MAX_CONSEQUENCE_CHARS,
  MEMORY_ANSWER_MAX_INFERENCE_CHARS,
  MEMORY_ANSWER_MAX_NOT_USED_REASON_CHARS,
  MEMORY_ANSWER_MAX_TEMPORARY_INFERENCES,
  MEMORY_ANSWER_RECOMMENDED_MAX_OUTPUT_TOKENS,
  MEMORY_HYBRID_RRF_K,
  MEMORY_RETRIEVAL_COMPLETENESS_INSTRUCTIONS,
  MEMORY_RETRIEVAL_PLAN_INSTRUCTIONS,
  MEMORY_RETRIEVAL_PLAN_RELATIONS,
  MEMORY_RETRIEVAL_PLAN_TOOL,
  MEMORY_RETRIEVAL_PLAN_TOOL_NAME,
  MEMORY_RETRIEVAL_INSTRUCTIONS,
  MEMORY_RETRIEVAL_TOOLS,
  answerWithRetrieval,
  normalizeRetrievalPlan,
  reciprocalRankFuse,
} from './retrieval-answer.mjs'

export {
  loadLongMemEvalInstances,
  longMemEvalQuestionTypes,
  parseLongMemEvalTimestamp,
} from './longmemeval.mjs'
