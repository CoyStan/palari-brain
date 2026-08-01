# BRN-0002 Pre-Dispatch Reviewer Note

Reviewer: independent fresh-context pre-dispatch reviewer
Reviewed commit: `4cee7567b050687a5e85f439570a461020d3e1af`
Target branch: `main` at `9897a35abe298a7fd5af7a832d9a7f8925d6e712`

## Review Result

Pass. The frozen first-ten launcher is bounded, one-shot, fail-closed, and
consistent with P-set 19. No provider request, credential read, live run,
result, score, publication, or new spend occurred during this review.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none affecting dispatch. `git diff --check main...4cee756` reports only
  trailing spaces on the ticket's blank `claimed_by` and `claimed_at`
  frontmatter values, introduced by the lifecycle transition. Ticket lint and
  committed scope both pass, and these two metadata spaces do not affect the
  launcher, runtime, predictions, or evidence.

The exact ordered population contains ten unique IDs and hashes
`d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
The launcher verifies that this array is S60 ordinals 1-10 and that the
dataset hashes
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
It also rehashes all six named predecessor manifests and every artifact they
name without exposing private dataset or transcript text.

The prior `$3.10618695` ledger plus the rehashed terminal v5
`$0.4692177` reconciles to the frozen `$3.57540465` opening. Its classes also
reconcile exactly: `$1.5904422 + $0.0300114 = $1.6204536` measured and
`$1.51574475 + $0.4392063 = $1.95495105` uncertain. Adding the `$1.50` fresh
cap produces the exact `$5.07540465` cumulative boundary. Embedding and Gemini
answer calls reserve against the fresh meter before fetch; the judge is
prechecked against the same fresh cap and the judge transport independently
checks both fresh and opening-plus-fresh cumulative reservations before its
single attempt.

The launcher hashes
`ca214d38dddf57ac727f08033b05e067d621a882cf8fe3f09e51f20023858594`.
Its `--verify` path reproduced runtime hash
`29ce9a0c0a59a5bc01b364cb027c29bfdc4f5b6d41e0a384e895ee1d09c87dda`
from terminal v5 runtime
`0b820acfb1a81dc702031fa3002ca9b098aeaefdae68de17534f49dd0cfe89d7`.
An independent in-memory transformation diff found only import/root
relocation, the fresh identity and private output path, four added IDs, fresh
scope names, cap/opening values, the coverage key, and terminal summary text.

The coverage change from `row.evidence_id` to `row.id` is report-only:
`brain.listStatements()` exposes canonical statement IDs as `row.id`, and
`answerWithRetrieval()` reports those same IDs as `consultedEvidenceIds`.
The resulting map feeds only `consultedSessions` and coverage counts after the
answer; it does not feed retrieval, the answer request, its hypothesis, or the
official judge.

The frozen product, prompt, tool, and judge values independently reproduce:

- `src/brain.mjs`
  `01deae1731583442cde12e55a20ef285bd3b08fed7ecb933377839a4b11f53f2`;
- `src/retrieval-answer.mjs`
  `c322357999e35d13b366b72e23d5a1cc6c3f8ae3df4937456426e9d491a45972`;
- five raw Gemini declarations
  `d2d09fa4b32372324ff8ab8b53b2683e2a4580e87eeb409fba3c942ca7912d0f`;
- assembled answer system instruction
  `69f6a15608fb8541e5b0df86dae23401c97f0fe1b9d6ef3c594977db3334939e`;
- official judge request configuration
  `f0fdcc9a6a584c550b8c5ea8d961422b0ab3c2a054ea4ca5ce1cd0fa36e7c048`
  with model `gpt-4o-2024-08-06`.

Relative to the terminal v5 result commit, the only runtime-surface changes
on current `main` are the accepted BRN-0001 changes in `src/brain.mjs` and
`src/retrieval-answer.mjs`; P-set 19 pins both current files and the new
provider-free regression. Gemini adapter, semantic embedder, captured judge
factory, judge body, judge transport, model, no-store setting, tool schemas,
generation configuration, and provider fetch paths did not drift. After
P-set 19 was committed, only ticket lifecycle metadata changed before the
reviewed commit.

The launcher refuses `--run` if either the private runtime marker or result
identity exists. On the first permitted invocation it completes predecessor,
product, dataset, order, and source-runtime verification before writing the
mode-0600 runtime marker. The generated runtime then completes dataset
preflight, refuses an existing result, creates the fresh result directory and
durable start/meter records, and only then loads `.env` and reads the two key
fields. Imported product/evaluation modules do not read those credential
names on import. No provider path is reachable until afterward.

The runtime awaits the combined native-tool/semantic compatibility smoke
before entering the ordered question loop. A smoke failure enters the
terminal failure path with zero reached questions. Otherwise each question
is answered and officially judged sequentially once; the source contains no
transport retry, reroll, selective regrade, or continuation after an error.
At review time both the private runtime marker and result identity are absent.

## Verification Reviewed

- `sha256sum` and `node --check` on the private launcher — pass; launcher hash
  matches P-set 19.
- `node /home/quetza/palari-brain-private/retrieval-first10-live-v1-launcher.mjs --verify`
  — pass; exact ten IDs, dataset, product files, six predecessor bundles,
  source/runtime hashes, and absent runtime/result reported.
- Independent in-memory terminal-v5-to-first-ten transformation diff — pass;
  only the declared changes listed above.
- Independent hash reproduction for ordered population, answer instruction,
  canonical retrieval tools, five raw Gemini declarations, and judge request
  configuration — pass.
- `npm run ticket -- ticket-lint-all` — pass.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0002`
  — pass for all five pre-note changed paths.
- `npm run answer-interpretation-regression` — pass, 5/5 structural cases;
  answer quality ungraded; provider/network `0/0`.
- `npm test` — pass, 644 passed, 0 failed, 15 skipped (659 total).
- `npm run quickstart` — pass, all six journey stages.
- Canonical `main` was clean and synchronized with `origin/main` at
  `9897a35`; the ticket worktree was clean at the reviewed commit before this
  note.

## Required Changes

None before dispatch. The ticket-frontmatter whitespace can be normalized in
a later documentation-only lifecycle edit; it does not justify changing the
frozen launcher, runtime, product, or predictions.

## Recommendation

Recommend **GO** for exactly one invocation of the frozen
`j4-active-retrieval-first10-v1` launcher under the existing founder
authorization and `$1.50` fresh cap. This recommendation does not invoke the
launcher, read credentials, accept or merge the ticket, authorize any rerun,
or permit changes to P-set 19 or terminal predecessor evidence. Any first
outcome remains terminal.
