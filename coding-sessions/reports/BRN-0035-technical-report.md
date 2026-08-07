# BRN-0035 Technical Report

## Files Changed

- `evals/run-alpha-memory-debug.mjs`: one provider-neutral diagnostic runner.
- `tests/alpha-memory-debug.contract.test.mjs`: focused provider-free contracts.
- `package.json`, `.gitignore`: small default gate, legacy escape hatch, and
  private mutable `.palari-alpha/` state.
- `AGENTS.md`, `STATUS.md`, `README.md`, `docs/ALPHA-ARCHITECTURE.md`: concise
  alpha workflow and explicit debug/release distinction.
- `docs/ALPHA-FRAMEWORK-RESEARCH.md`: exactly 20 official repository sources
  with concrete adopt/avoid decisions.

No product-memory source or historical evaluation artifact changed.

## Implementation

`runAlphaMemoryDebug` accepts injected questions and writer/answer plus
optional embedder/reranker components. It owns ordered selection, range/ID
selection, zero-to-three explicit retries, continue/stop-on-error behavior,
diagnostic JSONL, and a simple hard dollar ceiling. A priced dependency
declares `maxCostUsd`. CLI runs persist that reservation to fixed
`.palari-alpha/budget.json` before dispatch, refund only unused reservation
after a successful bounded settlement, and retain the full reservation after
failure or interruption. Later invocations load the aggregate amount and
reject a cap below it. The intentionally small state assumes one CLI process
at a time; it is not an exact token ledger.

The CLI imports only an explicitly supplied adapter module. The runner itself
has no provider, credential, dataset, product-kernel, ticket-ID, or frozen-run
dependency. Logs identify themselves as `diagnostic-not-a-benchmark` and do
not contain a grade field. Adapter-supplied and CLI-supplied file log paths are
both rejected unless they resolve inside cwd `.palari-alpha/`.

The first review correction, head
`11189309cdbbc525b6762829c3cc714451995679`, removed raw embedder/reranker
invoke handles from stage contexts. The second, corrected review head
`a4b91ecb3ef5c92d06c1045a9061a665b317b48c`, adds path confinement and
cross-invocation conservative budget state.

## Default Gate Reduction

| Gate | Tests | Wall time | Peak RSS |
|---|---:|---:|---:|
| Before, `npm test` | 825 | 19.04 s | 115,084 KB |
| After corrections, `npm test` | 13 | 1.04 s | 64,236 KB |

The active gate is 18.3 times faster and contains 98.4% fewer tests. The
historical suite was retained rather than deleted.

## Verification

- `npm run alpha:check`: PASS, 13/13.
- `npm test`: PASS, 13/13, measured 1.04 seconds.
- `npm run test:legacy`: PASS, 823 passed / 15 optional skipped / 0 failed
  across 838; all 825 prior tests remain.
- `npm run quickstart`: PASS, 6/6.
- 20 official GitHub repository `HEAD` checks: PASS, 20/20.
- annotated tag `pre-alpha-governance-reset-2026-08-07`: PASS; target
  `332b133db40e6e790734e25dbef3e8e6436c9377`.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0035`:
  PASS before closeout.
- `git diff --check`: PASS before closeout.

Corrected review implementation commit:
`a4b91ecb3ef5c92d06c1045a9061a665b317b48c`.

## Safety Record

Zero live/provider calls, credential reads, dataset reads/downloads, spend,
result writes, scores, or historical mutations occurred. No dependency was
added. User isolation, the admission gate, paid-provider founder cap, and
sealed U8 remain hard boundaries.

## Risks / Follow-Ups

Adapters remain responsible for declaring a conservative per-component
reservation, and concurrent CLI runs are unsupported. Alpha observations are intentionally mutable and unsuitable as
published benchmark evidence. The next useful work is a bounded diagnostic
run through the first broken end-to-end path after a separate founder-approved
aggregate dollar cap; no such live action is authorized by this ticket.
