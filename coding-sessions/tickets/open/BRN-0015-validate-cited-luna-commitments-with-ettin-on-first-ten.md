---
id: BRN-0015
title: "Validate cited Luna commitments with Ettin on first ten"
stream: memory
level: 1
parent_id: 
root_id: BRN-0015
children: []
status: in-review
risk: R3
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0015-validate-cited-luna-commitments-with-ettin-on-first-ten"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0015-validate-cited-luna-commitments-with-ettin-on-first-ten"
allowed_paths:
  - "evals/predictions.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0015-*.md"
  - "coding-sessions/tickets/closed/BRN-0015-*.md"
  - "coding-sessions/reports/BRN-0015-*.md"
  - "coding-sessions/human-report/BRN-0015-*.md"
  - "coding-sessions/handoffs/BRN-0015-*.md"
forbidden_paths:
  - ".env"
  - ".env.*"
  - "*.key"
  - "**/*.key"
  - "secrets/**"
  - "**/secrets/**"
  - "*secret*"
  - "**/*secret*"
  - "*token*"
  - "**/*token*"
  - "infra/prod/**"
  - "prod/**"
  - "runtime-data/**"
  - ".palari-probe/**"
  - ".palari-regression/**"
  - "data/**"
  - "evals/results/**"
requires_human_confirmation: true
requires_review: true
verification:
  - "node /home/quetza/palari-brain-private/luna-ettin-cited-first10-live-launcher.mjs --verify"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-04
updated: 2026-08-04
---

# BRN-0015 Validate cited Luna commitments with Ettin on first ten

## Goal

Measure whether the accepted provider-neutral cited answer-commit boundary
improves Luna's use of already-retrieved Ettin-ranked memory on the same fixed
private first-ten diagnostic. Freeze one fresh identity, prove the new live
commit function is wire-compatible, and record the first official result
without reroll, regrade, answer-specific tuning, or publication.

## Context And Authority

BRN-0014 is independently accepted, merged, and pushed on canonical `main` at
`c6e29c01e8862872508db6f681b6a21b1a434459`. Its offline boundary requires
Luna to return the exact host-created commitment after canonical retrieval,
with unique returned evidence IDs and exact contiguous quotes. The prior
terminal BRN-0013 identity completed the same ten questions with mechanically
correct Gemini semantic retrieval + native Ettin + Luna integration and an
immutable official 6/10. Three genuine failures occurred after all required
answer-bearing sessions reached Luna; one additional official failure was a
clear judge false negative and remains unchanged.

Quetzali directed autonomous ticket/review/fix work toward a no-bug 10/10
objective. That delegates offline preparation, independent review, and clean
routine merge, but it does not create a new provider-spend allowance. The
BRN-0013 `$1.50` authority was consumed by its one terminal invocation. This
ticket may be frozen and reviewed autonomously; dispatch requires a new exact
founder cap. Opening cumulative accounted spend is `$6.03072623`:
`$1.72334288` measured plus `$4.30738335` uncertain. The proposed fresh cap is
`$1.50`, producing a proposed cumulative boundary of `$7.53072623`.

## Scope

- Freeze fresh private identity `j4-luna-ettin-cited-first10-v1` from accepted
  product cut point `c6e29c0`. Bind every tracked product/eval input, immutable
  dataset/order, terminal predecessor bundle, private launcher/runtime, exact
  cached Ettin model/head bytes, provider/prompt/limit, prediction, and ledger
  before any inference or credential read.
- Preserve the exact ten ordered non-U8 S60 IDs and questions used by
  BRN-0013: `08e075c7`, `09d032c9`, `16c90bf4`, `5e1b23de`, `80ec1f4f_abs`,
  `0977f2af`, `0a34ad58`, `0edc2aef`, `10d9b85a`, and `1192316e`. Sealed U8
  `1568498a` must be absent and unreachable.
- Preserve Luna `gpt-5.6-luna`, Standard service, low reasoning,
  `store:false`; Gemini `gemini-embedding-001`; official
  `gpt-4o-2024-08-06` judge; exact sessions/questions, reducer, semantic
  behavior, native Ettin identity/math/artifacts, candidate pool and limits,
  four aggregate memory-call ceiling, serial order, and official grading.
  The only product treatment versus BRN-0013 is accepted BRN-0014.
- Build a fresh mode-0600 one-shot launcher outside git. It must refuse a
  changed/missing artifact, dirty/wrong checkout, existing result identity,
  early credential access, unmetered transport, absent exact founder cap, or
  repeat invocation.
- Within the one invocation, run the existing provider-free real-brain Ettin
  smoke and one live Gemini-semantic + Ettin + Luna cited-answer smoke that
  must return `answerCommitted: true` with an exact registered basis.
  Stop terminally before question 1 if any smoke fails. If all pass, answer
  and officially judge questions 1-10 once in order with repair-enabled
  reduction and the accepted cited-answer path.
- Reserve every physical Gemini, Luna, and judge request before dispatch;
  retain measured versus uncertain accounting; use no transport retry; stop
  before a request that could exceed the fresh or cumulative cap.
- Record exact terminal labels, commitment/basis telemetry, retrieval and
  rerank behavior, required-session coverage, calls, usage, latency, spend,
  artifact integrity/modes, zero-match credential scan, failing-first
  prediction grades, and product stop rule whatever the result is.

## Out Of Scope

- No product or prompt repair inside this measurement ticket; no benchmark
  answer, label, prior generated response, or question-specific rule may enter
  runtime logic.
- No provider/model/effort/dtype/embedder/judge/question/order/dataset/candidate
  limit change relative to BRN-0013, except the accepted BRN-0014 commitment
  wire and the compatibility smoke needed to validate it.
- No retry, resume, reroll, selective rerun, regrade, replacement identity,
  hidden result, or publication. Ten of ten is the product objective, not an
  acceptance criterion that permits tuning on these known answers.
- No access to sealed U8; no spend before a new exact founder cap; no secret,
  runtime, cache, model, dataset, transcript, or result byte in git.
- No claim that ten inspected questions estimate unseen-user generalization or
  that an exact citation proves semantic entailment.

## Acceptance Criteria

1. Before inference or provider access, FINAL predictions and the complete
   tracked/private identity are committed and pushed. Offline verification
   rehashes accepted BRN-0014, every terminal predecessor, dataset/order,
   launcher/runtime, exact model files, opening ledger, proposed cap, and
   absent result without reading credentials.
2. Fresh independent review confirms BRN-0014 is the only product treatment,
   known answers/labels are absent from runtime logic, all transports are
   metered, the cap is fail-closed, U8 is unreachable, and the invocation
   cannot execute twice. Dispatch remains stopped until the founder confirms
   the exact fresh cap.
3. After exact founder GO, the one invocation either seals a smoke failure or,
   if all smokes pass, produces one non-empty answer and one official judgment
   per ordered question unless a terminal cap/provider boundary stops the
   suffix. Every answer after non-empty retrieval must be authentically
   committed or fail terminally; no uncited fallback may be presented.
4. Pre-register before dispatch: compatibility and structural commitments
   pass; all ten questions complete; official score is at least 8/10 with
   10/10 the objective; at least two of the three BRN-0013 genuine answer-use
   failure rows reverse; no prior PASS regresses; the prior clear judge-false-
   negative row is reported separately without regrading; all accounting and
   call ceilings hold. Grade misses honestly and failing categories first.
5. The first invocation is final under the confirmed caps. `STATUS.md` records
   exact results and cumulative spend whatever they are. Full tests,
   quickstart, launcher/ticket/report/scope/diff checks, and fresh terminal
   review pass before delegated acceptance or a successor decision.

## Pre-Dispatch Freeze Evidence

- Product cut point: accepted BRN-0014 merge
  `c6e29c01e8862872508db6f681b6a21b1a434459`; clean canonical
  administrative head `4081adaa9f579361422988eecf5f2673adabf797` adds only this
  ticket contract.
- Private launcher/runtime SHA-256:
  `6ccc091b521cd3c9874805278ab7959e9fdb5523326fe775df01a37dd992f29b` /
  `d123525ec5e1c9bc1664fc9c323e9fa567831e9118d4e5cc273cfb29344c6ea2`;
  both are mode 0600. Terminal runtime-template SHA-256 remains
  `4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`.
- Offline verification rehashed eleven predecessor manifests and all 291
  predecessor artifacts, ten product/eval files, seven Ettin model/head
  files, the 3,208-file / 706,843,605-byte runtime closure, exact dataset and
  ordered population, and absent result identity. Sealed U8 is absent.
- The launcher requires exact runtime confirmations
  `PALARI_BRN0015_RUN_ID=j4-luna-ettin-cited-first10-v1` and
  `PALARI_BRN0015_FRESH_CAP_USD=1.50`. A denied `--run` without them stopped
  before result creation. Their presence is a mechanical gate only; this
  ticket still requires the founder's explicit cap confirmation in context.
- P-set 27 is FINAL before inference, credential read, provider dispatch, or
  score; full prediction-file SHA-256 is
  `844972a51ed4106dcb95c5f96666115f08710c1de5c38d9d76b1c5c9b4c26360`.
  Opening spend is `$6.03072623`; proposed boundaries are `$1.50` fresh
  and `$7.53072623` cumulative. No fresh cap is authorized yet.
- Provider calls, credential reads, local model inference, result bytes, and
  fresh spend: `0 / 0 / 0 / 0 / $0.00`.
- Full suite: 705 pass, 0 fail, 15 skip across 720 tests. Quickstart: 6/6.
  Package dry-run: 32 files, 133.9 kB packed / 482.5 kB unpacked, with no
  private model/runtime/result/credential content.
- Fresh independent review at exact
  `38800533af260861945b204e829383159f78eb1f` found no P0-P3 issue,
  independently repeated the freeze/meter/seal/suite checks, and recommends GO
  only after explicit founder confirmation of the exact cap.
- On 2026-08-04 Quetzali authorized verbatim: `I authorize BRN-0015
  j4-luna-ettin-cited-first10-v1 for one invocation under the $1.50 fresh /
  $7.53072623 cumulative accounted cap.` This satisfies the sole remaining
  founder gate for exactly one invocation and grants nothing beyond it.

## Verification

- `node /home/quetza/palari-brain-private/luna-ettin-cited-first10-live-launcher.mjs --verify`
- `npm test`
- `npm run quickstart`
- `npm run ticket -- check BRN-0015`
- `git diff --check`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before credentials, inference, or provider transport unless the founder
  confirms the exact fresh cap for this frozen identity.
- Stop terminally if a smoke, artifact, meter, cap, seal, or provider boundary
  fails. Record it; do not repair or resume inside the consumed identity.
- Stop and open a separate offline product ticket if the run discovers a
  general defect. Do not patch or rerun this measurement identity.
