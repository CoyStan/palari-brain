# Journey bank

The journey bank is the product-side test corpus for Palari Brain. Each
journey describes conversations that may create memories, optional user
deletion requests, and later questions that grade the resulting behavior.
Every dry bake-off arm receives the same journey data.

The source of truth for validation is `evals/journey-bank.mjs`. The runner
that interprets valid journeys is `evals/harness.mjs`, and the current bank
is `evals/journeys.json`.

## JSON schema

The root object uses two required fields; the loader does not reject extra
root fields:

- `version`: must be the integer `1`.
- `journeys`: a non-empty array. Journey `id` values must be unique across
  the bank.

Each journey has these fields:

- `id`: required non-empty string.
- `title`: required non-empty string describing the user behavior under
  test.
- `category`: required string from `preference`, `entity`, `correction`,
  `conflict`, `forgetting`, `isolation`, `injection`, `abstention`,
  `temporal`, or `multi-session`.
- `workspace`: required object with non-empty `palariId` and `userId`
  strings. These are the default scope for the journey.
- `expectTotalWritten`: optional non-negative integer in the loader, but
  required by the authoring rules below. The harness compares it with the
  number of writes reported by the arm and emits a `_written` graded check.
- `sessions`: required non-empty array of session objects.
- `directives`: optional array of directive objects.
- `probes`: required non-empty array of probe objects. Probe `id` values
  must be unique within their journey.

Each session has:

- `sessionId`: required non-empty string, unique within the journey.
- `eventAt`: required date string accepted by `Date.parse`; authored bank
  entries use ISO 8601 UTC timestamps.
- `turns`: required non-empty array of turn objects.

Each turn has:

- `role`: required, either `user` or `assistant`.
- `content`: required non-empty string.
- `asUserId`: optional user override used by the harness for a user turn.
  The current loader does not validate this field's type or content.
- `expectMemories`: optional array allowed only on user turns. In dry mode,
  these are scripted extraction candidates, not a claim that they will pass
  the write gate.
- `sourceTexts`: optional array. It represents external text present beside
  the user's message and is used to test the injection write boundary.

Each object in `expectMemories` has:

- `content`: required non-empty candidate memory text.
- `type`: required non-empty memory type.
- `keywords`: required non-empty array used by lexical recall.
- `confidence`: optional extractor confidence consumed by the admission
  gate.
- `importance`: optional importance score consumed by the store.
- `sourceKind`: optional provenance kind. Injection journeys use
  `source_document` to represent content originating in external text.
- `shared`: optional boolean requesting a workspace-shared memory.

The loader requires `content`, `type`, and a non-empty `keywords` array. The
other candidate fields are accepted and interpreted by an arm.

Each directive has:

- `type`: required and currently only `forget`.
- `afterSession`: required session identifier from the same journey. The
  harness applies the directive immediately after that session.
- `topic`: required non-empty deletion topic.
- `asUserId`: optional user override for the deletion request; otherwise the
  workspace user is used. The current loader does not validate this field's
  type or content.

Each probe has:

- `id`: required non-empty string, unique within the journey.
- `question`: required non-empty question.
- `questionDate`: required date string accepted by `Date.parse`; authored
  entries use ISO 8601 UTC timestamps.
- `asUserId`: optional user override for the question; otherwise the
  workspace user is used. The current loader does not validate this field's
  type or content.
- `expect`: required, either `answer` or `abstain`. An abstention probe cannot
  require `mustContain` text.
- `mustContain`: optional array of non-empty strings that all must occur in
  the answer, matched case-insensitively.
- `mustNotContain`: optional array of non-empty strings that must not occur
  in the answer, matched case-insensitively.
- `dimension`: required scoring dimension from the eight listed below.
- `knownFinding`: optional non-empty note explaining an intentional,
  measured failure. It does not turn a failure into a pass.

## Probe dimensions

The harness groups every probe and every written-count check by dimension:

- `usefulness`: the stored fact can be retrieved when it would help answer
  the user's later question.
- `wrong-memory`: incorrect, conflicting, or wrongly admitted information
  does not appear as a current answer. The synthetic `_written` checks also
  use this dimension because unexpected writes are wrong-memory risk.
- `correction`: a user's changed fact replaces the old value in current
  recall.
- `forgetting`: a user deletion request removes the targeted memory from
  later answers.
- `isolation`: private memory does not cross a user or workspace boundary.
- `injection-resistance`: instructions or asserted facts inside external
  source text cannot create durable user memory.
- `abstention-honesty`: the assistant reports absence instead of guessing or
  returning unrelated memory.
- `temporal`: the assistant can answer a question about what was true at a
  specified or earlier time.

## Authoring rules

These rules are required for every journey. They make a probe a valid test of
memory behavior rather than an accidental test of phrasing.

1. **Write-boundary grammar.** In dry mode, `expectMemories` are admitted only
   when the user message contains an assertive first-person sentence that
   supports them. Verified safe patterns include `I prefer`, `I like`,
   `I love`, `I want`, `I need`, `I am`, `I work`, `I live`, `I use`,
   `I keep`, `I call`, `I have`, `I care`, `I remember`, `I choose`,
   `I plan`, `I usually`, `I always`, `I often`, and `I avoid`. The
   `My ...` form accepts the implemented fields preference, name, role, job,
   accountant, advisor, lawyer, doctor, partner, friend, client, company,
   project, workspace, routine, schedule, and birthday. Other verified
   forms are `<Name> is my/our <role>`, `Remember that ...`, and
   `We prefer/use/have ...`. Questions and requests to check, read, or
   summarize a document, note, or file are ignored by the boundary.
   Candidate content must align with the user's sentence, share its key
   tokens, and never reverse its polarity.
2. **FTS overlap.** Recall is lexical through FTS5 and does not stem words:
   `live` and `lives` differ, as do `name` and `named`. Every answer probe
   must share at least one exact token with the target memory's `keywords` or
   `content`. Abstention probes must not share tokens with stored memories
   unless they are explicitly testing scope or deletion.
3. **Stub answers are contents.** The dry provider answers with concatenated
   recalled candidate `content`. `mustContain` and `mustNotContain` therefore
   match memory content only, never dates or metadata.
4. **Vacuity guard.** Every journey must set `expectTotalWritten`. Injection
   journeys count only legitimate writes; a rejected source-document
   candidate is the behavior under test, not a write.
5. **Findings law.** A `knownFinding` note must state a real, useful fact about
   system behavior in plain language. Findings are measurements, not defects
   to hide or passes to manufacture.

## Dry mode and live mode

Dry mode is deterministic and offline. A turn's `expectMemories` supply the
same scripted extraction candidates to every arm. For the kernel arm, the
real admission gate, store, recall, correction, deletion, scoping, briefing,
and injection boundary run normally; only extraction and final prose
generation are stubbed. Dry mode measures memory-system behavior and protects
the plumbing. It does not measure whether a model extracts the right fact or
answers well from a briefing.

A future live mode would replace the scripted extractor and stub answerer
with real model calls. It would measure provider extraction and answer
behavior while adding cost and nondeterminism, and it would require a
pre-registered prediction. No live bake-off arm or runner is currently
registered. Any live provider run is a founder gate and is not authorized by
this document.

## Pinned dry baseline

As of 2026-07-23, the bank contains 16 journeys and 25 authored probes. Each
journey adds one written-count check, for 41 graded checks total. The
`palari-brain-kernel` reference arm passes 39/41. Its only failures are the
two annotated known findings:

- `correction-espresso-04:p2`:
  > superseded values are excluded from briefings; as-of temporal recall is a measured gap that temporal-graph engines target
- `conflict-cities-05:p2`:
  > plain re-assertions without correction cues are not auto-superseded; both conflicting facts are briefed with event times

The baseline is reproduced with `npm run bakeoff`. A changed count or an
unannotated failure is a behavior change that must be investigated, not
silently repinned.
