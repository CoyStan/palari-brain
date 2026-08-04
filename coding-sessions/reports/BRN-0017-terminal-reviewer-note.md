# BRN-0017 Terminal Reviewer Note

Reviewer: independent agent `/root/brn0017_terminal_review`
Reviewed commit: `958913105b137325fdd9a5a067c3d7fe295a4d77`
Target branch: `main` at `d5229d1f31986d5fa88845b5a574f3c96cf4c972`

## Review Result

Pass. Fresh independent read-only review found no P0, P1, P2, or P3
finding. The immutable result and its failing-first P-set 28 assessment are
accurately recorded.

## Findings

None.

## Verification Reviewed

- The exact clean ticket worktree and pushed branch were both at
  `958913105b137325fdd9a5a067c3d7fe295a4d77`; canonical `main` was clean and
  equal to `origin/main` at
  `d5229d1f31986d5fa88845b5a574f3c96cf4c972`. The complete eight-path diff is
  within the R3 ticket's allowlist and does not touch a forbidden or product
  path.
- P-set 28 was FINAL in pushed freeze commit
  `c2acc4d21352cad650e535c7b398a76015d707d0`, hours before the sole attempt
  reserved its namespace. The attempt record is `consumed`, the launcher
  result records exit status 0, and all 139 unique physical calls completed
  before the terminal report timestamp. There is one judge attempt per
  question and no evidence of resume, rerun, reroll, or regrade.
- The private manifest independently rehashes to
  `850ca10026e7800dcaaa69eab482561d4eb0fe5db17e1a05b6fdb361a5959ebe`.
  All 74 listed artifacts exist, rehash exactly, total 89,786,836 bytes, and
  are mode 0600. The manifest itself is the sole intentionally unlisted file;
  there is no missing listed file, unexpected additional result artifact,
  symlink, non-0700 directory, or sealing error. The launcher and runtime are
  mode 0600 and reproduce their frozen hashes
  `a14284952f5004f80dc9dc7cb8e5bcb5e15cf31d88752ec1916c1ea9ca0d7387`
  and `5c72c1c62612e9f2963e9b664fdf47ee02a941a39ec61b57548afea51c09da32`.
- All ten raw judge transcripts are terminal-success attempt 1 records. Their
  punctuation-normalized booleans reproduce exactly `PASS, FAIL, PASS, PASS,
  PASS, FAIL, FAIL, FAIL, PASS, PASS`, hence 6/10. Their usage reproduces
  2,060 input and 18 output tokens. Required answer-bearing session telemetry
  independently sums to 12/13.
- The 34 sealed Luna transcripts classify exactly as 30 normal, one
  plain-terminal, and three forced-commit requests with no unknown form. The
  sole normal and forced tool-array hashes reproduce
  `46d925c97578b3c9b32741da709c6a3d85a62ab3d4d238e3d1a82a16aa64ba4b`
  and `0b0065129c8897cbbd2f2f61390f40500251f4dd496c3ef4cc090f4eff6441b0`.
  Every request uses `gpt-5.6-luna`, low reasoning, 512 maximum output tokens,
  `store: false`, and serial tool calls. No cell exceeds five Luna dispatches
  or four memory calls.
- Nine scored rows returned canonical evidence and report accepted host
  commitments. Their final accepted commitment payloads match the reported
  answer and bases. All 14 bases name evidence IDs actually returned to that
  cell, and every quote is an exact contiguous substring of the corresponding
  canonical text. The only uncommitted row returned zero messages and has no
  basis or commitment call, matching the allowed abstention exception.
- Twelve native Ettin measurements report 330 candidates and exactly 330
  scores, maximum 50 candidates per call, finite numeric telemetry, and the
  recorded zero-mutation outcome. Retrieval coverage and the one missing
  required session are reported without overclaim.
- The meter contains 139 successful physical requests: 34 Luna Responses
  calls, 95 Gemini embedding batches carrying 4,794 requests and 4,905,943
  conservatively reserved tokens, and ten official judges. Raw Luna response
  usage and meter entries independently agree at 150,037 input, 70,054 cached
  input, 4,221 output, and 870 reasoning tokens.
- Luna `$0.02246288` plus judges `$0.00533000` reproduces fresh measured spend
  `$0.02779288`; Gemini reservations reproduce uncertain spend `$0.73589145`;
  fresh accounted spend is therefore `$0.76368433`. Adding the exact opening
  classes reproduces cumulative `$1.76173444` measured + `$5.41019550`
  uncertain = `$7.17192994`, leaving `$0.73631567` below both the `$1.50`
  fresh and `$7.90824561` cumulative boundaries.
- The sealed credential scan records two configured exact values, zero
  matches across the declared tracked/private scope, and zero sealing errors.
  This review did not read credentials, `.env`, provider services, or invoke
  the launcher `--run` path.
- Tracked reporting grades P-set 28 failing categories first: official
  accuracy fails at 6/10 below the at-least-8/10 floor, while completion,
  cited commitment, retrieval/rerank, wire, and execution/accounting pass.
  It preserves every official label and explicitly avoids treating these ten
  inspected cases as unseen-user accuracy or authorizing another rerun.
- Provider-free verification passed: `npm test` reports 710 passed, 0 failed,
  and 15 skipped across 725 tests; `npm run quickstart` completes 6/6;
  ticket/report lint, committed-plus-dirty scope, target-aware
  `git diff --check`, launcher/runtime syntax, and report reconciliation pass.

## Required Changes

None.

## Recommendation

Recommend `accept` and merge the immutable BRN-0017 result record. The next
unit should address answer use rather than rerun this consumed measurement.
This recommendation does not itself accept, merge, publish, authorize cleanup,
or authorize any provider execution.
