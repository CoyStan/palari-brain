// The reference vocabulary, stated out loud.
//
// WHAT THE PROBE FOUND
//
// The first live probe dispatch was rejected with
// `actions[0].targets[0] is unknown`, and so was its repair. The cause is not
// a model failure. The reducer input labels evidence `e0, e1, ...` and prior
// memory `m0, m1, ...`, and the host resolves `targets` ONLY against the
// prior map — but the system instruction never says either of those things.
// `targets` is typed in the provider schema as a bare array of strings with
// no constraint at all. The model was asked to name something it had never
// been told how to name.
//
// Worse, the probe scenario asked it to correct a fact that appeared in the
// CURRENT dialogue rather than in prior memory. That is not expressible: the
// grammar can only supersede something already in `prior`. There was no
// legal answer, so the model invented a token and the host rejected it.
//
// The semantic fix is smaller than it looks. If the superseded fact is in the
// same batch, it was never written to memory, so there is nothing to
// supersede — the model should simply add the final version and never mention
// the stale one. That needs no grammar change, only an instruction.
//
// WHY THIS MATTERS MORE THAN ONE PROBE
//
// Batched reduction sends up to twenty interactions in a single call. A user
// saying something and correcting it a few turns later therefore lands inside
// one batch most of the time, not across batches. On LongMemEval that is not
// an edge case, it is the benchmark. Any run that dispatches without these
// three lines will meet this rejection on real sessions.
//
// This module changes no rule the host enforces. It only tells the model what
// the host was already going to require.

import {
  buildLeanMemoryReducerInput,
  LEAN_MEMORY_REDUCER_GENERATION,
  LEAN_MEMORY_REDUCER_SYSTEM_INSTRUCTION,
} from './lean-memory-reducer-contract.mjs'

export const LEAN_MEMORY_REDUCER_INSTRUCTIONS_VERSION =
  'palari-lean-memory-instructions/v2'

export const LEAN_MEMORY_REDUCER_REFERENCE_RULES = Object.freeze([
  'Refer to things only by the exact "ref" values in the input: evidence refs are e0, e1, and so on; prior memory refs are m0, m1, and so on.',
  'evidenceRefs must contain evidence refs. targets must contain exactly one prior memory ref for supersede, and nothing for add.',
  'Never put an evidence ref, a statement, a topic, or any other identifier in targets, and never invent a ref that is not listed in the input.',
  'Supersede only a fact that appears under prior. If the current dialogue corrects something said earlier in the same current dialogue, that earlier version was never stored: add only the final version and leave targets empty.',
  'If nothing under prior covers the topic, use add.',
])

export const LEAN_MEMORY_REDUCER_CLARIFIED_SYSTEM_INSTRUCTION = [
  LEAN_MEMORY_REDUCER_SYSTEM_INSTRUCTION,
  ...LEAN_MEMORY_REDUCER_REFERENCE_RULES,
].join('\n')

// Same single-turn writer body the metered transport requires, same frozen
// generation config, same `store: false`. Only the system instruction differs.
export function buildClarifiedLeanMemoryReducerGeminiBody(request) {
  return {
    contents: [{
      parts: [{
        text: JSON.stringify(buildLeanMemoryReducerInput(request)),
      }],
      role: 'user',
    }],
    generationConfig: structuredClone(LEAN_MEMORY_REDUCER_GENERATION),
    store: false,
    systemInstruction: {
      parts: [{ text: LEAN_MEMORY_REDUCER_CLARIFIED_SYSTEM_INSTRUCTION }],
    },
  }
}
