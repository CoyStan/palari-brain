// Public-surface contract for the active, non-lexical product path.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const EXPECTED_FUNCTIONS = [
  'answerQuestion',
  'buildAnswerPrompt',
  'buildMemoryBriefing',
  'buildStatementExtractionRequest',
  'createPalariBrain',
  'forgetMemories',
  'ingestChatTurn',
  'ingestLongMemEvalInstance',
  'loadLongMemEvalInstances',
  'normalizeStatementExtractionPayload',
  'parseLongMemEvalTimestamp',
  'recallAllStatements',
  'statementQuoteOrigins',
  'stubProvider',
]

const EXPECTED_VALUES = [
  'dialogueRetentions',
  'dialogueSourceKinds',
  'longMemEvalQuestionTypes',
  'memoryAnswerSystemInstruction',
  'MEMORY_STATEMENT_RESPONSE_MIME_TYPE',
  'MEMORY_STATEMENT_RESPONSE_SCHEMA',
  'MEMORY_STATEMENT_TYPES',
]

const REMOVED_LEXICAL_OR_MODEL_AUTHORITY_EXPORTS = [
  'createGatedStore',
  'createKernelStore',
  'extractMemoryQueryKeywords',
  'memoryFtsTokenizer',
  'memorySourceBoundaryForCandidate',
  'normalizeMemoryExtractionPayload',
  'recallAndBrief',
  'runMemoryExtractionPass',
]

test('index.mjs exports only the active role-provenance surface', async () => {
  const brain = await import('../src/index.mjs')
  for (const name of EXPECTED_FUNCTIONS) {
    assert.equal(
      typeof brain[name],
      'function',
      `${name} must be an exported function`,
    )
  }
  for (const name of EXPECTED_VALUES) {
    assert.notEqual(
      brain[name],
      undefined,
      `${name} must be exported`,
    )
  }
  for (const name of REMOVED_LEXICAL_OR_MODEL_AUTHORITY_EXPORTS) {
    assert.equal(
      brain[name],
      undefined,
      `${name} must not be on the active package surface`,
    )
  }
})
