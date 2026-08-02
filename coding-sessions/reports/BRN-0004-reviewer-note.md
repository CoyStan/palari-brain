# BRN-0004 Reviewer Note

Reviewer: Codex, second fresh-context independent reviewer
Reviewed commit(s): `efb3322` through assigned HEAD `938ec9abc07bec2b217687335e0090b8f564c400`, including first-review repair commits `6fe16bf` and `938ec9a`
Target branch: `main` at `69ec37d6e3fa03e74d1a8a74ab9b39ba541aec66`

## Review Result

Fail on one bounded documentation defect. The implementation repairs every
code/test finding from the first review: stateless reasoning content is
requested and replayed with the complete output, the 4 MiB/seven-dispatch/
one-repair limits are absolute, the adversarial contracts are present, and
provider-free verification is green. Secret placement, the fixed endpoint,
host admission, committed scope, and regression checks are also clean. The
founder-readable report nevertheless contains contradictory focused-test
counts, so the branch does not yet meet the requested truthful-docs gate.

## Findings

- **Low — the human report still records a stale focused-test count.**
  `coding-sessions/human-report/BRN-0004-human-report.md:31` says “The 13
  focused tests,” while line 51 says `14/14` and the independent focused run
  passed 14 tests. This is the sole remaining mismatch in the reviewed
  implementation/evidence and directly contradicts the report's own later
  count.

- **No code, security, admission, scope, or risk finding.**
  `src/openai.mjs:454-490` sends
  `include: ['reasoning.encrypted_content']`, keeps `store: false`, and clones
  the complete output array into the next stateless request before appending
  host function outputs. Lines 229-233, 422-431, and 702-705 reject configured
  limits above 4 MiB, seven model dispatches, and one reducer repair. A direct
  adversarial run reached exactly seven model invocations and no eighth, while
  a permanently invalid reducer proposal caused exactly two invocations (one
  initial proposal and one repair). The focused suite covers above-cap
  configuration, streamed oversize, malformed function arguments, incomplete
  output, empty output, malformed structured output, refusal, and exact-quote
  rejection. The key is supplied explicitly, enters only the Authorization
  header in adapter-built requests, is absent from URLs/bodies/errors, and is
  never loaded on import. The convenience transport has one fixed endpoint
  and no retry. Unknown tools fail before retrieval; reducer proposals still
  cross host normalization/admission, and graph proposals still cross exact-
  quote checks and the unchanged graph gate. All 11 changed paths are allowed,
  no forbidden path changed, and R3 remains the correct declared risk.

- **Historical network deviation is now stated truthfully.** The ticket,
  technical report, human report, and STATUS all disclose that official-docs
  research used the external documentation connector after ticket freeze,
  violating the stop condition's literal “any network call” wording. They
  distinguish that read from provider inference/API access and record zero
  credential reads and zero spend. This review made no network or provider
  call and did not inspect a credential.

## Verification Reviewed

- `node --test tests/openai.contract.test.mjs` — PASS, 14/14.
- `npm test` — PASS, 664 pass, 0 fail, 15 skipped across 679 tests.
- `npm run quickstart` — PASS, six-step journey complete.
- `npm run trust-bench` — PASS, 5/5.
- `npm pack --dry-run` — PASS; `src/openai.mjs` is included.
- `git diff --check main...HEAD` — PASS.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0004`
  — PASS for 11 committed-plus-dirty paths before this replacement note.
- `node scripts/ticket-system.mjs check BRN-0004` — PASS before this
  replacement note.
- Direct provider-free cap check — PASS: seven answer dispatches with no
  eighth and two reducer invocations with no second repair.
- Provider inference/API calls: 0. Credential reads: 0. Network calls: 0.
  Spend: $0.00.

## Required Changes

- Change the stale `13` at
  `coding-sessions/human-report/BRN-0004-human-report.md:31` to `14`, rerun the
  documentation/diff/ticket checks, and submit a new committed HEAD for a
  final fresh review. No code or test change is requested.

## Recommendation

Recommend `reopen`. This recommendation does not itself accept, merge, push,
transition, or authorize a provider call for the ticket.
