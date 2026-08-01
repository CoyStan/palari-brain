# J4 simple harness

> Historical (July 2026). The two separate arms it prescribes were built
> and their live checks ran (see `evals/live-runs/`); the "do not run an
> integrated benchmark" rule in §C was later superseded — the active
> product path is the integrated one, and integrated identities were
> separately authorized and run. Kept as the design record of that stage.

This was the successor shape for testing Palari memory. It replaced one
integrated experiment with two questions that can fail independently.
Historical live runners remain sealed evidence; new work must not import or
resume them.

The immediate provider surface is objectively smaller: reducer calls no
longer expose nested provenance/disposition bookkeeping, and navigation calls
no longer expose provider-controlled result budgets or the reducer at all.
Those removed fields are pinned by contract tests. The host validation code
remains intentionally explicit because that is where trust belongs.

## A. Reducer compatibility

`evals/arms/lean-memory-reducer-contract.mjs` tests only whether a model can
propose useful digest changes. Its current generation contract is explicitly
bound to `gemini-2.5-flash-lite`; changing models requires a new frozen
configuration rather than silently reusing model-specific thinking controls.

The provider sees short aliases (`e0`, `m0`, …) and returns only `add` or
same-topic `supersede` proposals:

```json
{
  "actions": [{
    "op": "supersede",
    "targets": ["m0"],
    "topic": "milk preference",
    "statement": "The user prefers almond milk.",
    "epistemic": "asserted",
    "evidenceRefs": ["e0"],
    "evidenceQuotes": ["I switched to almond milk."],
    "timeEvidenceRef": "",
    "timeQuote": ""
  }]
}
```

It does not return revision, dispositions, durable IDs, scope, speaker,
source kind, time, deletion, or sharing fields. The host derives those and
expands the proposal into the existing product contract.

Lean v1 deliberately has no destructive summarization operation. Relatedness
between several old facts cannot be proved from a model label alone, so a
summary must not replace arbitrary same-speaker memories.

The provider schema deliberately omits conditional branches, nullable
objects, numeric bounds, item-count constraints, and nested evidence/memory
basis objects. The host still rejects:

- unknown or duplicate evidence and memory references;
- non-exact evidence quotes;
- mixed user/Palari authority;
- stale or different-topic supersession;
- repeated replacement of one target;
- action, basis, string, item, and rendered-character overflow;
- stale revision, deletion races, or reducer-identity drift.

A thrown provider/configuration/transport error is marked terminal and stops
the whole drain immediately. A returned but semantically invalid proposal
remains interaction-specific and may be isolated or quarantined. This
distinction prevents one global provider failure from creating hundreds of
false memory gaps.

The next live check, if separately authorized, should be a tiny compatibility
smoke only: new fact, valid `no_memory`, and correction. It is not a memory
benchmark.

## B. Journal navigation

`evals/arms/journal-navigation-arm.mjs` tests only whether an answer model can
navigate exact canonical memory.

It:

1. replays the selected dialogue through the normal canonical admission gate;
2. replaces raw dataset session labels with neutral chronological aliases,
   then verifies every stored byte, role, neutral source-message ID, and
   timestamp;
3. drains pending work with a deterministic local all-`no_memory` reducer;
4. asserts a ready, empty digest;
5. starts one answer session with three shallow tools:
   `memory_timeline({})`, `memory_find({ phrase })`, and
   `memory_read({ kind, ref })`.

There is no reducer-provider callback in this arm. Therefore a navigation
result cannot come from a model-written digest, a hidden canonical fallback,
or a hand-seeded query. Scope, deletion filtering, result sizes, and evidence
accounting stay in the host. The low-level fixture path rejects source IDs
that do not already use the neutral `session-NNN:turn` form. Session reads use
a fixed host-owned 200-message, 100,000-character configured budget, which
covers the 24-message LongMemEval session that exposed the earlier
default-limit bug. Every requested tool call, including an invalid or failed
one, consumes the six-attempt ceiling and remains in the returned result or
the propagated error's private audit. Catching a rejected seventh attempt
cannot validate an answer. The arm reports one logical answer session; the
future live meter, not this seam, must count its underlying HTTP dispatches.

The next live check, if separately authorized, should use this arm for one
LongMemEval question and let the model choose every phrase and session itself.
It must not receive the reference answer, an answer-bearing session ID, or an
operator-selected search phrase.

## C. Integrated behavior

Do not run an integrated reducer-plus-navigation benchmark merely because A
and B exist. First answer the two narrower questions:

- Can the provider satisfy the lean reducer contract?
- Can the answer model recover from an exact-search miss using the journal?

Only a later founder decision may authorize an integrated run. If either
component fails, its first honest result is the finding; do not tune or reroll
it until it passes.

## What remains trustworthy

The simplification removes model-authored bookkeeping and experimental
coupling, not evidence:

| Model may propose | Host remains authoritative |
| --- | --- |
| fact wording and topic | private user/Palari scope |
| asserted/uncertain/unknown | canonical speaker and source kind |
| add/same-topic supersede | exact quote membership and chronology |
| current evidence aliases | durable IDs and revision/CAS |
| prior-memory aliases | deletion, atomicity, and capacity |
| exact search phrase | consulted evidence IDs and call budget |

All live-run laws in `AGENTS.md` still apply: fresh identity, frozen
configuration and cost arithmetic, FINAL predictions before credential
access, private gitignored results, no rerolls, and a founder-approved cap.
This document grants no provider authority.
