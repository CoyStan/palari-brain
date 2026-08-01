# BRN-0002 Technical Report

## State

Pre-dispatch freeze. No credential has been read and no provider request,
benchmark result, score, or spend has occurred in this identity.

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
The output identity is absent. Both files and any eventual artifacts are
outside the ticket's repository danger zones. The launcher never loads
`.env`; only the verified one-shot runtime does, after it has created a fresh
terminal result identity.

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

## Review request

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
