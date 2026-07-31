// Gemini REST transport for live evals. Authorization keys travel only
// in x-goog-api-key, never in URLs, logs, result files, or prompts.

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function lowerSchemaNode(value, path) {
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      lowerSchemaNode(entry, `${path}[${index}]`))
  }
  if (!plainObject(value)) return value

  const lowered = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      lowerSchemaNode(child, `${path}.${key}`),
    ]),
  )
  if (!Array.isArray(value.anyOf)) return lowered
  if (!plainObject(value.properties)) {
    throw new TypeError(
      `${path}.anyOf requires root properties for Gemini lowering.`,
    )
  }

  // Gemini validates each anyOf branch in isolation. A provider-neutral
  // object schema may declare properties once on the root and put only the
  // selector's `required` list inside each branch; Gemini rejects that shape
  // because the required field is not repeated in the branch's properties.
  // Copy only those definitions into the branch. The root schema, union, and
  // host-side argument contract remain otherwise unchanged.
  lowered.anyOf = value.anyOf.map((branch, branchIndex) => {
    if (!plainObject(branch) || !Array.isArray(branch.required) ||
      !branch.required.length) {
      throw new TypeError(
        `${path}.anyOf[${branchIndex}] must have a required list.`,
      )
    }
    const branchProperties = plainObject(branch.properties)
      ? lowerSchemaNode(
          branch.properties,
          `${path}.anyOf[${branchIndex}].properties`,
        )
      : {}
    for (const property of branch.required) {
      if (typeof property !== 'string' || !property) {
        throw new TypeError(
          `${path}.anyOf[${branchIndex}].required is invalid.`,
        )
      }
      const rootProperty = value.properties[property]
      if (rootProperty === undefined &&
        branchProperties[property] === undefined) {
        throw new TypeError(
          `${path}.anyOf[${branchIndex}] requires undefined property ` +
          `${property}.`,
        )
      }
      if (branchProperties[property] === undefined) {
        branchProperties[property] = lowerSchemaNode(
          rootProperty,
          `${path}.properties.${property}`,
        )
      }
    }
    return {
      ...lowerSchemaNode(branch, `${path}.anyOf[${branchIndex}]`),
      properties: branchProperties,
    }
  })
  return lowered
}

export function lowerGeminiFunctionParameters(parameters) {
  if (!plainObject(parameters)) {
    throw new TypeError('Gemini function parameters must be an object schema.')
  }
  return lowerSchemaNode(parameters, 'parameters')
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
        // Gemini requires an object schema even for a no-argument function.
        parameters: lowerGeminiFunctionParameters(tool.parameters ?? {
          properties: {},
          type: 'object',
        }),
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
