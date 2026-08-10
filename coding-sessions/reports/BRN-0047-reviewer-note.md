# BRN-0047 Reviewer Note

Reviewer: fresh independent Codex reviewer `/root/brn_0047_reviewer`
Reviewed commit: `d2e26029f7fbb7b25dd599b015af59e0f2182ba8`
Target branch: `main` at
`82d9e2ce8237060e246c6ff386217fec29013f0e`

## Review Result

ACCEPT. The exact candidate satisfies all five acceptance criteria, keeps
briefing anchors outside answer evidence, and passes the required
provider-free gates. I found no unresolved P0-P3 issue.

## Findings

- None.

## Verification Reviewed

- Exact head and target: verified at
  `d2e26029f7fbb7b25dd599b015af59e0f2182ba8` against `main` at
  `82d9e2ce8237060e246c6ff386217fec29013f0e`. The worktree was clean before
  this permitted reviewer note.
- Scope: all nine committed paths are allowed. No forbidden path or rename is
  present. The specialist did not accept, merge, or record its own acceptance.
  R2 remains correct for this cross-file answer behavior.
- Briefing eligibility: `src/retrieval-answer.mjs:2935-2948` reads the scoped
  briefing and seeds only non-empty `canonical_message` rows from
  `canonical_fallback`. `incremental_digest` rows cannot enter the seed path.
- Separation: `src/retrieval-answer.mjs:825-960` keeps bridge eligibility in a
  separate ephemeral set. Seeding does not touch the answer evidence registry,
  searched or selected evidence, rounds, attempted queries, novelty, returned
  counts, stagnation, or budget accounting.
- First bridge: `src/retrieval-answer.mjs:2789-2852` validates the eligible ID,
  performs one normal bridge search, and records it as one retrieval round.
  `src/retrieval-answer.mjs:1247-1303` obtains raw anchor text only from a
  host-held returned-evidence or briefing registry and preserves the existing
  500-character rerank-query bound.
- Anchor rejection: unknown and provider-invented IDs fail through
  `MEMORY_RETRIEVAL_FRONTIER_ANCHOR_INVALID`. An independent two-user check
  also tried a real canonical briefing ID from another user scope; the active
  scope did not contain its text and rejected the ID with the same code.
- Accounting contract: the focused first-bridge test proves zero initial
  answer evidence and an exact unchanged frontier snapshot, then proves one
  bridge call, round ordinal one, no selected evidence, and host-held raw text
  in reranking. The derived-digest test proves that one model-derived briefing
  row remains ineligible.
- Acceptance-criterion wording: criterion 1 says "answer evidence registry,"
  while criterion 2 says seeding changes only bridge-anchor eligibility. The
  Goal and Scope also define the briefing row as routing input. I interpret the
  first phrase as host registration of answer-session briefing evidence, not
  admission to the final answer-commit evidence registry. The separate
  briefing registry is therefore required by criterion 2 and the stated
  routing-only boundary; adding the row to answer evidence would violate that
  boundary. This is not a product finding.
- Rejection details: `src/openai.mjs:1167-1178` creates one frozen object with
  only a code bounded to 100 characters and a reason bounded to 1,000
  characters. `src/openai.mjs:1517-1559` attaches the last host rejection in
  both normal and bounded-incomplete terminal repair paths.
- Content boundary: the direct tests use a private evidence ID and body and
  prove that neither appears in the serialized terminal error. They also
  prove two dispatches, two host attempts, the last code and reason, exact
  object keys, truncation, and immutability. The host commitment validator's
  rejection messages are structural and do not embed prompt, evidence, or
  provider bodies.
- `node --test tests/openai.contract.test.mjs tests/retrieval-frontier.contract.test.mjs`:
  PASS, 82/82.
- `npm test`: PASS, 93/93.
- `npm run quickstart`: PASS, all 6 steps.
- `npm run test:legacy`: PASS, 969 passed, 15 optional skips, and 0 failed
  across 984 tests.
- Ticket lint, committed-plus-dirty scope, and exact committed diff checks:
  PASS. Report lint correctly required this reviewer note before it existed.
- No provider, credential, environment file, private artifact, dataset,
  evaluation result, production service, paid operation, or sealed U8 item was
  accessed.

## Residual Risks

- No paid diagnostic was run. Whether a live model uses the newly accepted
  first-call anchor remains a later, separately authorized quality check.
- The model-facing bridge text still uses "returned" broadly. The initial
  canonical briefing is already returned in the answer context, and the
  previously failing model already supplied such an ID. I found no requirement
  for a wire or prompt change in this ticket.

## Required Changes

- None.

## Recommendation

Recommend `accept` at exact committed head
`d2e26029f7fbb7b25dd599b015af59e0f2182ba8`. This recommendation does not
accept, merge, commit, or push the ticket.
