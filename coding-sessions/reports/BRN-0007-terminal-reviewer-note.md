# BRN-0007 Terminal Reviewer Note

Reviewer: fresh independent terminal reviewer  
Reviewed commit: `78946085d44242e59aac869c3ed2bff0fd1d0fde`  
Target: `main` at `654157293a9a8b5610f677d00960cc3f620d3685`

## Recommendation

Recommend **reopen** for one tracked prediction-grading correction. The
terminal identity and private evidence are coherent and must remain sealed;
no rerun, regrade of an official label, implementation change, or private
artifact change is warranted.

## Finding

### P1 — P-set 21 WIRE is graded PASS despite a reached answer receiving no judge label

P-set 21 freezes WIRE as a conjunction: normal/final requests must use the
specified tool wire, continuation must remain complete, **and every reached
answer must receive one judge label** (`evals/predictions.md:1307-1310`). The
terminal evidence establishes that question 7, `0a34ad58`, reached a non-empty
answer after one `memory_search`, then the `$1.00` cap refused the judge
reservation before dispatch. There are two successful Luna transcripts for
that cell and no judge call or judge artifact.

The technical report nevertheless grades WIRE as pass while admitting that
question 7's completed answer is unlabelled
(`coding-sessions/reports/BRN-0007-technical-report.md:57-59`). The ticket's
terminal summary likewise says the reached WIRE predictions passed. This
contradicts the exact preregistered prediction. WIRE should be an aggregate
fail, with its tool-offering, forced-finalization, and continuation subclauses
recorded as passing on reached requests. `STATUS.md` should also contain the
required explicit failing-first P-set 21 grade rather than leaving the WIRE
outcome unstated.

Required change: correct only the tracked prediction assessment in the
technical report, ticket summary, and `STATUS.md`. Preserve all six official
labels, private result bytes, P-set 21 text, accounting, and the terminal
no-rerun boundary.

## Evidence Verified

- Private identity: exactly one directory named
  `j4-luna-retrieval-first10-v2`; `started.json`, `report.json`, `meter.json`,
  and `artifact-manifest.json` all carry that exact run ID. The report is
  terminal `failed`, not resumable, at the question-7 judge cap.
- Manifest: SHA-256
  `7b190fcfef19847cc30b1d020fdae1e15d09eff59d559819fc4d1158a59f3df6`.
  All 44 listed artifacts exist and independently rehash; all 44 plus the
  manifest are mode 0600. The recorded exact-value scan is 0 matches across 2
  configured credentials.
- Compatibility: passed in two Luna dispatches. Dispatch 1 returned a real
  `memory_search` function call, a Gemini embedding call succeeded with usage
  unreported, and dispatch 2 returned a non-empty answer containing the
  expected indigo token.
- Official labels: the six judge transcripts use
  `gpt-4o-2024-08-06`, return HTTP 200 once each, and reproduce exactly
  `PASS, FAIL, PASS, PASS, PASS, PASS` for ordinals 1-6. This is 5/6 graded,
  not 5/10.
- Question 5: four successive function calls
  (`memory_search`, `memory_search`, `memory_timeline`, `memory_search`) used
  five tools with `tool_choice: "auto"`. Dispatch 5 had no `tools` field,
  used `tool_choice: "none"`, returned a non-empty message, and its official
  judge label is PASS.
- Question 7: dispatch 1 called `memory_search`; dispatch 2 returned a
  non-empty message. No judge meter entry or judge artifact exists for the
  cell. `$0.52888556 + $0.54417 = $1.07305556`, so refusal before dispatch is
  arithmetically correct.
- Calls and usage: 93 successful physical calls reconcile as 66 Gemini
  embedding batches, 21 Luna Responses calls, and 6 judge calls. Luna totals
  are 85,233 input, 35,928 cached input, 1,350 output, and 215 reasoning
  tokens for `$0.01219956`; judge totals are 1,117 input and 10 output tokens
  for `$0.0028925`. Gemini reservations sum to `$0.5137935` uncertain.
- Ledgers: fresh `$0.01509206` measured + `$0.5137935` uncertain =
  `$0.52888556` accounted. Adding the opening ledger reproduces cumulative
  `$1.70023596` measured + `$3.5714979` uncertain = `$5.27173386` accounted,
  below `$5.7428483`.
- P-set 21 otherwise grades coherently failing-first as:
  COMPLETION/FINALIZATION aggregate fail with ordinal-5 finalization passing;
  OFFICIAL ACCURACY not assessable; RETRIEVAL CONTROL not assessable; WIRE
  aggregate fail with reached wire subclauses passing; SEMANTIC USE all-ten
  fail; EXECUTION/ACCOUNTING pass.
- Scope/risk: the committed diff contains seven paths, all allowed by the R3
  ticket; no forbidden or implementation/result path changed. Human
  confirmation and independent review remain correctly required.
- Fresh offline verification: `npm test` passed 667, failed 0, skipped 15
  across 682 tests; `npm run quickstart` completed 6/6. Ticket lint, report
  lint, committed-plus-dirty scope check against `main`, and
  `git diff --check main...HEAD` all passed before this note.

## Boundaries Observed

This review made no provider/network call, read no credential or `.env`
value, ran no launcher execution, accessed no sealed U8, altered no
implementation/freeze/result byte, reran or regraded no official result, and
published nothing. This note is the only intended uncommitted change.
