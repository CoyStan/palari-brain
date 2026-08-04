# BRN-0010 Technical Report

## State

Terminal failed identity. After clean pre-dispatch GO, the launcher ran exactly
once. The provider-free local real-brain Ettin smoke failed during tokenizer
loading before any finite score, credential-read intent, `.env` access, live
compatibility, question, provider call, label, or spend. No rerun occurred.

## Terminal Result

- Failure: `TypeError: Cannot read properties of undefined (reading
  'tokenizer_class')` during Transformers.js `AutoTokenizer.from_pretrained`.
- Reached: exclusive attempt reservation/consumption, dataset preflight,
  zeroed meter, four-turn local canonical ingest, then first reranked search.
- Not reached: local score/result, credential intent/stage, `.env`, live
  compatibility, all ten questions, and all providers.
- Calls and labels: 0 provider calls; 0 answers; 0 judges; 0 labels.
- Fresh spend: `$0.00` measured + `$0.00` uncertain = `$0.00` accounted.
  Cumulative remains `$5.27173386` = `$1.70023596` measured + `$3.5714979`
  uncertain.
- Manifest SHA-256:
  `aceab5b79409dc441526097c4c0e401d912ca7fde2fa99139513bdf324b2d60a`.
  All 5/5 artifacts (238,834 bytes) rehash at mode 0600; directories are mode
  0700; seal status is clean with zero sealing errors.
- Credential record: intent false, environment-loaded false, configured
  values 0, matches 0, scan not performed because no read intent existed.
- Static diagnosis: `AutoTokenizer` received undefined tokenizer config.
  BRN-0009's successful runner did not disable remote-model resolution, while
  BRN-0010 set `env.allowRemoteModels=false`. This is the leading hypothesis,
  not a proven cause; proving it would require a new identity.

## Causal Contract

- Fresh identity: `j4-luna-ettin-first10-v1`.
- Control: terminal BRN-0007 Luna-low answer path, Gemini semantic embedder,
  official OpenAI judge, exact first-ten population, prompts, memory, serial
  order, four-call ceiling, and tool-disabled finalization.
- Treatment: inject accepted native Ettin-17M into the bounded canonical RRF
  candidates before unchanged limit and character budget.
- Interpretation: known-case private causal diagnostic, not unseen accuracy.
- Execution: one local real-brain smoke, then one live compatibility smoke,
  then ten answer/judge cells only if both pass. Any stop is terminal.

## Frozen Identity

- Dataset SHA-256:
  `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
- Ordered first-ten SHA-256:
  `d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf`.
- Sealed U8 `1568498a`: absent and unreachable.
- Launcher SHA-256:
  `44dbd48b1265775971264f7ad40a6de9e2e9a4a359b0f7d525743608c436dd67`.
- Generated runtime SHA-256:
  `be7d95440b7739beb7ff0331076f5d08cd130e6924df1953e4235ce87a0890f4`.
- Terminal BRN-0007 template SHA-256:
  `4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`.
- Ettin runtime closure: 3,208 files, 706,843,605 bytes, one contained
  symlink, SHA-256
  `a0aca4625ff6793abaf7fb0db2b01328dee50eb7488e3c5a869dfe2d5ae93d96`.
- Opening ledger: `$5.27173386` accounted = `$1.70023596` measured +
  `$3.5714979` uncertain. Hard limits: `$1.50` fresh / `$6.77173386`
  cumulative.

The replacement mode-0600 launcher requires exact clean canonical commit
`b010d73ad167ff7ff3435607019ed758f9cb79bc`, thereby pinning every tracked
execution byte, and also rehashes nine complete predecessor bundles, ten
current product/eval files, the exact dataset/order, seven exact model/head
artifacts, and the complete isolated Transformers.js closure. `--verify` is
credential-inert, checks generated syntax and runtime preflight, and refuses an
existing result. The one `--run` creates the durable exclusive identity before
credentials, runs local Ettin composition before `.env`, meters every Gemini,
Luna, and judge dispatch without retries, and seals any created result—even a
failure—with an artifact manifest. It reserves the durable identity before
re-verification and child preflight; the child consumes the marker before its
own preflight. Credential intent is durable before `.env` loading and loaded
state durable afterward. If reading may have occurred, sealing scans the
result, launcher, runtime, and every frozen tracked file for exact key values;
otherwise it truthfully records no read intent. Scan/hash/parse failures become
sanitized manifest errors rather than preventing terminal evidence.
Any non-clean seal is durably recorded and forces the launcher to exit
nonzero, even when the child itself completed successfully.

The first independent review at `4c1ae1f` correctly reopened the ticket for
the incomplete tracked closure, false no-report/no-credential inference,
preflight/spawn rerun window, and missing failure manifest. No inference or
provider activity preceded these repairs. Fresh rereview is required.

## Predictions

P-set 25 grades: compatibility FAIL; completion FAIL; accuracy,
retrieval/rerank, and provider wire not assessable; execution/accounting PASS.
The specific question predictions are not assessable because question 1 was
never reached.

## Verification

- Private launcher syntax and inert `--verify`: PASS.
- Result identity: terminal; repeat invocation refused by durable path.
- Predecessor manifests: 9/9 complete bundles rehashed.
- Current product/eval files: 10/10 rehashed.
- Ettin cache artifacts: 7/7 size/hash/mode checks.
- Full isolated runtime closure: exact.
- Focused Ettin contracts: 9 pass / 0 fail.
- Full suite: 694 pass / 0 fail / 15 skipped across 709 tests.
- Quickstart: 6/6.
- Ticket/report/scope/diff checks: pass.
- Independent pre-dispatch review: initial reopen at `4c1ae1f`; fresh clean GO
  at `cfc3849` with no P0-P3 finding.
- Terminal bundle: 5/5 artifacts rehashed; manifest and mode audit pass.
- Fresh terminal review: pending.

## Files Changed

- `evals/predictions.md`: FINAL P-set 25.
- `docs/DECISIONS.md`: exact founder-authorized freeze ritual.
- `STATUS.md`: current pre-dispatch state and next gate.
- BRN-0010 governed ticket and reports.

Private launcher, runtime, model/cache, dataset, and future results remain out
of git.

## Product Stop Rule

1. The basic memory journey remains runnable; quickstart must be green before
   dispatch.
2. This unit did not improve the journey; it exposed that the accepted local
   scorer was not compatible with the stricter cached-only application mode.
3. Existing frameworks provide rerankers, but not Palari's canonical bounded
   integration or this controlled provider result.
4. The founder explicitly requested this validation.
5. Deleting the unit would erase the exact boundary failure and invite an
   unsafe rerun or false claim that Ettin was live-compatible.

This is a measurement unit directly following a product unit and does not
trigger the two-infrastructure-unit drift stop.

## Risks / Follow-Ups

- The ten cases are known; a favorable result cannot establish unseen-user
  generalization.
- Local reranking cannot restore a candidate absent from the bounded fused
  pool, and semantic salience cannot replace trusted host chronology.
- Gemini embedding usage remains unreported and therefore conservatively
  uncertain; the hard cap may stop a suffix before all labels.
- A terminal failure, cap stop, or disappointing score is evidence, not
  authority for another identity or product repair.
- The consumed identity cannot distinguish a missing cache-resolution option
  from another tokenizer-loading defect; any causal test is a new ticket.
