# BRN-0002 Technical Report

## State

Terminal post-run evidence. The independently reviewed freeze was invoked
exactly once, completed all ten questions, and is sealed at 5/10. No retry,
reroll, selective regrade, second invocation, or publication occurred.

## Frozen execution

- Identity: `j4-active-retrieval-first10-v1`.
- Population: LongMemEval S60 ordinals 1-10, ordered IDs and population hash
  frozen in P-set 19.
- Providers: Gemini `gemini-3.5-flash-lite` for answer/tool use and semantic
  embedding; unchanged OpenAI `gpt-4o-2024-08-06` official judge.
- Opening ledger: `$3.57540465` accounted, comprising `$1.6204536` measured
  plus `$1.95495105` uncertain.
- Hard boundaries: `$1.50` fresh and `$5.07540465` cumulative.
- Invocation: one launcher command once. Compatibility failure stops before
  question 1; otherwise the ten questions run in order. Any later error is
  terminal and authorizes no retry.

The private launcher lives outside the repository at
`/home/quetza/palari-brain-private/retrieval-first10-live-v1-launcher.mjs`.
It hashes `ca214d38dddf57ac727f08033b05e067d621a882cf8fe3f09e51f20023858594`;
its deterministic runtime hashes
`29ce9a0c0a59a5bc01b364cb027c29bfdc4f5b6d41e0a384e895ee1d09c87dda`.
At the pre-dispatch review, the output identity and runtime marker were absent.
Both files and the now-terminal artifacts are outside the ticket's repository
danger zones. The launcher never loads `.env`; only the verified one-shot
runtime did, after it created a fresh terminal result identity.

## Verification before review

- `node --check ...launcher.mjs`: pass.
- `node ...launcher.mjs --verify`: pass; all six predecessor manifests and
  their artifacts rehash, all five product files rehash, dataset/order rehash,
  and runtime/result absence is true.
- `npm run answer-interpretation-regression`: pass, 5/5 structural cases,
  answer quality ungraded, provider/network 0/0.
- `npm test`: pass, 644 pass, 0 fail, 15 skipped in the isolated worktree.
  The skips are private-evidence/dataset availability checks; canonical main
  retains those ignored files and is tested again after merge.
- `npm run quickstart`: pass, 6/6.
- `npm run ticket -- ticket-lint-all`: pass.

## Pre-dispatch review request

The independent reviewer should inspect the complete committed diff, P-set
19, ticket risk/scope, and private launcher read-only. In particular confirm:

1. exactly ten frozen questions, one invocation, no terminal identity reuse;
2. compatibility precedes question 1 and failures are terminal;
3. `$1.50` fresh cap plus exact opening ledger is enforced at embedding,
   answer, and judge boundaries;
4. credentials are unavailable until offline hashes and result absence pass;
5. the runtime changes only population, identity/output path, cap/opening
   accounting, scope IDs, terminal label, and the known report-only coverage
   key; and
6. no product, provider, answer, retrieval, or judge behavior changed after
   predictions were written.

## Terminal result

- Began `2026-08-01T00:12:17.050Z`; completed
  `2026-08-01T00:15:44.481Z`.
- Compatibility: pass before question 1.
- Official score: 5/10; first six 4/6; ordinals 7-10 1/4.
- Prior v5 answer-use misses repaired: 1/3 (`5e1b23de`).
- Positive answer-session coverage: 11/13. Four failed answers had all
  required sessions; the remaining failed answer had 0/2.
- Semantic use: 10/10 questions, 16 scored semantic searches.
- Answer boundary: 10/10 complete, no truncation or retrieval exhaustion.
- Calls: 97 embedding batches carrying 4,796 requests, 31 Gemini generations,
  and ten official judges; all 138 physical calls succeeded.
- Fresh spend: `$0.78886025` accounted = `$0.0530405` measured +
  `$0.73581975` uncertain.
- Cumulative J4 spend: `$4.3642649` accounted = `$1.6734941` measured +
  `$2.6907708` uncertain.

P-set 19 fails OFFICIAL ACCURACY, both score subpredictions, REPAIRED FAILURE
CLASSES, and RETRIEVAL COVERAGE. It passes COMPATIBILITY/JUDGE WIRING,
SEMANTIC USE, ANSWER BOUNDARY, and EXECUTION/ACCOUNTING. The failures divide
into four evidence-to-answer-use failures (`09d032c9`, `0977f2af`,
`0a34ad58`, `0edc2aef`) and one retrieval failure (`10d9b85a`).

## Terminal evidence

Private result:
`/home/quetza/palari-brain-private/j4-active-retrieval-first10-v1`.
The 65-artifact content list hashes
`60709b04c05287d68b4954503edd730ceeae12c8b70da1b328004b72479f6f13`;
the manifest hashes
`554efab7c320ae2c2224ddbb9976d4a0b75afe66a5dab02c2ab227bc5b16816c`.
Every artifact rehashes. Files are mode 0600 and directories mode 0700.
Exact-value scanning found both provider credentials configured and zero
occurrences across 674 tracked/private files outside `.env`.

## Final review request

Review the immutable report/meter/manifest and this tracked closeout against
P-set 19. Confirm the score/failure categories, 138-call reconciliation,
fresh/cumulative spend, artifact hashes, secret scan, no product-code diff,
and terminal no-rerun status. Recommend accept or reopen; do not invoke any
provider or alter terminal evidence.
