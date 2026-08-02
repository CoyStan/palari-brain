# BRN-0005 Fresh Pre-Dispatch Reviewer Note

Reviewer: Codex, independent fresh-context pre-dispatch reviewer
Reviewed commit: `975d906edc52cf508fc37c8c30636645f08dcf52`
Target branch: `main` at `42b9b464a4d5a47e17b87b07d7ef1a3f8bbcc278`

## Review Result

Pass for dispatch. The sole prior blocker was the technical report's missing
required section names. That bounded repair is present, the governed report
tooling now recognizes all required evidence, and the frozen experiment and
private launcher/runtime controls independently revalidate. No provider
request, credential read, live run, result, score, publication, or fresh spend
occurred during this review.

## Findings

- P0: none.
- P1: none. The first review's report-classification defect is resolved by the
  exact required `Files Changed`, `Verification`, and `Risks / Follow-Ups`
  sections. `report-lint` and the combined ticket check are green.
- P2: none.
- P3: none.

The repair after the first reviewed freeze adds only the missing technical
report sections, removes classifier-ambiguous wording from the preserved first
review note, and performs the normal claimed-to-in-review lifecycle round trip.
It does not change P-set 20, the founder decision, STATUS freeze, human report,
launcher/runtime bytes, identity, population, provider controls, caps, product
hashes, or predecessor evidence.

The complete committed branch delta against `main` contains exactly the seven
declared freeze/evidence paths. Every path is allowed, no forbidden path is
changed, the ticket remains `in-review`, and the specialist did not accept,
close, merge, dispatch, or publish its own work.

The private launcher remains mode 0600 and hashes
`4f2e425e8239b5304157a47745ddeaa025a14960ae120473a1b0a5fe2b097eb4`.
Its offline preparation reproduced generated-runtime hash
`b9c60472cc3190fb8eb72a947ad5f5937cb7094d2cdefdd1efe1a22d96cafadd`
from terminal-v5 source runtime hash
`0b820acfb1a81dc702031fa3002ca9b098aeaefdae68de17534f49dd0cfe89d7`.
Both the private runtime marker and result identity remain absent.

Independent in-memory inspection of the generated runtime found exactly one
`gpt-5.6-luna` answer-model declaration and one OpenAI Responses fetch, with no
legacy Gemini answer invocation. The answer wire fixes low reasoning,
`store:false`, serial tool calls, encrypted-reasoning inclusion, completed
status, exact model validation, usage validation, and a seven-dispatch ceiling.
The accepted adapter replays the complete provider output array in order before
appending host-owned `function_call_output` records, preserving reasoning and
tool-call identity while leaving retrieval authority with Palari.

Only answer generation and answer-tool decisions change provider. Semantic
vectors still use `gemini-embedding-001`, and the runtime retains the captured
one-shot official `gpt-4o-2024-08-06` judge factory and frozen judge parser.
The exact ten unique IDs reproduce ordered-array hash
`d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
The unchanged answer instructions reproduce
`69f6a15608fb8541e5b0df86dae23401c97f0fe1b9d6ef3c594977db3334939e`,
and the five provider-neutral OpenAI function declarations reproduce
`3a955ef2069603b9bf0842412feb6600a521d7474a1c7a73d7daf11d4fed8354`.

Launcher verification rehashed the frozen dataset, all eight current
product/evaluation inputs, and all seven terminal predecessor bundles,
including the Gemini first-ten 5/10 manifest. It syntax-checked the generated
runtime and confirmed the exact question order and absent runtime/result.

Every Gemini embedding and Luna Responses dispatch durably reserves against
the aggregate fresh meter before fetch. The official judge transport validates
fresh and cumulative projections, atomically records its sole attempt before
its single POST, forbids retry, and reconciles into the same aggregate meter.
Failed or invalid calls retain conservative uncertainty. The opening classes
reconcile exactly as `$1.6734941 + $2.6907708 = $4.3642649`; the `$1.00` fresh
cap yields the frozen `$5.3642649` cumulative boundary.

The launcher refuses dispatch when either the runtime marker or result identity
exists. For the first allowed command, every predecessor, product, dataset,
order, source-runtime, generated-runtime, and syntax check completes before
the runtime marker is written. The runtime then performs dataset preflight,
creates the private result identity and started meter, and only afterward loads
the ignored environment file and reads the two credential fields. The semantic
indigo compatibility smoke precedes question 1. Any smoke or later failure
stops progress, records or preserves one-way evidence, and leaves the runtime
or result identity sealing the invocation. There is no answer, embedding, or
judge retry path.

Answer transcripts record the request body and raw response privately but not
headers. Judge evidence filters and redacts credential-shaped response fields.
After a reached terminal runtime state, the launcher exact-value scans all
result artifacts against both configured credential values before writing the
manifest. The tracked branch diff contains no credential-shaped value.

## Verification Reviewed

- Regenerated the exact reviewer packet from clean, synchronized canonical
  `main`; the ticket worktree was clean at assigned HEAD before this note.
- Inspected the committed diff against `main` and the bounded repair against
  the first reviewed freeze; `git diff --check` passed.
- `stat`, `sha256sum`, and `node --check` on the private launcher — pass; mode
  0600 and frozen hash match.
- `node /home/quetza/palari-brain-private/luna-first10-live-v1-launcher.mjs --verify`
  — pass; exact population, dataset, 8/8 inputs, 7/7 predecessor bundles,
  source/runtime hashes, provider bindings, and absent runtime/result reproduced.
- Independent in-memory runtime reconstruction and structural assertions —
  pass for provider/control isolation, reservation-before-fetch,
  credential ordering, compatibility ordering, terminal sealing, and hashes.
- Independent question-order, answer-instruction, and five-tool hash
  reconstruction — pass.
- Focused OpenAI adapter, incremental judge, one-shot judge transport, and
  active-runtime contracts — pass, 37/37.
- `npm test` — pass, 664 passed, 0 failed, 15 skipped across 679 tests.
- `npm run quickstart` — pass, all six journey stages.
- `npm run ticket -- ticket-lint-all` — pass.
- `npm run ticket -- report-lint BRN-0005` — pass after the bounded repair.
- `npm run ticket -- check BRN-0005` — pass after the bounded repair.
- Provider/network calls: 0. Credential reads: 0. Fresh spend: `$0.00`.

## Required Changes

None.

## Recommendation

Recommend `GO` for exactly one invocation of the already-authorized frozen
`j4-luna-retrieval-first10-v1` launcher, only while its existing preconditions
remain true: hashes reverify, runtime and result remain absent, both ignored
credentials are configured, and founder authority remains in force. This GO
does not accept, close, merge, push, publish, rerun, regrade, authorize a
replacement identity, or waive the required fresh post-dispatch review.
