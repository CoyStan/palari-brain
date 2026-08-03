# BRN-0007 Pre-Dispatch Reviewer Note

Reviewer: independent fresh-context pre-dispatch reviewer
Reviewed commit: `327b5010e2362605e00bade87d11cc05ab388772`
Target branch: `main` at `654157293a9a8b5610f677d00960cc3f620d3685`

## Review Result

Pass. The frozen `j4-luna-retrieval-first10-v2` experiment is internally
consistent, one-shot, fail-closed, and ready for exactly one founder-authorized
invocation. No provider request, credential value read, live run, private
answer or transcript-body inspection, result creation, publication, or fresh
spend occurred during this review.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none affecting dispatch. Some tracked freeze prose necessarily still
  says that commit/push is the next action, but the reviewed freeze is now both
  committed and pushed: local and remote ticket refs resolve to reviewed HEAD
  `327b501` and canonical local/remote `main` resolve to `6541572`.

The offline launcher verification confirms that the fresh private runtime and
result paths are both absent. Its exact ordered population is the ten IDs
`08e075c7`, `09d032c9`, `16c90bf4`, `5e1b23de`, `80ec1f4f_abs`, `0977f2af`,
`0a34ad58`, `0edc2aef`, `10d9b85a`, and `1192316e`, matching P-set 21 and
the frozen S60 order. Their ordered-array hash is
`d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
Sealed U8 `1568498a` is not in the selection and is unreachable through the
fixed first-ten array.

The mode-0600 private wrapper independently hashes
`84a55389a824b7bdb7a045446fe994d0b1f9871e2979b9781abe3c61fec0411a`.
Its `--verify` path reproduced generated delegate hash
`25506fbbffac2fb6bf2ffcdcd662fb503c9b946629b2a006f43c59f4fa4ed2ee`
and generated runtime hash
`4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`
from frozen v1 template
`4f2e425e8239b5304157a47745ddeaa025a14960ae120473a1b0a5fe2b097eb4`
and source runtime
`0b820acfb1a81dc702031fa3002ca9b098aeaefdae68de17534f49dd0cfe89d7`.
It rehashed all eight predecessor manifests and every artifact they name,
including terminal Luna v1 manifest
`574c865ca3755cf794b002de5b12ec3d474ae235b51e894772222dd97b48b5d8`.
Thus v1 and all earlier evidence remain immutable before v2 can dispatch.

All eight frozen current product/evaluation hashes reproduced, including
`src/retrieval-answer.mjs`
`4664516f2f1e9cd39fdf8464242b416ee22ae7bf0a06ae6aaee0f0ca63affa34`
and `src/openai.mjs`
`2b46a772b02f595b29ff4026f5b5a06124d184a3850fc40baa30cbf9cc882fea`.
Those hashes also reproduce from accepted BRN-0006 cut point `3f42023`; the
only later canonical-main change is the BRN-0007 administrative ticket
contract. Relative to terminal BRN-0005 product, the only product-code changes
are the accepted BRN-0006 behavior: a host-enforced aggregate ceiling of four
calls across all five memory tools and a provider state that, after executing
call four, makes exactly one following dispatch with `tool_choice: "none"`,
no `tools` field, and complete prior reasoning/tool outputs. Calls zero through
three may still return normally. Both the host and adapter reject a configured
ceiling above four; a fifth tool cannot execute, and a tool call during
finalization fails terminally.

The launcher is one-shot in two layers. Before creating any persistent v2
evidence it refuses if either the runtime marker or result identity already
exists. On the first permitted invocation it completes predecessor, product,
dataset, order, source-runtime, generated-runtime, syntax, and cap checks,
then creates the mode-0600 runtime marker. The generated runtime performs its
dataset preflight,
refuses an existing result, creates the private result directory, and durably
writes the initial meter and start record before loading `.env` or reading the
two credential fields. Either marker makes any later invocation refuse, even
if the first invocation fails before a provider request.

Every provider is behind the same fail-closed fresh accounting state. Gemini
embedding batches reserve before fetch and retain uncertainty when usage is
unreported. Every Luna Responses dispatch reserves before fetch, validates
the frozen Standard/low/no-store/serial-tool wire, and settles only from valid
usage. Each official-judge call is prechecked against that same state, then
uses the frozen single-attempt judge transport, which independently enforces
fresh and opening-plus-fresh cumulative reservations before fetch; its
measured or uncertain outcome is reconciled into the aggregate state. The
exact opening ledger is `$4.7428483` accounted = `$1.6851439` measured +
`$3.0577044` uncertain. Because the fresh hard cap is `$1.00` and the
cumulative boundary is exactly `$5.7428483`, satisfying the aggregate fresh
meter also satisfies the cumulative J4 boundary.

P-set 21 is genuinely pre-dispatch: it is marked FINAL in committed freeze
`24688b5`, while offline verification reports no v2 runtime or result and the
tracked evidence reports zero calls, credential reads, and spend. It uses v1
only to define the causal intervention and structural prediction. The accuracy,
provider-delta, retrieval-control, compatibility, semantic-use, and terminal
execution predictions carry P-set 20 forward without outcome tuning; the new
primary prediction is the intended BRN-0006 treatment effect that all ten
complete and ordinal 5 finalizes rather than looping. The file explicitly
forbids rerun, selective regrade, prediction edit, or replacement identity.

## Verification Reviewed

- `node --check` on the private v2 wrapper — pass; wrapper mode is 0600.
- Private v2 launcher `--verify` — pass; 8/8 predecessor bundles, 8/8
  product/evaluation files, exact dataset/order, generated runtime syntax and
  all three frozen hashes pass; v2 runtime/result are absent.
- Accepted BRN-0006 focused contracts — 26 passed, 0 failed.
- Full `npm test` — 667 passed, 0 failed, 15 skipped across 682 tests.
- `npm run quickstart` — pass, all six journey stages.
- Repository-wide ticket lint — pass before this note.
- `git diff --check main...HEAD` — pass before this note.
- The ticket worktree was clean at reviewed HEAD before this note; the note is
  the only intended uncommitted path.

## Required Changes

None before dispatch. The reviewer note itself must be committed and pushed,
as the ticket completion contract requires, before the authorized invocation.

## Recommendation

Recommend **GO** for exactly one invocation of the frozen mode-0600
`j4-luna-retrieval-first10-v2` launcher under the existing founder authority,
`$1.00` fresh cap, and `$5.7428483` cumulative J4 boundary. This recommendation
does not execute the launcher, accept or merge the ticket, publish any result,
authorize a rerun, or permit changes to P-set 21, the launcher/runtime freeze,
or predecessor evidence. The first outcome, including a pre-question or
provider failure, remains terminal.
