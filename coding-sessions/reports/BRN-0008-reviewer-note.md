# BRN-0008 Reviewer Note

Reviewer: fresh independent read-only reviewer
Reviewed commit: `0bfe08ee0282cabb0cc86cd7726badbdfa567d20`
Target: `main` at `1370fc1b95039fb5f8bd3933afcd9e44b1414f1f`

## Review Result

Substantive implementation, measurement, documentation, and provider-free
verification pass. Recommend reopening only for one narrow committed
diff-hygiene correction: the ticket's mandatory `git diff --check
main...HEAD` verifier is red. No rerun, regrade, model change, product-code
change, or private-result change is warranted or authorized.

## Findings

### P2 — Required committed diff check fails on ticket metadata

`git diff --check main...HEAD` reports trailing whitespace on lines 13 and 14
of
`coding-sessions/tickets/open/BRN-0008-add-provider-neutral-memory-reranking.md`.
The affected committed lines are the empty `claimed_by` and `claimed_at`
fields. Acceptance criterion 8 and the ticket verification list explicitly
require the diff check to pass, so the reviewed branch is not yet ready for
founder acceptance.

No P0 or P1 finding was identified. The generic reranker seam, canonical
evidence boundary, fail-closed score validation, optional-runtime packaging,
preregistration, one-pass private results, selection math, reports, and
provider-free tests are otherwise coherent with the contract.

## Verification Reviewed

- Confirmed the worktree was clean at committed HEAD `0bfe08e` before this
  reviewer note, with target `main` at `1370fc1` and the expected three-ticket
  commit sequence. Freeze commit `a30ab6b` predates all three private result
  `startedAt` timestamps; the bank and runner remain byte-identical to that
  freeze.
- Inspected the complete `main...HEAD` diff, ticket, technical report, human
  report, STATUS, API/decision documentation, product source, adapter, bank,
  runner, preregistration, and focused contracts. The committed-plus-dirty
  scope check passes for all 16 changed paths; repository ticket lint passes.
- Reproduced the frozen bank identity: version `brn-0008/v1`, 16 cases and 15
  positives, canonical hash
  `a89f5179874313d60e4bf46b7af8aad74ad31398873f55f1f4796dbaf96784f1`,
  source hash
  `ad57b64b8f6c2e6e953fdf1795215febce46b4ea3ba76d6b9dc95a1f2d279343`,
  baseline 0/15 top-1, 0.29222222222222227 MRR, and 15/15 recall@5.
  The runner hash remains
  `7be1dd1c85c2b59a5cb83bb465fd932fe7e3dbff63f7c62a91283dafa9f9d0c8`;
  the preregistered adapter hash reproduces from freeze commit `a30ab6b`.
- Independently rehashed the three permitted private result files. SHA-256
  values exactly match the reports: MiniLM-L6
  `6ebc9db72e64fcb7bab0c2beb0c872b614b11365ab01d612582fa8b4604f183e`,
  MiniLM-L12
  `7b6100c3d7734ab5a54148f2b16e1fafce032e4ea072506f288884d16c4d72af`,
  and mxbai-xsmall
  `076656e990cc42791a889136220ec73c5a6752a7830506eb16fb900bc32bedaf`.
  The containing directory is mode 0700; all three files are mode 0600; no
  additional result file is present.
- Recomputed every positive rank and all reported metrics from the private raw
  ordering. Results match exactly: L6 13/15, 0.9333333333333333 MRR, 15/15
  recall@5 at 44.634239125 ms/case; L12 14/15, 0.9666666666666667, 15/15 at
  132.1034313125 ms/case; xsmall 14/15, 0.9666666666666667, 15/15 at
  88.68201475 ms/case. Each result is completed, uses its exact frozen
  revision, reports Transformers.js 4.2.0, zero content mutations, and zero
  provider cost. The frozen Pareto rule therefore selects L6 exactly as
  reported: xsmall dominates L12, while L6 and xsmall are nondominated and L6
  is the lowest-latency eligible member.
- Confirmed Palari declares no `@huggingface/transformers` dependency and
  `npm ls @huggingface/transformers --depth=0` is empty. Package dry-run
  includes the adapter subpath but no bundled runtime, model, cache, or result
  artifact. Source inspection found no credential, provider transport,
  generation call, benchmark identity, or prohibited tuning wording in the
  product adapter, bank, or runner.
- Focused contracts pass 27/27. `npm run reranker-bakeoff` verifies the frozen
  bank and configuration without scoring. Full `npm test` passes 686, fails
  0, and skips 14 across 700 tests. `npm run quickstart` completes 6/6.
  Ticket lint and scope check pass. Report lint correctly reports only the
  reviewer note as missing before this note was created.
- `git diff --check main...HEAD` fails only on the two ticket-metadata lines
  identified above. No provider, network, credential, dataset, LongMemEval,
  sealed-identity, generation, scoring, rerun, or paid action occurred during
  this review.

## Required Changes

- Remove only the trailing spaces after the empty `claimed_by:` and
  `claimed_at:` fields in the open BRN-0008 ticket.
- Rerun `git diff --check main...HEAD`, report lint, ticket lint, and the
  committed-plus-dirty scope check, then return the unchanged substantive work
  for fresh final review. Preserve P-set 22, all private result bytes, model
  selection, metrics, product code, and the no-rerun boundary.

## Recommendation

Recommend `reopen` for the narrow diff-hygiene correction above. This
recommendation does not accept, close, merge, push, publish, authorize
cleanup, authorize a provider run, or authorize another model pass.
