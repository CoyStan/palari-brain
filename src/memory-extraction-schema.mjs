// One provider-facing contract for structured memory extraction.
//
// Gemini structured output constrains syntax and field vocabularies. The
// application still validates semantics before admitting any durable write.

import { deepFreeze } from './shared-util.mjs'

export const MEMORY_EXTRACTION_TYPES = Object.freeze([
  'preference',
  'relationship',
  'opinion',
  'entity',
  'life_event',
  'working',
  'project',
  'recent_life',
  'session_summary',
])

export const MEMORY_EXTRACTION_SOURCE_KINDS = Object.freeze([
  'user_message',
  'source_document',
  'tool_output',
  'web_result',
])

// The Gemini v1beta raw REST schema declares this field as an enum, so its
// ProtoJSON wire value is the enum name rather than an HTTP MIME literal.
export const MEMORY_EXTRACTION_RESPONSE_MIME_TYPE = 'APPLICATION_JSON'

export const MEMORY_EXTRACTION_RESPONSE_SCHEMA = deepFreeze({
  additionalProperties: false,
  properties: {
    memories: {
      items: {
        additionalProperties: false,
        properties: {
          type: {
            enum: MEMORY_EXTRACTION_TYPES,
            type: 'string',
          },
          content: { type: 'string' },
          keywords: {
            items: { type: 'string' },
            maxItems: 10,
            type: 'array',
          },
          importance: {
            maximum: 1,
            minimum: 0,
            type: 'number',
          },
          confidence: {
            maximum: 1,
            minimum: 0,
            type: 'number',
          },
          shared: { type: 'boolean' },
          fictional: { type: 'boolean' },
          sourceKind: {
            enum: MEMORY_EXTRACTION_SOURCE_KINDS,
            type: 'string',
          },
        },
        required: [
          'type',
          'content',
          'keywords',
          'importance',
          'confidence',
          'shared',
          'fictional',
          'sourceKind',
        ],
        type: 'object',
      },
      maxItems: 6,
      type: 'array',
    },
  },
  required: ['memories'],
  type: 'object',
})
