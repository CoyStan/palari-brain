# BRN-0006 Reviewer Note

Reviewer: Codex, fresh independent reviewer
Reviewed commit(s): `7ef42f1..c5753ab` (`main...HEAD`)
Target branch: `main`

## Review Result

Pass. The committed implementation satisfies the ticket's R2 contract and is
ready for founder acceptance. No provider, credential, dataset, private result,
or network access was used in this review.

## Findings

- none.

## Verification Reviewed

- Confirmed the worktree is on
  `ticket/BRN-0006-bound-memory-retrieval-loops-with-graceful-finalization` at
  committed HEAD `c5753ab8950d4a399fe43abf655dc96218f86a26`, with target
  `main` at `7ef42f16e7f3b3ff377d6aeaedd2525921cf653a`.
- Inspected every committed path and the complete `main...HEAD` diff. All ten
  changed paths are allowed by the ticket; none is forbidden. The actual risk
  remains R2: this is a bounded cross-file answer-loop behavior change, with no
  storage, admission, ranking, embedding, provider-selection, dataset, or live
  execution expansion.
- Acceptance criterion 1 passes. `DEFAULT_RETRIEVAL_CALLS` is four;
  `answerWithRetrieval` rejects any higher public value, exposes the selected
  budget to the provider, and closes over its own counter. The single host
  callback checks the counter before dispatching any of `memory_search`,
  `memory_find`, `memory_read`, `memory_timeline`, or `memory_graph`, so calls
  1-4 share one budget and a fifth returns
  `retrieval_budget_exhausted` without executing a memory operation. Provider
  mutation cannot raise the closed-over host budget.
- Acceptance criteria 2 and 3 pass. The OpenAI adapter returns ordinary text
  immediately after zero through three retrieval calls. Once the fourth
  successful call returns, it makes exactly one following dispatch with no
  `tools` field and `tool_choice: "none"`. The final request retains the
  provider's non-empty answer verbatim and instructs it to answer from already
  consulted canonical evidence or state that stored evidence is insufficient;
  it explicitly distinguishes missing evidence from proof of nonoccurrence.
- Acceptance criterion 4 passes. A response containing more calls than remain
  is rejected before any of those calls executes. Once finalization starts, a
  function call raises stable `OPENAI_FINALIZATION_TOOL_CALL`; tools are never
  restored. The common completed-output, refusal, and text validators reject
  malformed, refused, incomplete, and empty finalization responses with stable
  adapter errors.
- Acceptance criterion 5 passes. Each continuation appends a clone of the
  complete prior Responses `output` array in provider order and then the
  host-owned function outputs in call order. The four-call contract asserts
  that all four encrypted reasoning items and all four tool outputs reach
  finalization. Request construction retains `store: false`,
  `parallel_tool_calls: false`, low reasoning, and
  `reasoning.encrypted_content`; the transport remains one physical request
  per invocation with no retry and keeps the key only in the Authorization
  header.
- Acceptance criterion 6 passes. `docs/BRAIN-API.md` and
  `docs/CONSUMER-SEAM.md` distinguish the four-call product policy, early
  answers, one tool-disabled finalization, honest evidence insufficiency, and
  the separate seven-dispatch emergency ceiling. `docs/DECISIONS.md` records
  founder authority and the offline-only boundary without claiming four is a
  universal optimum.
- Acceptance criterion 7 passes on independently rerun provider-free evidence:
  focused contracts 26/26; full suite 667 passed, 0 failed, 15 skipped across
  682 tests; quickstart 6/6; repository ticket lint, committed-plus-dirty scope
  check, and `git diff --check main...HEAD` all pass. The human report and
  STATUS accurately describe the implementation and keep any live successor
  behind a separate founder gate.
- The change is generic rather than fitted to the sealed BRN-0005 question:
  enforcement is by aggregate tool count and adapter state, tests use synthetic
  tea/timeline/search fixtures, and no benchmark identity, answer text, private
  transcript, retrieval ranking, or memory contents enter the implementation.

## Required Changes

- none.

## Recommendation

Recommend `accept`. This recommendation does not itself accept, merge, push,
publish, authorize cleanup, or authorize a live provider run.
