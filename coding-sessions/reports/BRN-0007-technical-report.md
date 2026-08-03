# BRN-0007 Technical Report

## State

Pre-dispatch freeze prepared. Provider calls, credential value reads, result
identities, and fresh spend are zero. Execution remains blocked until the
tracked freeze is committed and pushed and a fresh reviewer recommends GO.

## Frozen Experiment

- Identity: `j4-luna-retrieval-first10-v2`.
- Product cut point: accepted BRN-0006 `3f42023`; administrative contract head
  `6541572` changes no evaluated product byte.
- Population: exact S60 ordinals 1-10; ordered-array SHA-256
  `d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
- Dataset SHA-256:
  `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
- Answer: `gpt-5.6-luna`, Standard, low reasoning, no-store, serial tools.
- Fixed controls: Gemini `gemini-embedding-001`; official
  `gpt-4o-2024-08-06` judge; unchanged questions, memory, ranking, prompts,
  grading, and U8 seal.
- Changed treatment: at most four aggregate memory calls, then one request
  with `tool_choice: "none"` and no `tools` field.
- Opening ledger: `$4.7428483` accounted = `$1.6851439` measured +
  `$3.0577044` uncertain. Hard boundaries: `$1.00` fresh / `$5.7428483`
  cumulative.

## Private Launcher

The mode-0600 wrapper is
`/home/quetza/palari-brain-private/luna-first10-live-v2-launcher.mjs`, SHA-256
`84a55389a824b7bdb7a045446fe994d0b1f9871e2979b9781abe3c61fec0411a`.
It verifies frozen v1 launcher template
`4f2e425e8239b5304157a47745ddeaa025a14960ae120473a1b0a5fe2b097eb4`,
generates delegate
`25506fbbffac2fb6bf2ffcdcd662fb503c9b946629b2a006f43c59f4fa4ed2ee`,
and generates runtime
`4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`.

The launcher rehashes eight predecessor bundles, including terminal Luna v1,
and eight current product/eval files. It checks dataset/order, syntax, caps,
and absent runtime/result before the delegate can load `.env`. The runtime
creates its private one-way identity before credential loading. All embedding,
answer, and judge calls reserve against one aggregate fail-closed meter before
network dispatch. It has no transport retry. Request headers are never written;
terminal artifacts are exact-value scanned against configured credentials.

## Files Changed

- `evals/predictions.md`: FINAL P-set 21 freeze and unchanged predictions.
- `docs/DECISIONS.md`: founder authority and exact execution boundary.
- `STATUS.md`: pre-dispatch state, hashes, accounting, and next gate.
- `coding-sessions/tickets/open/BRN-0007-*.md`: governed contract and lifecycle.
- `coding-sessions/reports/BRN-0007-technical-report.md`: this evidence.
- `coding-sessions/human-report/BRN-0007-human-report.md`: founder-readable
  interpretation.

The private launcher is intentionally outside git and is not a tracked path.

## Verification

- `node --check .../luna-first10-live-v2-launcher.mjs`: PASS.
- `node .../luna-first10-live-v2-launcher.mjs --verify`: PASS.
- Generated runtime syntax: PASS inside verification.
- Predecessor bundles: 8/8 rehashed.
- Product/eval inputs: 8/8 rehashed.
- Dataset and question order: exact; v2 runtime/result absent.
- Provider calls / fresh spend: 0 / `$0.00`.
- Full suite: 667 pass, 0 fail, 15 skipped across 682 tests.
- Quickstart: 6/6.
- Ticket/report/scope checks: pass before freeze commit.
- Independent pre-dispatch review: pending.

## Risks / Follow-Ups

- These ten cases are known and cannot establish unseen-data performance.
- A live provider or cap failure is terminal, not repair authority.
- Gemini embedding usage is not reported, so its conservative reservation may
  dominate accounted spend again.
