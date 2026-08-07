# BRN-0027 Reviewer Note

Reviewer: `/root/brn0027_reviewer` — fresh independent read-only agent
Reviewed commit(s): `a83fc1bd7a82a5215dae1432d37435c651504726`
Target branch: `main` at `47389e343d2aa46fd16c202ffbade2de073e709b`

## Review Result

Pass. The clean pushed terminal record accurately preserves the consumed
BRN-0026 invocation as a recursively sealed compatibility failure. No provider,
retrieval, ranking, or answer-quality conclusion is claimed.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

## Verification Reviewed

- Read `AGENTS.md`, the complete reviewer packet, ticket contract, committed
  diff, technical report, human report, and handoff.
- Confirmed exact clean pushed HEAD and upstream:
  `a83fc1bd7a82a5215dae1432d37435c651504726`.
- Confirmed all eight committed paths are within `allowed_paths`; no product/
  runtime code or forbidden path changed.
- Independently ran `verifyTerminalArtifactDirectory(...)`: PASS. Manifest
  SHA-256 is
  `df649931886a50341e03be62161f83ba50abe5ba7b832009840866808cd73b4b`,
  status is `sealed`, terminal metadata is `failed`, and all 23 entries match:
  13 manifested mode-0600 files and 10 mode-0700 directories.
- Reverified mode-0600 launcher/runtime hashes as
  `13700b4edb0a8a95e00c86bdfa45186410818ad0cbf740c9550d3667be57ea5e`
  and
  `9a821916e16dd1c731e34fe2882b1364303e14da21475aca588097aa40903189`.
- Reconciled `report.json`, `meter.json`, custody, and transcript metadata:
  Ettin PASS; Gemini writer HTTP 200; OpenAI count HTTP 200 with 2,142 input
  tokens; Luna generation HTTP 200 with completed 2,142-input / 40-output
  usage; then local `OpenAI context band is invalid.` before successful answer
  smoke.
- Independently reproduced the body hashes: projected count
  `d77ba2aaa9521a0c3445ca73e1112955e7bc26fd5eb61a1dd5dd7ce76561838d`;
  unchanged generation
  `978a57073547d04b61d5b0813e5db2faef797cc33b6a477b047d1eded41850d8`.
- Confirmed the generic source mismatch: reservation code emits `short`/
  `long`; the frozen runtime's `measuredOpenAISpend(...)` accepts only
  `shortContext`/`longContext`; the runtime forwards the unnormalized value.
- Reconciled accounting exactly: `$0.0004775` measured + `$0.0511499`
  uncertain = `$0.0516274` fresh accounted; `$7.85549929` opening +
  `$0.0516274` = `$7.90712669` cumulative, within both authorized caps.
- Confirmed `questions: []`, `compatibility: null`, exact FINAL P-set 37
  population, U8 exclusion, and absence of the semantic-review namespace.
- Confirmed the P-set 37 failing-first grade preserves distinct absent metrics
  and creates no judged overlay. Historical `6/10` and sealed U8 were not
  changed or regraded.
- Value-free credential-shaped scan found zero matching artifact files.
- `npm test`: PASS — 797 passed, 15 skipped, 0 failed across 812.
- `npm run quickstart`: PASS — 6/6.
- Committed-plus-dirty scope check: PASS — eight governed paths.
- `git diff --check`: PASS.
- The pre-note `npm run ticket -- check BRN-0027` passed scope validation and
  reported only the expected missing reviewer-note file; rerun it after this
  note.
- No credential was read, no selected benchmark content was inspected, no
  private artifact was mutated, and no network/provider call was made.

## Required Changes

- none.

## Recommendation

Recommend `accept`. This recommendation applies only to the honest BRN-0027
terminal record; it does not accept or merge the ticket and grants no repair,
retry, successor identity, provider call, or live authority.
