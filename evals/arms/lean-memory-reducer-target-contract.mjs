// Successor-only clarification of the lean reducer's target semantics.
//
// The v1 contract and repair modules are frozen by the prepared J4 navigation
// v3 identity, so this module composes them without changing their bytes. It
// makes one previously implicit rule mechanical:
//
//   - `targets` contains prior-memory aliases only (`prior[].ref`);
//   - current evidence is never a target;
//   - `supersede` replaces exactly one same-speaker, same-topic prior item;
//   - without one eligible prior item, the operation is `add` with `targets: []`.
//
// The host still uses the frozen v1 normalizer as the final authority. This
// successor adds an earlier, more informative target check and one repair turn
// that returns all target objections at once.

import {
  markReducerFailureTerminal,
} from '../../src/index.mjs'
import {
  LEAN_MEMORY_REDUCER_MODEL,
  LeanMemoryReducerContractError,
  buildLeanMemoryReducerInput,
  normalizeLeanMemoryReducerProposal,
} from './lean-memory-reducer-contract.mjs'
import {
  LEAN_MEMORY_REDUCER_CLARIFIED_SYSTEM_INSTRUCTION,
  buildClarifiedLeanMemoryReducerGeminiBody,
} from './lean-memory-reducer-instructions.mjs'
import {
  DEFAULT_LEAN_MEMORY_REDUCER_REPAIRS,
  LEAN_MEMORY_REDUCER_REPAIR_INSTRUCTION,
  LeanMemoryReducerEmptyResponseError,
  isEmptyProviderResponse,
  isRepairableRejection,
  responseText,
} from './lean-memory-reducer-repair.mjs'

export const TARGET_AWARE_LEAN_MEMORY_REDUCER_VERSION =
  'palari-lean-memory-proposal/v2-targets'

export const TARGET_AWARE_LEAN_MEMORY_REDUCER_SYSTEM_INSTRUCTION = [
  LEAN_MEMORY_REDUCER_CLARIFIED_SYSTEM_INSTRUCTION,
  'The only legal target values are refs copied exactly from prior[].ref; never use a topic, field name, evidence ref, or free text as a target.',
  'Current evidence is not prior memory and cannot be targeted.',
  'Use supersede only when the dialogue corrects exactly one supplied prior item with the same speaker and topic.',
  'If one dialogue update corrects several prior items, return one separate supersede action per prior ref.',
].join('\n')

function normalizedTopic(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()
}

function parsedObject(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload
  }
  if (typeof payload !== 'string') return null
  try {
    const parsed = JSON.parse(payload)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null
  } catch {
    return null
  }
}

export function targetContractFor(request) {
  const input = buildLeanMemoryReducerInput(request)
  return {
    addTargets: [],
    currentEvidenceTargetable: false,
    priorTargets: input.prior.map(({ ref, speaker, topic }) => ({
      ref,
      speaker,
      topic,
    })),
    supersedeTargetCount: 1,
    targetValueSource: 'prior[].ref',
  }
}

export function buildTargetAwareLeanMemoryReducerGeminiBody(request) {
  const body = buildClarifiedLeanMemoryReducerGeminiBody(request)
  const input = JSON.parse(body.contents[0].parts[0].text)
  return {
    ...body,
    contents: [{
      parts: [{
        text: JSON.stringify({
          ...input,
          contractVersion: TARGET_AWARE_LEAN_MEMORY_REDUCER_VERSION,
          targetContract: targetContractFor(request),
        }),
      }],
      role: 'user',
    }],
    systemInstruction: {
      parts: [{
        text: TARGET_AWARE_LEAN_MEMORY_REDUCER_SYSTEM_INSTRUCTION,
      }],
    },
  }
}

function evidenceSpeaker(action, evidenceByRef) {
  if (!Array.isArray(action?.evidenceRefs) ||
    action.evidenceRefs.length === 0) {
    return null
  }
  const entries = action.evidenceRefs.map((ref) => evidenceByRef.get(ref))
  if (entries.some((entry) => !entry)) return null
  const speakers = new Set(entries.map((entry) => entry.speaker))
  return speakers.size === 1 ? [...speakers][0] : null
}

function eligiblePriorRefs(action, input) {
  const evidenceByRef = new Map(
    input.evidence.map((entry) => [entry.ref, entry]),
  )
  const speaker = evidenceSpeaker(action, evidenceByRef)
  const topic = typeof action?.topic === 'string'
    ? normalizedTopic(action.topic)
    : ''
  if (!speaker || !topic) return []
  return input.prior
    .filter((entry) =>
      entry.speaker === speaker &&
      normalizedTopic(entry.topic) === topic)
    .map((entry) => entry.ref)
}

function quoted(value) {
  return JSON.stringify(String(value ?? ''))
}

export function targetContractObjections(payload, request) {
  const parsed = parsedObject(payload)
  if (!Array.isArray(parsed?.actions)) return []
  const input = buildLeanMemoryReducerInput(request)
  const objections = []

  for (const [index, action] of parsed.actions.entries()) {
    if (!action || typeof action !== 'object' || Array.isArray(action) ||
      !Array.isArray(action.targets)) {
      continue
    }
    const label = `actions[${index}]`
    if (action.op === 'add' && action.targets.length !== 0) {
      objections.push(
        `${label}: add requires targets []; current evidence is not targetable.`,
      )
      continue
    }
    if (action.op !== 'supersede') continue

    const eligible = eligiblePriorRefs(action, input)
    const exactEligibleTarget =
      action.targets.length === 1 &&
      eligible.includes(action.targets[0])
    if (exactEligibleTarget) continue

    const speaker = evidenceSpeaker(
      action,
      new Map(input.evidence.map((entry) => [entry.ref, entry])),
    )
    if (eligible.length === 0 && speaker && normalizedTopic(action.topic)) {
      objections.push(
        `${label}: no supplied prior ref matches topic ` +
        `${quoted(action.topic)} and speaker ${quoted(speaker)}; use add ` +
        'with targets []. Current evidence is not targetable.',
      )
      continue
    }
    if (eligible.length === 0) {
      objections.push(
        `${label}: supersede requires exactly one ref copied from ` +
        'prior[].ref; never use a topic, field name, evidence ref, or free ' +
        'text as a target.',
      )
      continue
    }
    objections.push(
      `${label}: supersede requires exactly one ref copied from prior[].ref; ` +
      `eligible refs are ${JSON.stringify(eligible)}. Never use a topic, ` +
      'field name, evidence ref, or free text as a target.',
    )
  }

  return objections
}

export function normalizeTargetAwareLeanMemoryReducerProposal(
  payload,
  request,
) {
  const objections = targetContractObjections(payload, request)
  if (objections.length) {
    throw new LeanMemoryReducerContractError(
      `Target contract violations: ${objections.join(' ')}`,
    )
  }
  return normalizeLeanMemoryReducerProposal(payload, request)
}

export function buildTargetAwareLeanMemoryReducerRepairBody({
  rejectedText,
  rejection,
  request,
}) {
  const body = buildTargetAwareLeanMemoryReducerGeminiBody(request)
  const input = JSON.parse(body.contents[0].parts[0].text)
  return {
    ...body,
    contents: [{
      parts: [{
        text: JSON.stringify({
          ...input,
          rejectedResponse: String(rejectedText ?? ''),
          rejection: {
            instruction: LEAN_MEMORY_REDUCER_REPAIR_INSTRUCTION,
            reason: String(rejection ?? ''),
          },
        }),
      }],
      role: 'user',
    }],
  }
}

export function createTargetAwareRepairingLeanMemoryReducer({
  invoke,
  maxRepairs = DEFAULT_LEAN_MEMORY_REDUCER_REPAIRS,
  onRepair,
} = {}) {
  if (typeof invoke !== 'function') {
    throw new TypeError(
      'createTargetAwareRepairingLeanMemoryReducer requires invoke.',
    )
  }
  if (!Number.isSafeInteger(maxRepairs) || maxRepairs < 0) {
    throw new TypeError('maxRepairs must be a non-negative safe integer.')
  }

  return async ({ request, unit }) => {
    async function dispatch(body, attempt) {
      let response
      try {
        response = await invoke({
          attempt,
          body,
          model: LEAN_MEMORY_REDUCER_MODEL,
          unit,
        })
      } catch (error) {
        throw markReducerFailureTerminal(error)
      }
      if (isEmptyProviderResponse(response)) {
        throw markReducerFailureTerminal(
          new LeanMemoryReducerEmptyResponseError(
            `The provider returned an empty body on attempt ${attempt}.`,
          ),
        )
      }
      return responseText(response)
    }

    let body = buildTargetAwareLeanMemoryReducerGeminiBody(request)
    let attempt = 0
    for (;;) {
      const text = await dispatch(body, attempt)
      try {
        return normalizeTargetAwareLeanMemoryReducerProposal(text, request)
      } catch (error) {
        if (attempt >= maxRepairs || !isRepairableRejection(error)) throw error
        onRepair?.({
          attempt,
          rejection: error.message,
          unit,
        })
        body = buildTargetAwareLeanMemoryReducerRepairBody({
          rejectedText: text,
          rejection: error.message,
          request,
        })
        attempt += 1
      }
    }
  }
}
