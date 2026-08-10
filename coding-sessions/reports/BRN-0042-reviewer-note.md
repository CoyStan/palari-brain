# BRN-0042 Reviewer Note

Reviewer: fresh independent Codex reviewer `/root/brn_0042_reviewer`
Reviewed commit(s): parent `2c79391` through `410bfa6`; child A
`cb32860` with accepted tip `83eaf2d`; child B `028fe10` with accepted tip
`2890cc5`
Target branch: `main` at `3c0dcc0fb8cc0497cc7895caa28c3b9655c8ef05`

## Review Result

PASS. No unresolved P0-P2 correctness, evidence-integrity, isolation,
compatibility, scope, or documentation finding remains. No P3 defect was
identified.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.
- The adapter records each first-seen citable row under one stable answer-local
  number and retains a bounded exact host-held excerpt for that canonical ID
  (`src/openai.mjs:450-523`). Repeated canonical IDs retain their first number.
- Detailed bases accept only `memoryNumber`, `disposition`, and `rationale`,
  reject any extra stale ID/quote field, bind the canonical ID and excerpt, and
  map exactly one rationale into the existing use/non-use host fields
  (`src/openai.mjs:568-607`). Enumeration uses the same host binding while
  retaining classification, label, action, and reason
  (`src/openai.mjs:634-678`).
- The strict provider schemas expose no writable evidence ID or quote on
  detailed bases or enumeration items, and their repair instruction preserves
  the existing one-repair flow (`src/openai.mjs:692-852`,
  `src/openai.mjs:886-893`). The unchanged provider-neutral validator still
  rejects unknown and duplicate canonical evidence, non-exact excerpts,
  malformed use declarations, invalid temporary provenance, invalid
  enumeration counts, and omitted material confirmation findings
  (`src/retrieval-answer.mjs:2272-2739`).
- The parent changes no provider-neutral validator or memory write path, so
  historical custom providers retain their canonical-ID/exact-quote input
  contract. The complete provider-free legacy tier confirms compatibility.
- Child A changes one adjacent OpenAI fixture to the new provider-facing shape
  (`tests/current-evidence-review.contract.test.mjs:238-247`). Child B changes
  only the active request byte/hash pins and leaves all BRN-0025 historical
  constants intact (`tests/openai-counted-responses.contract.test.mjs:22-35`).

## Verification Reviewed

- Built the exact product/test composite in a detached temporary worktree from
  parent `410bfa6`, child A implementation `cb32860`, and child B implementation
  `028fe10`; no product branch was altered.
- Focused parent contracts: PASS, 52/52.
- `npm test`: PASS, 89/89.
- `npm run quickstart`: PASS, all 6 journey checks completed.
- Child A focused contract: PASS, 8/8.
- Child B counted-Responses contract: PASS, 16/16.
- `npm run test:legacy`: PASS, 928 passed / 15 optional skips / 0 failed
  across 943 tests.
- Parent committed-plus-dirty scope check against `main`: PASS for its five
  declared paths. Direct inspection confirmed child implementation commits
  change only their declared test and ticket records; accepted tips add only
  their declared human reports and ticket moves. No forbidden path changed.
- `git diff --check main...HEAD`: PASS for the parent and both accepted child
  worktrees. The declared R2 risk remains appropriate for an answer-wire
  behavior change; there is no durable write, user/workspace boundary, or
  admission change.
- No provider, credential, private artifact, dataset, sealed U8 question, or
  destructive path was accessed during review.

## Residual Risks

- Validation is provider-free. It proves exact request/translation/host
  behavior, not how often a live model will choose the right memory or write a
  semantically correct rationale.
- Host binding deliberately uses a deterministic bounded excerpt from the
  first returned citable form for a canonical ID. That excerpt is exact and
  auditable, but can be less pinpointed than a model-selected span in a long
  row; the canonical ID, full host custody, and model rationale remain
  available for semantic review.

## Required Changes

None.

## Recommendation

Recommend `accept`. This recommendation does not itself accept, merge, commit,
or push the ticket; founder acceptance remains required.
