// Public-surface contract: the package entry point exports exactly the
// documented kernel API, and nothing from the entry point is undefined.
// A rename or accidental drop in src/index.mjs fails here first.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const EXPECTED_FUNCTIONS = [
  'answerQuestion',
  'applyKernelMigrations',
  'buildAnswerPrompt',
  'buildBriefingV1',
  'buildMemoryExtractionRequest',
  'confidenceBucket',
  'createAdmissionPolicy',
  'createGatedStore',
  'createKernelStore',
  'createMemoryExtractionScheduler',
  'createMemoryGate',
  'createWorkspaceMemoryManager',
  'deleteKernelStoreFile',
  'deterministicMockMemoryExtraction',
  'extractMemoryQueryKeywords',
  'ingestChatTurn',
  'ingestLongMemEvalInstance',
  'loadLongMemEvalInstances',
  'memorySourceBoundaryForCandidate',
  'memorySourceTextsFromAssistantResult',
  'normalizeMemoryExtractionPayload',
  'parseLongMemEvalTimestamp',
  'probeMemorySqliteDriver',
  'recallAndBrief',
  'runMemoryExtractionPass',
  'stubProvider',
  'workspaceMemoryDbPath',
  'writeSessionSummaryMemory',
]

const EXPECTED_VALUES = [
  'acquisitionModes',
  'admissionPolicyDefaults',
  'briefingDiagnostics',
  'externalMemorySourceKinds',
  'longMemEvalQuestionTypes',
  'memoryAddWriters',
  'memoryFtsTokenizer',
  'memoryMutationActors',
  'memoryStoreSchemaVersion',
  'memoryTypes',
  'permanentMemoryTypes',
  'transientMemoryTypes',
]

test('index.mjs exports the complete documented surface', async () => {
  const kernel = await import('../src/index.mjs')
  for (const name of EXPECTED_FUNCTIONS) {
    assert.equal(typeof kernel[name], 'function', `${name} must be an exported function`)
  }
  for (const name of EXPECTED_VALUES) {
    assert.notEqual(kernel[name], undefined, `${name} must be exported`)
  }
})
