# BRN-0017 Pre-Dispatch Reviewer Note

## Review Result

Fresh independent read-only review of exact ticket head
`ecc8add85d25c0c8055ab975a8be5a520f68e835` against target `main` at
`d5229d1f31986d5fa88845b5a574f3c96cf4c972` recommends **REOPEN**. One P3
finding must be repaired and freshly reviewed before founder GO. No P0, P1,
or P2 finding was found.

## Finding

- **P3 — the committed diff fails its declared whitespace check.**
  `git diff --check d5229d1f31986d5fa88845b5a574f3c96cf4c972
  ecc8add85d25c0c8055ab975a8be5a520f68e835` reports trailing whitespace on
  ticket lines 13 and 14 (`claimed_by` and `claimed_at`). The technical report
  says `git diff --check` passed, but that clean-worktree invocation does not
  inspect the already committed ticket delta. This is a small governance and
  evidence defect, not a product or live-meter defect.

## Evidence Reviewed

- The target branch and canonical checkout were clean and equal to
  `origin/main` at exact `d5229d1f31986d5fa88845b5a574f3c96cf4c972`.
  The clean pushed ticket branch was at exact
  `ecc8add85d25c0c8055ab975a8be5a520f68e835`; committed scope contains only
  the four allowed paths declared in the ticket.
- P-set 28 is FINAL in freeze commit
  `c2acc4d21352cad650e535c7b398a76015d707d0`, and the prediction file is
  unchanged in the review-transition commit. Its SHA-256 at both commits is
  `e071f577029e65cc34073bbf2bbd57570d1ac39817ae35019ad0fb3285a725d5`.
  The frozen ordered population is the same ten BRN-0015 IDs and excludes
  sealed U8 `1568498a`.
- The private launcher and generated runtime are mode 0600 and rehash to
  `a14284952f5004f80dc9dc7cb8e5bcb5e15cf31d88752ec1916c1ea9ca0d7387`
  and `5c72c1c62612e9f2963e9b664fdf47ee02a941a39ec61b57548afea51c09da32`.
  A direct runtime comparison with consumed BRN-0015 hashes
  `6ccc091b521cd3c9874805278ab7959e9fdb5523326fe775df01a37dd992f29b` /
  `d123525ec5e1c9bc1664fc9c323e9fa567831e9118d4e5cc273cfb29344c6ea2`
  found only the fresh identity/opening ledger, the accepted BRN-0016 tracked
  validator and exact tool pins, and usage text changes. Question order,
  prompts, provider/model/judge configuration, limits, retrieval, Ettin, and
  answer behavior are unchanged. No benchmark answer, official label, or
  prior generated answer appears in answer-generation logic.
- Launcher `--verify` passed provider-free. It rehashed 12 terminal
  predecessors / 328 artifacts, 11 product/eval inputs, seven Ettin artifacts,
  the 3,208-file / 706,843,605-byte runtime closure, dataset SHA-256
  `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`,
  ordered-question SHA-256
  `d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`,
  product cut `232bfe2a34fcf88b5fea88599327120a86292982`, and absent result identity.
- Product-generated normal, plain-terminal, and forced-commit bodies passed
  the tracked validator with tool hashes `46d925c9...` / `0b006512...`, then
  produced exactly three fake reservations followed by three fake dispatches.
  The focused validator contract passed 5/5.
- Static transport review confirmed every Gemini fetch follows durable outer
  reservation, every Luna fetch follows exact wire validation and durable
  reservation, and every judge fetch follows the repository's durable
  one-shot judge reservation. Fresh `$1.50`, opening `$6.40824561`, and
  cumulative `$7.90824561` accounting are fail-closed. The launcher reserves
  the result namespace, the runtime consumes it before preflight, and every
  terminal path attempts a private artifact manifest and credential scan.
- Offline control flow contains no credential load, provider transport, or
  model inference. The explicit result path remained absent before and after
  review. No `--run` path was invoked, no provider call occurred, and spend
  remained `$0.00`.
- Full verification: focused 5/5; full suite 710 passed / 0 failed / 15
  skipped across 725 tests; quickstart 6/6; ticket lint and committed-plus-
  dirty scope check passed. Report lint/check remain expectedly incomplete at
  this pre-dispatch stage because the human confirmation records do not yet
  exist.

## Required Change

Remove the two trailing spaces, update the evidence so the target-aware
committed diff check is true, commit and push the repair, and obtain fresh
independent rereview of the repaired exact head. Do not dispatch or request
founder GO on `ecc8add`.

## Recommendation

**REOPEN.** The live design is otherwise structurally ready, but the exact
reviewed head does not satisfy its own committed-diff verification. No live
authority is implied, and the prior BRN-0015 authorization remains consumed.
