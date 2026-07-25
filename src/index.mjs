// palari-brain — active public entry point.
//
// The public product path stores complete visible user and Palari messages as
// canonical evidence, with speaker provenance assigned by the host. Optional
// exact quotes are a derived index only. Recall sends the complete current
// scoped evidence set to the answer model. The lexical v0.5 implementation
// remains inside the repository only as a historical eval comparator.

export {
  answerQuestion,
  buildAnswerPrompt,
  buildMemoryBriefing,
  createPalariBrain,
  dialogueRetentions,
  dialogueSourceKinds,
  forgetMemories,
  ingestChatTurn,
  ingestLongMemEvalInstance,
  memoryAnswerSystemInstruction,
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
