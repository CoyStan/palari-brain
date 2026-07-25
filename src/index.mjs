// palari-brain — active public entry point.
//
// The public product path stores exact durable quotes from visible user and
// Palari messages, with speaker provenance assigned by the host. Recall sends
// the complete current scoped set to the answer model. The lexical v0.5
// implementation remains inside the repository only as a historical eval
// comparator and is not exported by this package.

export {
  answerQuestion,
  buildAnswerPrompt,
  buildMemoryBriefing,
  createPalariBrain,
  dialogueSourceKinds,
  forgetMemories,
  ingestChatTurn,
  ingestLongMemEvalInstance,
  recallAllStatements,
  stubProvider,
} from './brain.mjs'

export {
  buildStatementExtractionRequest,
  MEMORY_STATEMENT_RESPONSE_MIME_TYPE,
  MEMORY_STATEMENT_RESPONSE_SCHEMA,
  MEMORY_STATEMENT_TYPES,
  normalizeStatementExtractionPayload,
  statementQuoteOrigins,
} from './statement-extraction.mjs'

export {
  loadLongMemEvalInstances,
  longMemEvalQuestionTypes,
  parseLongMemEvalTimestamp,
} from './longmemeval.mjs'
