// Gemini REST transport for live evals. Authorization keys travel only
// in x-goog-api-key, never in URLs, logs, result files, or prompts.

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function cloneGeminiFunctionParameters(parameters) {
  if (!plainObject(parameters)) {
    throw new TypeError(
      'Gemini function parametersJsonSchema must be an object schema.',
    )
  }
  return structuredClone(parameters)
}

export function buildGeminiFunctionTools(tools) {
  if (!Array.isArray(tools) || !tools.length) {
    throw new TypeError('Gemini function tools must be a non-empty array.')
  }
  return [{
    functionDeclarations: tools.map((tool, index) => {
      if (!plainObject(tool)) {
        throw new TypeError(`Gemini function tool ${index} must be an object.`)
      }
      const name = String(tool.name ?? '').trim()
      if (!name) {
        throw new TypeError(`Gemini function tool ${index} needs a name.`)
      }
      return {
        description: String(tool.description ?? ''),
        name,
        // `parameters` accepts only Gemini's legacy OpenAPI subset. Preserve
        // Palari's provider-neutral JSON Schema, including root `anyOf`,
        // through the dedicated raw JSON Schema field instead.
        parametersJsonSchema: cloneGeminiFunctionParameters(
          tool.parameters ?? {
            properties: {},
            type: 'object',
          },
        ),
      }
    }),
  }]
}

export function buildGeminiGenerateRequest({ apiKey, body, model } = {}) {
  const key = String(apiKey ?? '').trim()
  const modelId = String(model ?? '').trim()
  if (!key) throw new Error('Gemini API key is required.')
  if (!modelId) throw new Error('Gemini model is required.')
  return {
    init: {
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      },
      method: 'POST',
    },
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
  }
}
