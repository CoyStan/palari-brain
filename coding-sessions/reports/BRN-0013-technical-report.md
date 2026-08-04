# BRN-0013 Technical Report

## State

Pre-dispatch freeze and fresh independent GO review are complete. The reviewer
found no P0-P3 issue at
`163e7e532cf631239f66155dd179b186959d8032`. No local model inference,
credential read, provider dispatch, question, result identity, or fresh spend
has occurred.

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
  `$0.00`.
- Independent pre-dispatch review: GO, no P0-P3 finding.

## Product Stop Rule

1. A new user can run the basic journey: yes, quickstart is 6/6.
2. This measurement changes no product byte; it will determine whether the
   accepted loader repair makes the chosen local reranker usable end to end.
3. Existing providers/frameworks do not supply this cross-provider,
   local-reranker, host-gated, one-shot evidence contract.
4. Quetzali explicitly requested correct Ettin integration and a fresh rerun.
5. Without this record, Palari could claim Ettin/Luna integration from offline
   contracts despite never completing a real local smoke or live answer.

This is one measurement unit after a product repair. It is not a public or
unseen-data benchmark.

## Risks / Follow-Ups

- The known ten cannot establish generalization and must not drive
  answer-specific tuning.
- A local/live failure or non-10 score is a finding. Only a general defect,
  repaired under a separate ticket, can justify requesting a fresh identity.
