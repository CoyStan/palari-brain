# BRN-0013 Technical Report

## State

Terminal completed identity. After independent GO at
`163e7e532cf631239f66155dd179b186959d8032`, the launcher ran exactly once.
Both smokes and all ten answer/judge cells completed. Official result is 6/10;
there was no retry, rerun, regrade, selective score, or result repair.

## Terminal Result

- Official labels: `PASS, FAIL, PASS, PASS, PASS, PASS, FAIL, FAIL, FAIL,
  PASS` for 6/10.
- Required-session coverage: 12/13. All four failed answers consulted every
  required answer-bearing session; the sole missing session occurred on the
  passing sixth question. The remaining measured failure is downstream of
  candidate retrieval/reranking.
- Local real-brain smoke: pass, four finite scores, titanium memory first,
  provider calls zero. Live compatibility: pass, semantic use and reranking
  true, planted indigo answer correct.
- Ten non-empty question reranks scored 250 candidates, maximum 50, with exact
  score counts and zero mutation. Mean measured latency was 1,290.7065 ms/call
  (751.1525-2,244.8082 ms); cold local smoke was 593.9999 ms and the two-item
  warm compatibility rerank 23.2936 ms.
- Three answers used four calls and tool-disabled finalization. Every reached
  answer was judged exactly once; all 138 physical requests succeeded.

## Prediction Grade

Failing category first:

1. OFFICIAL ACCURACY: fail. `6/10` is below the expected `>=7/10` floor and
   10/10 objective. The first-six vector stayed
   `PASS, FAIL, PASS, PASS, PASS, PASS`; `09d032c9` remained FAIL. Ordinal 10
   supplied the predicted later PASS.
2. COMPATIBILITY: pass. Repaired cached loading and live three-surface wiring
   both completed exactly.
3. COMPLETION: pass. Ten answers and ten validated labels completed under cap.
4. RETRIEVAL/RERANK: pass at 12/13 required sessions, exact bounded finite
   score counts, and no candidate mutation.
5. WIRE: pass. Normal/final tool choices, complete continuation, call ceiling,
   and one judge per answer all held.
6. EXECUTION/ACCOUNTING: pass. One terminal invocation, both caps respected,
   complete evidence seal, and zero credential matches.

## Accounting And Evidence

- Calls: 33 Luna Responses, 10 OpenAI judges, 95 Gemini embedding batches;
  138 total, all successful.
- Luna: 129,023 input, 60,036 cached-input, 2,199 output, 472 reasoning tokens;
  `$0.01763692` measured.
- Judge: 2,120 input / 17 output tokens; `$0.00547` measured.
- Gemini: 4,794 embedding requests / 4,905,903 conservatively reserved tokens;
  `$0.73588545` uncertain because usage remains unreported.
- Fresh: `$0.02310692` measured + `$0.73588545` uncertain = `$0.75899237`.
  Cumulative: `$1.72334288` measured + `$4.30738335` uncertain =
  `$6.03072623` accounted.
- Manifest
  `eb7dcb01c7a60cbade9a25d179cffde783e1f46c5c79644422eae819da7c3b71`
  rehashes 73 artifacts / 89,106,477 bytes; modes match, no symlink/sealing
  error, and exact-value credential scan is 0/2.

## Frozen Experiment

- Fresh identity: `j4-luna-ettin-first10-v2`.
- Product cut point: accepted BRN-0012 `90e1837`; clean administrative main
  `784de723daf5be9824b5ef2f18b274eff94e1313` adds only the ticket contract.
- Exact first-ten order/dataset hashes:
  `d3a9a8c234468e0120d605c7868b418a5ab3313384d0d162e11a30ab6d9fe4cf` /
  `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.
  Sealed U8 is absent.
- Answer: `gpt-5.6-luna`, Standard, low reasoning, no-store. Embeddings:
  `gemini-embedding-001`. Judge: `gpt-4o-2024-08-06`.
- Ettin: exact 17M revision, fp32, accepted native head and bounds. The sole
  change from terminal BRN-0010 is BRN-0012's validated absolute local model
  directory.
- Opening ledger: `$5.27173386` accounted = `$1.70023596` measured +
  `$3.5714979` uncertain. Boundaries: `$1.50` fresh / `$6.77173386`
  cumulative.

## Private Launcher

Mode-0600 launcher
`/home/quetza/palari-brain-private/luna-ettin-first10-live-v2-launcher.mjs`
hashes to
`d9242b407b7477168a9c746bf5350659222f7e6ad3a329ad2ed79e186de57a63`.
It generates mode-0600 runtime
`df2b746bbc422e88bbf773eeab68292ea1ad85d026988e4ab7ff765a4349a50a`
from terminal template
`4bc21c6c3d14d977f0aa659608d0998bd029d3f754c4398c1e4f49705aa266d0`.

Offline verification binds ten predecessor manifests / 218 artifacts,
including terminal BRN-0010; ten product/eval files; seven model/head files;
the complete 3,208-file, 706,843,605-byte runtime closure; dataset/order;
clean canonical commit; caps; and fresh-result absence. The launcher reserves
and consumes the identity one way, executes the real local smoke before a
durable credential-read marker, meters every transport without retry, and
seals failures as well as successes.

## Predictions

FINAL P-set 26 predicts both smokes pass, all ten complete, at least 7/10 meet
the official judge (10/10 remains the product objective), at least 11/13
required sessions are consulted, all scored semantic searches report Ettin
reranking without content mutation, tool/finalization wire remains exact, and
accounting/evidence sealing stays within both caps. Any miss is recorded and
does not authorize a retry.

## Verification

- Launcher offline verify: pass; no credentials or inference.
- Focused reranker/native contracts: 10 pass, 0 fail.
- Full suite: 695 pass, 0 fail, 15 skip across 710.
- Quickstart: 6/6.
- Provider calls / credential reads / model inference / spend: 0 / 0 / 0 /
  `$0.00` before dispatch.
- Independent pre-dispatch review: GO, no P0-P3 finding.
- Terminal one-shot execution: pass mechanically; 6/10 official accuracy.
- Private terminal seal: 73/73 artifacts, no error or credential match.

## Product Stop Rule

1. A new user can run the basic journey: yes, quickstart is 6/6.
2. This measurement changes no product byte; it proved the accepted loader
   repair makes the chosen local reranker usable end to end, while answer
   evidence use remains unreliable.
3. Existing providers/frameworks do not supply this cross-provider,
   local-reranker, host-gated, one-shot evidence contract.
4. Quetzali explicitly requested correct Ettin integration and a fresh rerun.
5. Without this record, Palari could claim Ettin/Luna integration from offline
   contracts or blame answer failures on retrieval despite 12/13 coverage.

This is one measurement unit after a product repair. It is not a public or
unseen-data benchmark.

## Risks / Follow-Ups

- The known ten cannot establish generalization and must not drive
  answer-specific tuning.
- All four failures are evidence-use/composition failures after complete target
  coverage, not an Ettin loader or retrieval bug. A provider-neutral structural
  answer repair may be developed offline against general adversarial cases,
  but known benchmark answers must not become runtime logic.
- A second score needs fresh founder authority after that separate unit; this
  identity is permanently consumed.
