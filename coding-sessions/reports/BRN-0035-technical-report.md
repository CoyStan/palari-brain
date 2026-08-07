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
declares `maxCostUsd`; the runner refuses a call whose reservation crosses the
cap and conservatively charges the reservation when a call throws or reports
invalid settlement. This keeps retries within the cap without recreating the
historical accounting ledger.

The CLI imports only an explicitly supplied adapter module. The runner itself
has no provider, credential, dataset, product-kernel, ticket-ID, or frozen-run
dependency. Logs identify themselves as `diagnostic-not-a-benchmark` and do
not contain a grade field.

## Default Gate Reduction

| Gate | Tests | Wall time | Peak RSS |
|---|---:|---:|---:|
| Before, `npm test` | 825 | 19.04 s | 115,084 KB |
| After, `npm test` | 10 | 0.40 s | 63,976 KB |

The active gate is 47.6 times faster and contains 98.8% fewer tests. The
historical suite was retained rather than deleted.

## Verification

- `npm run alpha:check`: PASS, 10/10.
- `npm test`: PASS, 10/10, measured 0.40 seconds.
- `npm run test:legacy`: PASS, 820 passed / 15 optional skipped / 0 failed
  across 835; all 825 prior tests remain.
- `npm run quickstart`: PASS, 6/6.
- 20 official GitHub repository `HEAD` checks: PASS, 20/20.
- annotated tag `pre-alpha-governance-reset-2026-08-07`: PASS; target
  `332b133db40e6e790734e25dbef3e8e6436c9377`.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0035`:
  PASS before closeout.
- `git diff --check`: PASS before closeout.

Implementation commit:
`9220d80622d6fba473fd920c1ea656afa31e68b8`.

## Safety Record

Zero live/provider calls, credential reads, dataset reads/downloads, spend,
result writes, scores, or historical mutations occurred. No dependency was
added. User isolation, the admission gate, paid-provider founder cap, and
sealed U8 remain hard boundaries.

## Risks / Follow-Ups

Adapters remain responsible for declaring a conservative per-component
reservation. Alpha observations are intentionally mutable and unsuitable as
published benchmark evidence. The next useful work is a bounded diagnostic
run through the first broken end-to-end path after a separate founder-approved
aggregate dollar cap; no such live action is authorized by this ticket.
