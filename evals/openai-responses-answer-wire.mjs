// Provider-free validation for the exact OpenAI Responses answer wires emitted
// by Palari's Luna adapter. Every returned request value has a null prototype,
// is deeply frozen, and is independent of caller objects and mutable built-ins.

import { createHash } from 'node:crypto'

const arrayIsArray = Array.isArray
const arrayPrototype = Array.prototype
const jsonStringify = JSON.stringify
const numberIsFinite = Number.isFinite
const numberIsSafeInteger = Number.isSafeInteger
const objectCreate = Object.create
const objectFreeze = Object.freeze
const objectGetOwnPropertyDescriptors = Object.getOwnPropertyDescriptors
const objectGetPrototypeOf = Object.getPrototypeOf
const objectHasOwn = Object.hasOwn
const objectIsFrozen = Object.isFrozen
const objectPrototype = Object.prototype
const objectSetPrototypeOf = Object.setPrototypeOf
const reflectOwnKeys = Reflect.ownKeys
const stringTrim = Function.prototype.call.bind(String.prototype.trim)
const hashProbe = createHash('sha256')
const hashDigest = Function.prototype.call.bind(hashProbe.digest)
const hashUpdate = Function.prototype.call.bind(hashProbe.update)

function fail(message) {
  throw new TypeError(`OpenAI answer wire: ${message}`)
}

function nullArray() {
  return objectSetPrototypeOf([], null)
}

function nullRecord() {
  return objectCreate(null)
}

function record(entries) {
  const value = nullRecord()
  for (let index = 0; index < entries.length; index += 1) {
    value[entries[index][0]] = entries[index][1]
  }
  return value
}

function containsString(values, wanted) {
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === wanted) return true
  }
  return false
}

function sameStrings(left, right) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function exactKeys(value, expected, label) {
  const actual = reflectOwnKeys(value)
  if (actual.length !== expected.length) {
    fail(`${label} fields differ from the frozen contract.`)
  }
  for (let index = 0; index < actual.length; index += 1) {
    if (typeof actual[index] !== 'string' ||
      !containsString(expected, actual[index])) {
      fail(`${label} fields differ from the frozen contract.`)
    }
  }
}

function seenContains(seen, value) {
  for (let index = 0; index < seen.length; index += 1) {
    if (seen[index] === value) return true
  }
  return false
}

function snapshotData(value, seen = nullArray(), label = 'body') {
  if (value === null || typeof value === 'string' ||
    typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!numberIsFinite(value)) fail(`${label} contains a non-finite number.`)
    return value
  }
  if (typeof value !== 'object') fail(`${label} contains non-JSON data.`)
  if (seenContains(seen, value)) fail(`${label} contains a cycle.`)
  seen[seen.length] = value

  const descriptors = objectGetOwnPropertyDescriptors(value)
  const ownKeys = reflectOwnKeys(value)
  let snapshot
  if (arrayIsArray(value)) {
    if (objectGetPrototypeOf(value) !== arrayPrototype) {
      fail(`${label} has a non-standard array prototype.`)
    }
    const lengthDescriptor = descriptors.length
    const length = lengthDescriptor?.value
    if (!numberIsSafeInteger(length) || length < 0 ||
      ownKeys.length !== length + 1) {
      fail(`${label} must be a dense plain array.`)
    }
    for (let index = 0; index < length; index += 1) {
      if (ownKeys[index] !== `${index}`) {
        fail(`${label} must be a dense plain array.`)
      }
    }
    if (ownKeys[length] !== 'length') {
      fail(`${label} must be a dense plain array.`)
    }
    snapshot = nullArray()
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[index]
      if (!descriptor || !objectHasOwn(descriptor, 'value') ||
        descriptor.enumerable !== true) {
        fail(`${label}[${index}] must be an enumerable data field.`)
      }
      snapshot[index] = snapshotData(
        descriptor.value,
        seen,
        `${label}[${index}]`,
      )
    }
  } else {
    if (objectGetPrototypeOf(value) !== objectPrototype) {
      fail(`${label} must be a plain object.`)
    }
    snapshot = nullRecord()
    for (let index = 0; index < ownKeys.length; index += 1) {
      const key = ownKeys[index]
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
  seen.length -= 1
  return snapshot
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value
  const descriptors = objectGetOwnPropertyDescriptors(value)
  const keys = reflectOwnKeys(value)
  for (let index = 0; index < keys.length; index += 1) {
    const descriptor = descriptors[keys[index]]
    if (descriptor && objectHasOwn(descriptor, 'value')) {
      deepFreeze(descriptor.value)
    }
  }
  return objectFreeze(value)
}

function configuredNames(values, label) {
  const snapshot = arrayIsArray(values) &&
    objectGetPrototypeOf(values) === null && objectIsFrozen(values)
    ? values
    : snapshotData(values, nullArray(), label)
  if (!arrayIsArray(snapshot) || snapshot.length < 1) {
    fail(`${label} must contain unique non-empty strings.`)
  }
  for (let index = 0; index < snapshot.length; index += 1) {
    if (typeof snapshot[index] !== 'string' ||
      !stringTrim(snapshot[index])) {
      fail(`${label} must contain unique non-empty strings.`)
    }
    for (let prior = 0; prior < index; prior += 1) {
      if (snapshot[prior] === snapshot[index]) {
        fail(`${label} must contain unique non-empty strings.`)
      }
    }
  }
  return deepFreeze(snapshot)
}

function configuredHash(value, label) {
  if (typeof value !== 'string' || value.length !== 64) {
    fail(`${label} must be a lowercase SHA-256 string.`)
  }
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (!((character >= '0' && character <= '9') ||
      (character >= 'a' && character <= 'f'))) {
      fail(`${label} must be a lowercase SHA-256 string.`)
    }
  }
  return value
}

function sha256Text(value) {
  const hash = createHash('sha256')
  hashUpdate(hash, value)
  return hashDigest(hash, 'hex')
}

function surfaceSha256FromSnapshot(tools) {
  return sha256Text(jsonStringify(tools))
}

export function openAIResponsesToolSurfaceSha256(tools) {
  const snapshot = snapshotData(tools, nullArray(), 'tools')
  if (!arrayIsArray(snapshot) || snapshot.length < 1) {
    fail('tools must be a non-empty array.')
  }
  return surfaceSha256FromSnapshot(snapshot)
}

function toolNames(tools, label, commitToolName) {
  if (!arrayIsArray(tools) || tools.length < 1) {
    fail(`${label} must be a non-empty array.`)
  }
  const names = nullArray()
  for (let index = 0; index < tools.length; index += 1) {
    const tool = tools[index]
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
      !stringTrim(tool.name) || typeof tool.description !== 'string' ||
      !stringTrim(tool.description) || !tool.parameters ||
      typeof tool.parameters !== 'object' || arrayIsArray(tool.parameters) ||
      tool.strict !== (tool.name === commitToolName)) {
      fail(`${label}[${index}] differs from the function-tool contract.`)
    }
    names[index] = tool.name
  }
  return names
}

export function validateOpenAIResponsesAnswerWire({
  body,
  commitToolName,
  expectedForcedToolsSha256,
  expectedMaxOutputTokens,
  expectedNormalToolsSha256,
  model,
  normalToolNames,
} = {}) {
  if (typeof model !== 'string' || !stringTrim(model)) {
    fail('model configuration must be a non-empty string.')
  }
  if (typeof commitToolName !== 'string' || !stringTrim(commitToolName)) {
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
  if (expectedNormalNames[expectedNormalNames.length - 1] !== commitToolName) {
    fail('normalToolNames must end with the commitment tool.')
  }
  const normalSurfaceHash = configuredHash(
    expectedNormalToolsSha256,
    'expectedNormalToolsSha256',
  )
  const forcedSurfaceHash = configuredHash(
    expectedForcedToolsSha256,
    'expectedForcedToolsSha256',
  )

  const snapshot = snapshotData(body)
  const hasTools = objectHasOwn(snapshot, 'tools')
  const expectedBodyKeys = nullArray()
  const commonBodyKeys = [
    'include',
    'input',
    'instructions',
    'max_output_tokens',
    'model',
    'parallel_tool_calls',
    'reasoning',
    'store',
    'tool_choice',
  ]
  for (let index = 0; index < commonBodyKeys.length; index += 1) {
    expectedBodyKeys[index] = commonBodyKeys[index]
  }
  if (hasTools) expectedBodyKeys[expectedBodyKeys.length] = 'tools'
  exactKeys(snapshot, expectedBodyKeys, 'body')
  if (snapshot.model !== model || snapshot.store !== false ||
    snapshot.parallel_tool_calls !== false ||
    snapshot.max_output_tokens !== expectedMaxOutputTokens) {
    fail('common model, storage, serial-tool, or output fields changed.')
  }
  if (typeof snapshot.instructions !== 'string' ||
    !stringTrim(snapshot.instructions) || !arrayIsArray(snapshot.input) ||
    snapshot.input.length < 1) {
    fail('instructions and input must remain non-empty.')
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
    if (!hasTools || !sameStrings(
      toolNames(snapshot.tools, 'tools', commitToolName),
      expectedNormalNames,
    ) || surfaceSha256FromSnapshot(snapshot.tools) !== normalSurfaceHash) {
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
    const forcedNames = toolNames(snapshot.tools, 'tools', commitToolName)
    if (!hasTools || snapshot.tools.length !== 1 ||
      forcedNames[0] !== commitToolName ||
      surfaceSha256FromSnapshot(snapshot.tools) !== forcedSurfaceHash) {
      fail('forced mode must expose only the frozen commitment function.')
    }
    mode = 'forced-commit'
  }

  deepFreeze(snapshot)
  const bodyText = jsonStringify(snapshot)
  return deepFreeze(record([
    ['body', snapshot],
    ['bodyText', bodyText],
    ['mode', mode],
  ]))
}

export function createOpenAIResponsesAnswerWireGate({
  commitToolName,
  dispatch,
  expectedForcedToolsSha256,
  expectedMaxOutputTokens,
  expectedNormalToolsSha256,
  model,
  normalToolNames,
  reserve,
} = {}) {
  if (typeof reserve !== 'function' || typeof dispatch !== 'function') {
    fail('gate requires reserve and dispatch functions.')
  }
  const configuration = deepFreeze(record([
    ['commitToolName', commitToolName],
    ['expectedForcedToolsSha256', configuredHash(
      expectedForcedToolsSha256,
      'expectedForcedToolsSha256',
    )],
    ['expectedMaxOutputTokens', expectedMaxOutputTokens],
    ['expectedNormalToolsSha256', configuredHash(
      expectedNormalToolsSha256,
      'expectedNormalToolsSha256',
    )],
    ['model', model],
    ['normalToolNames', configuredNames(normalToolNames, 'normalToolNames')],
  ]))
  return async function invokeOpenAIResponsesAnswer(body) {
    const wire = validateOpenAIResponsesAnswerWire({ body, ...configuration })
    const reservation = await reserve(wire)
    const envelope = record([
      ['body', wire.body],
      ['bodyText', wire.bodyText],
      ['mode', wire.mode],
      ['reservation', reservation],
    ])
    return dispatch(objectFreeze(envelope))
  }
}
