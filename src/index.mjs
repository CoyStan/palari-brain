// palari-brain — public entry point.
// The governed memory kernel in one import: store, gate, recall,
// briefing, adapter, and the LongMemEval loader. Everything durable
// goes through gate.propose; recall comes back as a provenance-carrying
// briefing; absence is reported honestly.
//
// Quickstart: examples/quickstart.mjs (offline, no API key).

export {
  acquisitionModes,
  createKernelStore,
  createWorkspaceMemoryManager,
  deleteKernelStoreFile,
  externalMemorySourceKinds,
  extractMemoryQueryKeywords,
  memoryAddWriters,
  memoryFtsTokenizer,
  memoryMutationActors,
  memoryStoreSchemaVersion,
  memoryTypes,
  permanentMemoryTypes,
  probeMemorySqliteDriver,
  transientMemoryTypes,
  workspaceMemoryDbPath,
} from './store.mjs'

export {
  admissionPolicyDefaults,
  applyKernelMigrations,
  createAdmissionPolicy,
  createGatedStore,
  createMemoryGate,
} from './gate.mjs'

export {
  briefingDiagnostics,
  buildBriefingV1,
  confidenceBucket,
  recallAndBrief,
} from './recall.mjs'

export {
  answerQuestion,
  buildAnswerPrompt,
  ingestChatTurn,
  ingestLongMemEvalInstance,
  stubProvider,
} from './adapter.mjs'

export {
  loadLongMemEvalInstances,
  longMemEvalQuestionTypes,
  parseLongMemEvalTimestamp,
} from './longmemeval.mjs'

export {
  buildMemoryExtractionRequest,
  createMemoryExtractionScheduler,
  deterministicMockMemoryExtraction,
  memorySourceBoundaryForCandidate,
  memorySourceTextsFromAssistantResult,
  normalizeMemoryExtractionPayload,
  runMemoryExtractionPass,
  writeSessionSummaryMemory,
} from './memory-extraction.mjs'
