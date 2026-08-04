// Active Palari writer contract.
//
// The model selects durable, exact quotes from the two visible speakers.
// It does not author content, keywords, sharing, or provenance. The host
// assigns provenance after checking which visible message contains the quote.
// External source/tool/web text is deliberately absent from this request.

import { deepFreeze, hasExactKeys } from './shared-util.mjs'

const statementTypes = [
  'preference',
  'relationship',
  'opinion',
  'entity',
  'life_event',
  'working',
  'project',
  'recent_life',
  'session_summary',
]

export const MEMORY_STATEMENT_TYPES = Object.freeze(statementTypes)

export const MEMORY_STATEMENT_RESPONSE_MIME_TYPE = 'APPLICATION_JSON'

export const MEMORY_STATEMENT_RESPONSE_SCHEMA = deepFreeze({
  additionalProperties: false,
  properties: {
    memories: {
      items: {
        additionalProperties: false,
        properties: {
          confidence: {
            maximum: 1,
            minimum: 0,
            type: 'number',
          },
          fictional: { type: 'boolean' },
          importance: {
            maximum: 1,
            minimum: 0,
            type: 'number',
          },
          quote: { type: 'string' },
          type: {
            enum: MEMORY_STATEMENT_TYPES,
            type: 'string',
          },
        },
        required: [
          'quote',
          'type',
          'importance',
          'confidence',
          'fictional',
        ],
        type: 'object',
      },
      maxItems: 8,
      type: 'array',
    },
  },
  required: ['memories'],
  type: 'object',
})

const extractionSystem = [
  'Select durable statements from the completed user and Palari exchange that may help in a later conversation.',
  'Return one JSON object with a memories array and no other text.',
  'For quote, copy one exact contiguous quote from either userMessage or palariMessage. Never paraphrase, normalize, summarize, or combine text.',
  'A durable recommendation or answer stated by Palari may be selected. The host, not you, records who said it.',
  `Choose one type from: ${MEMORY_STATEMENT_TYPES.join(', ')}.`,
  'Do not select filler, acknowledgements, requests with no durable information, passwords, passcodes, PINs, OTPs, or details explicitly limited to the current session.',
  'When nothing qualifies, return exactly {"memories":[]}.',
  'Do not return content, keywords, shared, sourceKind, speaker, source text, tool output, or web results.',
].join(' ')

export function buildStatementExtractionRequest({ turn = {} } = {}) {
  const dialogue = {
    palariMessage: String(turn.assistantMessage ?? ''),
    userMessage: String(turn.userMessage ?? ''),
  }
  return {
    contents: [
      {
        parts: [{ text: JSON.stringify(dialogue) }],
        role: 'user',
      },
    ],
    generationConfig: {
      maxOutputTokens: 2000,
      responseFormat: {
        text: {
          mimeType: MEMORY_STATEMENT_RESPONSE_MIME_TYPE,
          schema: MEMORY_STATEMENT_RESPONSE_SCHEMA,
        },
      },
      thinkingConfig: {
        thinkingLevel: 'MINIMAL',
      },
    },
    store: false,
    systemInstruction: {
      parts: [{ text: extractionSystem }],
    },
  }
}

function assertExactKeys(value, expected, label) {
  if (!hasExactKeys(value, expected)) {
    throw new TypeError(`${label} has unsupported fields.`)
  }
}

function boundedNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      value < 0 || value > 1) {
    throw new TypeError(`${label} must be a number from 0 through 1.`)
  }
  return value
}

function parsePayload(payload) {
  if (typeof payload !== 'string') return payload
  try {
    return JSON.parse(payload)
  } catch {
    throw new TypeError('Statement extraction must be valid JSON.')
  }
}

export function normalizeStatementExtractionPayload(payload) {
  const parsed = parsePayload(payload)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Statement extraction must be one object.')
  }
  assertExactKeys(parsed, ['memories'], 'Statement extraction')
  if (!Array.isArray(parsed.memories) || parsed.memories.length > 8) {
    throw new TypeError('Statement extraction memories must be an array of at most 8 items.')
  }
  const allowedTypes = new Set(MEMORY_STATEMENT_TYPES)
  return {
    memories: parsed.memories.map((candidate, index) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new TypeError(`Statement candidate ${index} must be an object.`)
      }
      assertExactKeys(
        candidate,
        ['quote', 'type', 'importance', 'confidence', 'fictional'],
        `Statement candidate ${index}`,
      )
      if (typeof candidate.quote !== 'string') {
        throw new TypeError(`Statement candidate ${index} quote must be a string.`)
      }
      const quote = candidate.quote
      if (!quote.trim()) {
        throw new TypeError(`Statement candidate ${index} quote is required.`)
      }
      if (typeof candidate.type !== 'string') {
        throw new TypeError(`Statement candidate ${index} type must be a string.`)
      }
      const type = candidate.type.trim()
      if (!allowedTypes.has(type)) {
        throw new TypeError(`Statement candidate ${index} has an unsupported type.`)
      }
      if (typeof candidate.fictional !== 'boolean') {
        throw new TypeError(`Statement candidate ${index} fictional must be boolean.`)
      }
      return {
        confidence: boundedNumber(
          candidate.confidence,
          `Statement candidate ${index} confidence`,
        ),
        fictional: candidate.fictional,
        importance: boundedNumber(
          candidate.importance,
          `Statement candidate ${index} importance`,
        ),
        quote,
        type,
      }
    }),
  }
}

export function statementQuoteOrigins({ quote }, {
  assistantMessage = '',
  userMessage = '',
} = {}) {
  const text = String(quote ?? '')
  if (!text) return []
  const origins = []
  if (String(userMessage).includes(text)) {
    origins.push('user_message')
  }
  if (String(assistantMessage).includes(text)) {
    origins.push('assistant_message')
  }
  return origins
}
