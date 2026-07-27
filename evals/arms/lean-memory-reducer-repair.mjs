// One host-guided repair turn for a rejected memory proposal.
//
// WHY THIS EXISTS
//
// The host validates every reducer proposal strictly and fails closed. That
// is correct and it is the reason a Palari memory can be trusted. But the
// combination of strict validation, fail-closed, and one dispatch per logical
// operation means any deviation by the model — including a one-character
// paraphrase in a quote — is terminal. The model is never told what it got
// wrong, because the run is already over.
//
// Nine terminal live identities died that way. Every rejection message the
// host produces already names the exact offending field
// (`actions[0].timeQuote is not an exact contiguous quote from its
// evidence.`). Nothing was missing except a wire back to the model.
//
// WHAT THIS IS NOT
//
// It is not a retry. A retry re-sends an identical request and hopes for a
// different outcome, which is how a bad number becomes a re-roll. A repair
// sends a DIFFERENT request: the original, plus what the model returned, plus
// the host's specific objection. It is a second logical operation and it is
// metered as one — `invoke` receives an `attempt` so the caller derives a
// distinct operation identity rather than reusing one.
//
// Provenance is unchanged. The repaired proposal goes through exactly the
// same `normalizeLeanMemoryReducerProposal` as the first one: the model still
// cannot author an ID, a scope, a speaker, a timestamp, or a deletion, and
// every quote is still checked as an exact contiguous substring. A repair
// turn buys the model a second chance to be right; it never lowers the bar
// for what counts as right.
//
// Not wired into any frozen run identity. `evals/arms/
// lean-memory-reducer-contract.mjs` is hash-pinned by the authorized
// `j4-journal-navigation-longmemeval-q1-v2` contract and was deliberately
// left untouched. A successor identity opts into this module explicitly.

import {
  markReducerFailureTerminal,
} from '../../src/index.mjs'
import {
  buildLeanMemoryReducerGeminiBody,
  LEAN_MEMORY_REDUCER_MODEL,
  normalizeLeanMemoryReducerProposal,
} from './lean-memory-reducer-contract.mjs'

export const LEAN_MEMORY_REDUCER_REPAIR_VERSION =
  'palari-lean-memory-repair/v1'

export const DEFAULT_LEAN_MEMORY_REDUCER_REPAIRS = 1

export class LeanMemoryReducerEmptyResponseError extends Error {
  constructor(message) {
    super(message)
    this.name = 'LeanMemoryReducerEmptyResponseError'
    this.code = 'LEAN_REDUCER_EMPTY_RESPONSE'
  }
}

// A successful HTTP response with no body is not a proposal, and it is not a
// decision to remember nothing — `{"actions": []}` is how a model says that.
// It is a provider fault with nothing in it to correct, so it is classified
// rather than repaired. Repairing it would mean re-sending a request the
// provider already accepted, which is the retry the meter forbids.
export function responseText(response) {
  if (typeof response === 'string') return response
  if (response && typeof response === 'object') {
    if (typeof response.text === 'string') return response.text
  }
  return ''
}

export function isEmptyProviderResponse(response) {
  return responseText(response).trim() === ''
}

export function isRepairableRejection(error) {
  return error?.code === 'LEAN_REDUCER_PROPOSAL_INVALID'
}

export const LEAN_MEMORY_REDUCER_REPAIR_INSTRUCTION = [
  'The host rejected your previous response and stored nothing.',
  'Return the corrected JSON object only.',
  'Quotes must be copied character-for-character from the supplied evidence text: do not paraphrase, trim, re-punctuate, or supply anything that was not said.',
].join(' ')

// The correction turn, as a SINGLE user turn.
//
// The obvious shape for a correction is a three-turn exchange: original
// request, the model's rejected output as a `model` turn, then the objection.
// The metered transport refuses it — `assertRequestBody` requires
// `contents.length === 1` for a writer dispatch, so a multi-turn repair dies
// at `REQUEST_SCHEMA_INVALID` before it ever reaches the provider.
//
// So the objection rides inside the request document instead, as two extra
// keys on the same JSON the model already knows how to read. Same one turn,
// same generation config, same system instruction, same `store: false`. This
// module is therefore adoptable by a successor identity without editing the
// hash-pinned transport, which is the whole point.
export function buildLeanMemoryReducerRepairBody({
  buildBody = buildLeanMemoryReducerGeminiBody,
  rejectedText,
  rejection,
  request,
}) {
  const body = buildBody(request)
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

export function createRepairingLeanMemoryReducer({
  // The system instruction is the one part of the request a caller may need
  // to correct without touching the host's rules. Defaults to the frozen v1
  // contract so an existing caller is byte-identical; a caller that has
  // learned something about the model — see
  // `lean-memory-reducer-instructions.mjs` — supplies its own.
  buildBody = buildLeanMemoryReducerGeminiBody,
  invoke,
  maxRepairs = DEFAULT_LEAN_MEMORY_REDUCER_REPAIRS,
  onRepair,
} = {}) {
  if (typeof invoke !== 'function') {
    throw new TypeError('createRepairingLeanMemoryReducer requires invoke.')
  }
  if (typeof buildBody !== 'function') {
    throw new TypeError('buildBody must be a function.')
  }
  if (!Number.isSafeInteger(maxRepairs) || maxRepairs < 0) {
    throw new TypeError('maxRepairs must be a non-negative safe integer.')
  }

  return async ({ request, unit }) => {
    // Transport, authentication, and provider-response faults belong to the
    // adapter as a whole rather than to one dialogue interaction, so they end
    // the drain instead of manufacturing a quarantined fact. Unchanged from
    // the non-repairing reducer.
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

    let body = buildBody(request)
    let attempt = 0
    for (;;) {
      const text = await dispatch(body, attempt)
      try {
        return normalizeLeanMemoryReducerProposal(text, request)
      } catch (error) {
        if (attempt >= maxRepairs || !isRepairableRejection(error)) throw error
        onRepair?.({
          attempt,
          rejection: error.message,
          unit,
        })
        body = buildLeanMemoryReducerRepairBody({
          buildBody,
          rejectedText: text,
          rejection: error.message,
          request,
        })
        attempt += 1
      }
    }
  }
}
