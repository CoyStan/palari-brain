# BRN-0043 Technical Report

## Files Changed

- `src/reranker-transformers.mjs`: shared exact-token quadratic scheduler,
  stable microbatching/order restoration, deterministic tensor cleanup,
  transactional component loading, single-flight lifecycle, explicit generic
  512-token ceiling, safe metrics, and explicit close.
- `src/reranker-ettin.mjs`: adopt the shared scheduler while preserving the
  frozen fp32 model/head, all candidates, and the existing 7,999-token context.
- `src/retrieval-answer.mjs`: preserve broad cheap candidate gathering but
  bind every configured reranker dispatch to the public 50-candidate ceiling.
- `evals/run-ettin-native-bakeoff.mjs`: add an external-path, provider-free
  mixed-length native profile mode with repeat-order, latency, schedule, and
  process RSS evidence; close failure produces a typed failed result.
- `tests/reranker-transformers.contract.test.mjs`: schedule, order,
  serialization, lifecycle, transactional-load rollback, metrics isolation,
  and success/failure disposal.
- `tests/reranker-ettin.contract.test.mjs`: exact 7,999-token binding, frozen
  identity, pair batching, ordering, and disposal.
- `tests/ettin-native-bakeoff.contract.test.mjs`: inert profile CLI contract
  and fail-closed profile shutdown regression.
- `tests/answer-confirmation.contract.test.mjs`: 80-row regression proving a
  broad filtered pool sends exactly 50 stable candidates to the reranker and
  still presents a complete bounded confirmation page.
- `docs/BRAIN-API.md`: public scheduling, lifecycle, limits, and metrics.
- `STATUS.md`: current diagnosis, proof boundary, and unexecuted native gate.
- Governed BRN-0043 ticket and Level 1 human report.

## Verification

- `node --test tests/reranker-transformers.contract.test.mjs tests/reranker-ettin.contract.test.mjs tests/ettin-native-bakeoff.contract.test.mjs tests/retrieval-answer.contract.test.mjs tests/answer-confirmation.contract.test.mjs`: PASS, 77/77.
- `npm test`: PASS, 90/90.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 935 pass, 15 optional skip, 0 fail across 950.
- `npm run ettin-bakeoff`: PASS, inert identity verification; same model,
  artifacts, 16-case bank, and audited runtime closure pins.
- `git diff --check`: PASS.
- Native frozen-bank `--run` and `--profile`: NOT RUN. Both require explicit
  audited runtime/cache paths outside the worktree. The ticket forbids private
  alpha artifacts and makes no historical-rank or native-RSS claim without
  those executions.
- Paid/live tests: NOT RUN and forbidden by ticket scope.

## Risks / Follow-Ups

- Microbatch shapes can cause tiny fp32 kernel drift. The implementation keeps
  every current input, but historical rank parity still requires the frozen
  bank `--run` with the audited external runtime/cache. The separate `--profile`
  measures repeat stability and RSS; neither native execution ran in this ticket.
- A single 7,999-token pair may exceed the quadratic target and is therefore
  reported and run alone. This removes the 50-way multiplier but is not an OS
  memory boundary. A supervised child/sibling process with a real cgroup or
  container limit remains separate operations work.
- This ticket intentionally does not implement 512-token Ettin windows, MaxP,
  uint8, fused ONNX output, or smaller candidate pools. Each can change scores
  or recall and needs a separate provider-free Pareto ticket.
