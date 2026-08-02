# BRN-0005 Fresh Post-Dispatch Reviewer Note

Reviewer: Codex, independent fresh-context post-dispatch reviewer
Reviewed commit: `a8a69bf69b0cfabdb7a3e1c605ad8c330adecc4e`
Target branch: `main` at `42b9b464a4d5a47e17b87b07d7ef1a3f8bbcc278`
Private identity: `j4-luna-retrieval-first10-v1`

## Review Result

Pass for terminal evidence. The single authorized invocation produced one
sealed runtime failure after compatibility and four judged questions. The
tracked record agrees with the immutable private bundle on provider controls,
reached labels, the ordinal-5 failure, ungraded boundaries, prediction grades,
and spend. No finding requires reopening this ticket.

This recommendation accepts the defensibility and terminality of the recorded
finding. It does not turn the four reached labels into a `3/10` score, establish
a Luna-versus-Gemini accuracy delta, accept or merge the ticket, authorize a
rerun or successor, regrade any answer, publish a result, or change a product
provider.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

The experimental success path in acceptance criterion 4 did not complete all
ten labels: ordinal 5 stopped at the frozen dispatch ceiling. That is not a
repair finding. The same criterion, scope, expansion rules, and stop conditions
make a later runtime failure immutable and explicitly prohibit retry. Closing
the governed work therefore means preserving and independently validating the
failure, not reopening the identity until its hoped-for outcome appears.

The frozen controls reverify. The launcher is mode 0600 and hashes
`4f2e425e8239b5304157a47745ddeaa025a14960ae120473a1b0a5fe2b097eb4`.
The generated runtime is mode 0600 and hashes
`b9c60472cc3190fb8eb72a947ad5f5937cb7094d2cdefdd1efe1a22d96cafadd`.
Offline verification reproduces the exact ten-question order, dataset hash,
eight current product/evaluation inputs, seven predecessor bundles, and the
Gemini 5/10 baseline manifest. It binds answers to `gpt-5.6-luna` at low
reasoning, semantic embeddings to `gemini-embedding-001`, and judging to
`gpt-4o-2024-08-06`.

All 18 private Responses transcripts have one request mode: Luna, low
reasoning, `store:false`, serial tool calls, a 512-token output ceiling, the
five frozen memory tools, and encrypted reasoning continuation. All 18
responses validate the requested model and completed status. The aggregate
meter contains 18 successful Luna dispatches, 49 successful Gemini embedding
batches with usage unreported, and four successful judge calls. This preserves
the intended provider substitution: answer/tool decisions changed while the
semantic surface and official judge stayed fixed.

Compatibility passed in two Luna dispatches. The first completed response
contained a `memory_search` function call; the second contained one message.
The report records one retrieval call, semantic use, and the expected
compatibility-token check as true. No question dispatch preceded that smoke.

The report contains exactly four completed question records in frozen order.
Their independently parsed judge booleans produce the exact labels
`08e075c7` PASS, `09d032c9` FAIL, `16c90bf4` PASS, and `5e1b23de` PASS. Each
record names the unchanged judge, has a normal stop finish, and reports at
least one successful semantic search. Four separate judge meters show exactly
attempt 1, terminal success, HTTP 200, and no error for those four cells. The
label vector matches Gemini on every reached case.

Ordinal 5 has exactly seven Luna transcripts and seven successful aggregate
meter entries. In dispatch order their sole function calls are
`memory_search`, `memory_search`, `memory_timeline`, `memory_search`,
`memory_find`, `memory_search`, and `memory_find`. Every response is completed,
all seven are tool-only, and none contains a message. The report then terminates
with `OPENAI_MODEL_DISPATCH_BUDGET_EXHAUSTED`. It contains no completed record
for ordinal 5 and no record, answer transcript, or judge attempt for ordinals
6-10. Those six questions are ungraded.

The prediction grading is correct and failing-first. ANSWER BOUNDARY fails at
ordinal 5. SEMANTIC USE fails as the preregistered all-ten claim even though
every completed question used semantic search. OFFICIAL ACCURACY, PROVIDER
DELTA, and RETRIEVAL CONTROL are not assessable because required labels were
not reached; the four completed positive cases did consult all 5/5 required
answer-bearing sessions. COMPATIBILITY/JUDGE WIRING passes at every reached
boundary. EXECUTION/ACCOUNTING passes. STATUS, the decision, ticket, technical
report, and human report consistently preserve that distinction and never
present the partial vector as a ten-question score.

Meter arithmetic reconciles at the recorded seven-decimal precision. Luna
measures `$0.0094648` from 89,051 input, 52,570 cached-input, 931 output, and
193 reasoning tokens. Four judge calls measure `$0.0021850`, giving
`$0.0116498` fresh measured spend. Forty-nine embedding batches over 2,411
inputs retain `$0.3669336` uncertainty, giving `$0.3785834` fresh accounted.
Adding the frozen opening ledger yields `$1.6851439` cumulative measured,
`$3.0577044` cumulative uncertain, and `$4.7428483` cumulative accounted.
Fresh and cumulative accounting each retain `$0.6214166` headroom under their
respective `$1.00` and `$5.3642649` hard boundaries.

The manifest lists 35 artifacts. Independent path containment, size, mode, and
SHA-256 checks pass for all 35; each is mode 0600. The manifest itself is mode
0600 and hashes
`574c865ca3755cf794b002de5b12ec3d474ae235b51e894772222dd97b48b5d8`.
Its `secretScan` records two configured credential values and zero exact
matches. The frozen finalizer reads each candidate artifact as bytes, fails if
either configured exact value occurs, and writes the manifest only after that
scan. This review did not read an environment file, credential value, raw
prompt, raw response text, answer text, tool arguments, or user content.

The one-shot evidence is coherent. Runtime creation precedes the private
started record; one report and one manifest close the same approximately
137-second window. There is one matching runtime marker, one matching result
directory, one contiguous transcript sequence per reached cell, and only
attempt 1 for each judge. Offline verification now reports both runtime and
result present. The launcher refuses `--run` if either exists. P-set 20 is
byte-unchanged from the fresh pre-dispatch GO commit through reviewed HEAD.
No filesystem, meter, transcript, judge, tracked-history, or prediction
evidence indicates a rerun, transport retry, selective regrade, replacement
identity, or prediction edit. This review did not invoke `--run` or make any
network/provider call.

The complete branch delta against `main` contains only the seven declared
evidence paths. All are allowed, no forbidden path is changed, actual risk
remains R3, and the ticket stays `in-review`. The specialist did not accept,
close, merge, or publish its own work. Current `brain.mjs` is transparently not
byte-identical to the BRN-0002 checkout because of additive optional author
provenance, but the frozen calls omit that field, the active retrieval hash is
unchanged, and this ticket changes no product code. That disclosed compatibility
difference does not invalidate the controlled provider comparison.

## Verification Reviewed

- Read `AGENTS.md`, the full ticket workflow, ticket, generated reviewer
  packet, P-set 20, current STATUS entry, founder/terminal decisions,
  technical report, human report, prior pre-dispatch review, and the complete
  committed diff against `main`.
- `git diff --check main...HEAD` — pass.
- `git diff --exit-code bc50322..HEAD -- evals/predictions.md` — pass; no
  post-GO prediction change.
- `node /home/quetza/palari-brain-private/luna-first10-live-v1-launcher.mjs
  --verify` — pass offline; exact dataset/order, 8/8 inputs, 7/7 predecessors,
  provider bindings, source/runtime hashes, and present sealing markers.
- Independent manifest rehash/mode/size/path-containment check — pass, 35/35;
  manifest hash and zero-match two-credential scan record agree.
- Private report/meter/transcript/judge structural reconciliation — pass using
  metadata, names, booleans, types, counts, usage, and hashes only; no prompt,
  response text, answer, argument, or user content was emitted.
- `npm test` — pass, 664 passed, 0 failed, 15 skipped across 679 tests.
- `npm run quickstart` — pass, all six journey stages.
- `npm run ticket -- ticket-lint-all` — pass.
- `npm run ticket -- scope-check --committed-plus-dirty --target main
  BRN-0005` — pass for the seven declared branch paths, including this allowed
  note.
- `npm run ticket -- report-lint BRN-0005` — pass.
- `npm run ticket -- check BRN-0005` — pass.
- Provider/network calls: 0. Credential/environment reads: 0. Fresh spend
  during review: `$0.00`.

## Required Changes

None.

## Recommendation

Recommend `accept` as the immutable terminal result of BRN-0005. Founder
acceptance remains required to close or merge the ticket. Preserve the private
identity, partial-label boundary, failed and unassessable prediction grades,
and exact accounting unchanged. Any repair to repeated tool use, larger
dispatch budget, successor identity, provider decision, publication, rerun,
or regrade requires a separate contract and fresh founder authority.
