// U8 prompt provenance. The manifest uses fixed sentinel content so the
// hash changes when extraction configuration, briefing v1 framing, or
// answer framing changes, but not when benchmark content changes.

import { createHash } from 'node:crypto'

import { buildAnswerPrompt } from './adapter.mjs'
import { buildMemoryExtractionRequest } from './memory-extraction.mjs'
import { buildBriefingV1 } from './recall.mjs'

export function buildPromptConfigManifest() {
  const now = new Date('2026-01-03T00:00:00.000Z')
  const included = buildBriefingV1({
    now,
    recall: {
      memories: [{
        access_count: 0,
        confidence: 0.8,
        content: 'User prefers jasmine tea.',
        created_at: '2026-01-02T00:00:00.000Z',
        extractor: 'prompt-config-probe',
        id: 'prompt-config-memory',
        importance: 0.9,
        last_accessed: '2026-01-02T00:00:00.000Z',
        rpath: 'recent',
        source_kind: 'source_document',
        type: 'preference',
        valid_from: '2026-01-01T00:00:00.000Z',
      }],
    },
  })
  const empty = buildBriefingV1({ now, recall: { memories: [] } })
  const question = '<question>'
  const questionDate = '2026-01-03T00:00:00.000Z'

  return {
    answerConfig: {
      contextBudget: 12,
      maxChars: 1800,
    },
    answerPrompts: {
      empty: buildAnswerPrompt({ briefingText: empty.text, question, questionDate }),
      included: buildAnswerPrompt({ briefingText: included.text, question, questionDate }),
    },
    extractionRequest: buildMemoryExtractionRequest({
      turn: {
        assistantMessage: '<assistant-message>',
        palariId: '<palari-id>',
        palariName: '<palari-name>',
        sourceTexts: ['<source-text>'],
        userId: '<user-id>',
        userMessage: '<user-message>',
        userName: '<user-name>',
      },
    }),
    schemaVersion: 1,
  }
}

export function promptConfigHash(manifest = buildPromptConfigManifest()) {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0, 16)
}
