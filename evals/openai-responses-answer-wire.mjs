// Provider-free validation for the exact OpenAI Responses answer wires emitted
// by Palari's Luna adapter. Callers reserve and dispatch only the returned
// private snapshot; the caller-owned request is never trusted after validation.

const arrayIsArray = Array.isArray
const objectFreeze = Object.freeze
const objectGetOwnPropertyDescriptors = Object.getOwnPropertyDescriptors
const objectGetPrototypeOf = Object.getPrototypeOf
const objectHasOwn = Object.hasOwn
const objectPrototype = Object.prototype
const arrayPrototype = Array.prototype
const reflectOwnKeys = Reflect.ownKeys
const jsonStringify = JSON.stringify
const numberIsFinite = Number.isFinite
const numberIsSafeInteger = Number.isSafeInteger

function fail(message) {
  throw new TypeError(`OpenAI answer wire: ${message}`)
}

function exactKeys(value, expected, label) {
  const actual = reflectOwnKeys(value)
  if (actual.some((key) => typeof key !== 'string')) {
    fail(`${label} must not have symbol keys.`)
  }
  const sorted = actual.slice().sort()
  const wanted = expected.slice().sort()
  if (jsonStringify(sorted) !== jsonStringify(wanted)) {
    fail(`${label} fields differ from the frozen contract.`)
  }
}

function snapshotData(value, seen = new Set(), label = 'body') {
  if (value === null || typeof value === 'string' ||
    typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!numberIsFinite(value)) fail(`${label} contains a non-finite number.`)
    return value
  }
  if (typeof value !== 'object') {
    fail(`${label} contains non-JSON data.`)
  }
  if (seen.has(value)) fail(`${label} contains a cycle.`)
  seen.add(value)

  const descriptors = objectGetOwnPropertyDescriptors(value)
  const ownKeys = reflectOwnKeys(value)
  let snapshot
  if (arrayIsArray(value)) {
    if (objectGetPrototypeOf(value) !== arrayPrototype) {
      fail(`${label} has a non-standard array prototype.`)
    }
    const expected = Array.from(
      { length: value.length },
      (_, index) => String(index),
    ).concat('length')
    if (JSON.stringify(ownKeys) !== JSON.stringify(expected)) {
      fail(`${label} must be a dense plain array.`)
    }
    snapshot = []
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[index]
      if (!descriptor || !objectHasOwn(descriptor, 'value') ||
        descriptor.enumerable !== true) {
        fail(`${label}[${index}] must be an enumerable data field.`)
      }
      snapshot.push(snapshotData(
        descriptor.value,
        seen,
        `${label}[${index}]`,
      ))
    }
  } else {
    if (objectGetPrototypeOf(value) !== objectPrototype) {
      fail(`${label} must be a plain object.`)
    }
    snapshot = {}
    for (const key of ownKeys) {
      if (typeof key !== 'string') fail(`${label} must not have symbol keys.`)
      const descriptor = descriptors[key]
      if (!descriptor || !objectHasOwn(descriptor, 'value') ||
        descriptor.enumerable !== true) {
        fail(`${label}.${key} must be an enumerable data field.`)
      }
      snapshot[key] = snapshotData(
        descriptor.value,
        seen,
        `${label}.${key}`,
      )
    }
  }
  seen.delete(value)
  return snapshot
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const key of reflectOwnKeys(value)) deepFreeze(value[key])
    objectFreeze(value)
  }
  return value
}

function configuredNames(values, label) {
  const snapshot = snapshotData(values, new Set(), label)
  if (!arrayIsArray(snapshot) || snapshot.length < 1 ||
    snapshot.some((value) => typeof value !== 'string' || !value.trim()) ||
    new Set(snapshot).size !== snapshot.length) {
    fail(`${label} must contain unique non-empty strings.`)
  }
  return objectFreeze(snapshot.slice())
}

function toolNames(tools, label, commitToolName) {
  if (!arrayIsArray(tools) || tools.length < 1) {
    fail(`${label} must be a non-empty array.`)
  }
  return tools.map((tool, index) => {
    if (!tool || typeof tool !== 'object' || arrayIsArray(tool)) {
      fail(`${label}[${index}] must be an object.`)
    }
    exactKeys(tool, [
      'description',
      'name',
      'parameters',
      'strict',
      'type',
    ], `${label}[${index}]`)
    if (tool.type !== 'function' || typeof tool.name !== 'string' ||
      !tool.name.trim() || typeof tool.description !== 'string' ||
      !tool.description.trim() || !tool.parameters ||
      typeof tool.parameters !== 'object' || arrayIsArray(tool.parameters) ||
      tool.strict !== (tool.name === commitToolName)) {
      fail(`${label}[${index}] differs from the function-tool contract.`)
    }
    return tool.name
  })
}

export function validateOpenAIResponsesAnswerWire({
  body,
  commitToolName,
  expectedMaxOutputTokens,
  model,
  normalToolNames,
} = {}) {
  if (typeof model !== 'string' || !model.trim()) {
    fail('model configuration must be a non-empty string.')
  }
  if (typeof commitToolName !== 'string' || !commitToolName.trim()) {
    fail('commitToolName must be a non-empty string.')
  }
  if (!numberIsSafeInteger(expectedMaxOutputTokens) ||
    expectedMaxOutputTokens < 1) {
    fail('expectedMaxOutputTokens must be a positive safe integer.')
  }
  const expectedNormalNames = configuredNames(
    normalToolNames,
    'normalToolNames',
  )
  if (expectedNormalNames.at(-1) !== commitToolName) {
    fail('normalToolNames must end with the commitment tool.')
  }

  const snapshot = snapshotData(body)
  const hasTools = objectHasOwn(snapshot, 'tools')
  exactKeys(snapshot, [
    'include',
    'input',
    'instructions',
    'max_output_tokens',
    'model',
    'parallel_tool_calls',
    'reasoning',
    'store',
    'tool_choice',
    ...(hasTools ? ['tools'] : []),
  ], 'body')
  if (snapshot.model !== model || snapshot.store !== false ||
    snapshot.parallel_tool_calls !== false ||
    snapshot.max_output_tokens !== expectedMaxOutputTokens) {
    fail('common model, storage, serial-tool, or output fields changed.')
  }
  if (!arrayIsArray(snapshot.include) || snapshot.include.length !== 1 ||
    snapshot.include[0] !== 'reasoning.encrypted_content') {
    fail('include must contain only reasoning.encrypted_content.')
  }
  exactKeys(snapshot.reasoning, ['effort'], 'reasoning')
  if (snapshot.reasoning.effort !== 'low') {
    fail('reasoning effort must remain low.')
  }

  let mode
  if (snapshot.tool_choice === 'auto') {
    if (!hasTools || jsonStringify(toolNames(
      snapshot.tools,
      'tools',
      commitToolName,
    )) !== jsonStringify(expectedNormalNames)) {
      fail('normal tools differ from the frozen ordered surface.')
    }
    mode = 'normal'
  } else if (snapshot.tool_choice === 'none') {
    if (hasTools) fail('plain terminal mode must omit tools.')
    mode = 'plain-terminal'
  } else {
    if (!snapshot.tool_choice || typeof snapshot.tool_choice !== 'object' ||
      arrayIsArray(snapshot.tool_choice)) {
      fail('tool_choice is not an accepted mode.')
    }
    exactKeys(snapshot.tool_choice, ['name', 'type'], 'tool_choice')
    if (snapshot.tool_choice.type !== 'function' ||
      snapshot.tool_choice.name !== commitToolName) {
      fail('forced mode must select the exact commitment function.')
    }
    if (!hasTools || snapshot.tools.length !== 1 ||
      jsonStringify(toolNames(snapshot.tools, 'tools', commitToolName)) !==
        jsonStringify([commitToolName])) {
      fail('forced mode must expose only the commitment function.')
    }
    mode = 'forced-commit'
  }

  deepFreeze(snapshot)
  const bodyText = jsonStringify(snapshot)
  return objectFreeze({ body: snapshot, bodyText, mode })
}

export function createOpenAIResponsesAnswerWireGate({
  commitToolName,
  dispatch,
  expectedMaxOutputTokens,
  model,
  normalToolNames,
  reserve,
} = {}) {
  if (typeof reserve !== 'function' || typeof dispatch !== 'function') {
    fail('gate requires reserve and dispatch functions.')
  }
  const configuration = objectFreeze({
    commitToolName,
    expectedMaxOutputTokens,
    model,
    normalToolNames: configuredNames(normalToolNames, 'normalToolNames'),
  })
  return async function invokeOpenAIResponsesAnswer(body) {
    const wire = validateOpenAIResponsesAnswerWire({
      body,
      ...configuration,
    })
    const reservation = await reserve(wire)
    return dispatch(objectFreeze({ ...wire, reservation }))
  }
}
