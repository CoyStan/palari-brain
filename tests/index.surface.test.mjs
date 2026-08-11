// Public-surface contract for the active, non-lexical product path.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const EXPECTED_FUNCTIONS = [
  'answerQuestion',
  'answerWithRetrieval',
  'buildActiveMemoryBriefing',
  'buildAnswerPrompt',
  'buildMemoryBriefing',
  'buildMemoryReductionRequest',
  'buildStatementExtractionRequest',
  'createPalariBrain',
  'forgetMemories',
  'ingestChatTurn',
  'ingestLongMemEvalInstance',
  'loadLongMemEvalInstances',
  'markReducerFailureTerminal',
  'normalizeStatementExtractionPayload',
  'parseLongMemEvalTimestamp',
  'recallMemory',
  'recallAllStatements',
  'reducePendingTurns',
  'normalizeMemoryReductionPayload',
  'statementQuoteOrigins',
  'stubProvider',
]

const EXPECTED_VALUES = [
  'ACTIVE_MEMORY_ACTION_OPS',
  'ACTIVE_MEMORY_BASIS_KINDS',
  'ACTIVE_MEMORY_DISPOSITION_OUTCOMES',
  'ACTIVE_MEMORY_EPISTEMICS',
  'ACTIVE_MEMORY_LIMITS',
  'ACTIVE_MEMORY_REDUCER_VERSION',
  'ACTIVE_MEMORY_RELATIONS',
  'ACTIVE_MEMORY_SYSTEM_INSTRUCTIONS',
  'dialogueRetentions',
  'dialogueSourceKinds',
  'longMemEvalQuestionTypes',
  'memoryAnswerSystemInstruction',
  'MEMORY_STATEMENT_RESPONSE_MIME_TYPE',
  'MEMORY_STATEMENT_RESPONSE_SCHEMA',
  'MEMORY_STATEMENT_TYPES',
  'MEMORY_RETRIEVAL_TOOLS',
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

test('the package includes every module loaded by its public entry point',
  async () => {
    const packageJson = JSON.parse(await readFile(
      new URL('../package.json', import.meta.url),
      'utf8',
    ))
    assert.equal(
      packageJson.exports['./embedder'],
      './src/embedder.mjs',
      'the chunking adapter must use a dedicated provider-neutral subpath',
    )
    assert.equal(
      packageJson.exports['./gemini'],
      './src/gemini.mjs',
      'the Gemini adapter must use a dedicated provider subpath',
    )
    assert.ok(
      packageJson.files.includes('src/memory-exploration.mjs'),
      'installed tarballs must include the exploration module exported by index.mjs',
    )
    for (const path of [
      'src/embedder.mjs',
      'src/gemini.mjs',
      'src/memory-graph.mjs',
      'src/memory-search.mjs',
      'src/memory-semantic.mjs',
      'src/memory-trend.mjs',
      'src/quote-context.mjs',
      'src/retrieval-answer.mjs',
      'src/retrieval-frontier.mjs',
      'src/retrieval-plan.mjs',
    ]) {
      assert.ok(
        packageJson.files.includes(path),
        `installed tarballs must include ${path}`,
      )
    }
  })
