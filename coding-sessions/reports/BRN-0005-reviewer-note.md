# BRN-0005 Pre-Dispatch Reviewer Note

Reviewer: Codex, independent fresh-context pre-dispatch reviewer
Reviewed commit: `96658a7357a899e2758ad5d75a35997680884fcf`
Target branch: `main` at `42b9b464a4d5a47e17b87b07d7ef1a3f8bbcc278`

## Review Result

Fail for dispatch on one bounded evidence-contract issue. The frozen Luna
first-ten launcher itself is one-shot, fail-closed, privately evidenced, and
consistent with P-set 20, but the R3 technical report does not satisfy the
repository's required report headings and `report-lint` therefore fails. No
provider request, credential read, live run, result, score, publication, or
fresh spend occurred during this review.

## Findings

- P0: none.
- P1: `coding-sessions/reports/BRN-0005-technical-report.md` is not recognized
  as a technical report by the governed ticket tooling. R3 reports require
  exact `Files Changed`, `Verification`, and `Risks / Follow-Ups`
  headings; this report had no `Files Changed` section and used
  `Offline Verification` instead of `Verification`. Consequently
  `npm run ticket -- report-lint BRN-0005` fails with
  `BRN-0005: missing technical report`, and `npm run ticket -- check BRN-0005`
  cannot be green. The ticket's Evidence Required explicitly includes report
  lint, so pre-dispatch evidence is incomplete even though the underlying
  launcher review found no safety or correctness defect.
- P2: none.
- P3: none.

The committed branch changes exactly the six declared freeze/evidence paths;
no forbidden path changed. The ticket remains `in-review`, and the specialist
did not accept, close, merge, or execute its own work.

The launcher is mode 0600 and independently hashes
`4f2e425e8239b5304157a47745ddeaa025a14960ae120473a1b0a5fe2b097eb4`.
Its offline path reproduced generated-runtime hash
`b9c60472cc3190fb8eb72a947ad5f5937cb7094d2cdefdd1efe1a22d96cafadd`
from the rehashed terminal-v5 source runtime. An independent in-memory
transformation inspection found one OpenAI answer-provider region, no old
Gemini answer transport, one Responses fetch, and the preserved Gemini
embedding endpoint and captured official-judge factory. Both the private
runtime marker and result identity were absent at review time.

The exact ten unique IDs reproduce ordered-array hash
`d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
The launcher rehashed the frozen dataset, all eight product/evaluation inputs,
and all seven predecessor bundles, including the terminal Gemini first-ten
manifest. Independently assembled answer instructions reproduce
`69f6a15608fb8541e5b0df86dae23401c97f0fe1b9d6ef3c594977db3334939e`,
and the five OpenAI function declarations reproduce
`3a955ef2069603b9bf0842412feb6600a521d7474a1c7a73d7daf11d4fed8354`.

Only answer generation and answer-tool decisions move to
`gpt-5.6-luna` at low reasoning. The generated runtime continues to construct
semantic vectors through `gemini-embedding-001`; it retains the frozen
LongMemEval prompt/parser and captured one-shot `gpt-4o-2024-08-06` judge.
The runtime pins `store:false`, serial function calls, encrypted-reasoning
inclusion, completed status, response model, usage schema, and the seven-model
dispatch ceiling. The accepted adapter replays the complete provider output
array in order before appending host-owned `function_call_output` entries, so
reasoning items and tool-call identity survive continuation while retrieval
authority remains local.

The launcher refuses `--run` when either runtime or result exists. On the
first allowed command, all offline hashes and syntax checks finish before the
mode-0600 runtime marker is written. The generated runtime then performs its
dataset preflight, atomically creates the private result identity and initial
meter, and only afterward loads `.env` and reads the two credential fields.
Thus an interrupted or failed first invocation remains sealed. Compatibility
runs before the ordered question loop and requires a real semantic
`memory_search` plus the planted indigo answer; failure is recorded before
question 1. Each later question answers and judges sequentially, and the
first failure terminates the run. No answer, embedding, or judge transport has
a retry path.

Every Gemini embedding and Luna Responses request calls the aggregate reserve
function before fetch. The judge separately persists a one-shot priority-tier
reservation and checks both its fresh and cumulative projections before its
single POST, then reconciles into the same aggregate meter. Successful Luna
usage records input, cached-input, output, and reasoning tokens; failed or
invalid responses retain the conservative reservation as uncertainty. The
opening classes reconcile exactly:
`$1.6734941 + $2.6907708 = $4.3642649`; adding the `$1.00` fresh cap gives
the frozen `$5.3642649` cumulative boundary.

Request headers are never transcribed. OpenAI answer transcripts contain only
the JSON request and raw response in the private result directory; judge
evidence additionally redacts credential-shaped response fields. After any
reached runtime terminal state, the launcher exact-value scans every result
artifact against both configured credentials and requires zero matches before
writing the artifact manifest. The tracked diff contains no credential-shaped
value.

## Verification Reviewed

- Exact reviewer packet generated from clean, synchronized canonical `main`;
  ticket worktree clean at assigned HEAD before this note.
- `sha256sum` and `node --check` on the private launcher — pass; mode 0600 and
  hash match P-set 20.
- `node /home/quetza/palari-brain-private/luna-first10-live-v1-launcher.mjs --verify`
  — pass; exact order, dataset, 8/8 inputs, 7/7 predecessor bundles,
  source/runtime hashes, and absent runtime/result reproduced.
- Independent in-memory runtime transformation and hash reconstruction —
  pass; provider/control, reservation-before-fetch, credential-ordering,
  compatibility-ordering, prompt hash, and function-tool hash checks match.
- `node --test tests/openai.contract.test.mjs tests/incremental-longmemeval-judge.contract.test.mjs tests/incremental-longmemeval-judge-transport.contract.test.mjs tests/active-retrieval-seen6-runtime.contract.test.mjs`
  — pass, 37/37.
- `npm test` — pass, 664 passed, 0 failed, 15 skipped across 679 tests.
- `npm run quickstart` — pass, all six journey stages.
- `npm run ticket -- ticket-lint-all` — pass.
- `npm run ticket -- report-lint BRN-0005` — fail: the existing technical
  report lacks the required exact `Files Changed` and `Verification` headings.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0005`
  — pass for all seven committed-plus-dirty paths after this note.
- `git diff --check main...HEAD` — pass before this note.
- Provider/network calls: 0. Credential reads: 0. Fresh spend: `$0.00`.

## Required Changes

Amend only `coding-sessions/reports/BRN-0005-technical-report.md` so it contains
the exact required `Files Changed`, `Verification`, and
`Risks / Follow-Ups` headings while preserving the frozen experiment and
launcher evidence. Then rerun `report-lint`, the combined ticket check, and a
fresh pre-dispatch review. Do not change P-set 20, launcher/runtime bytes,
product files, question order, identities, controls, caps, or predecessor
evidence to make this process fix.

## Recommendation

Recommend `reopen`. Do not dispatch the frozen
`j4-luna-retrieval-first10-v1` launcher until the bounded technical-report
format issue is repaired, report lint and the combined ticket check pass, and
a fresh reviewer recommends GO. This recommendation does not execute the
launcher, implement the fix, accept, close, merge, push, publish, authorize a
rerun or regrade, or permit a replacement identity.
