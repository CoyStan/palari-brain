# Palari alpha architecture

## Objective

Make the smallest end-to-end memory loop work before certifying it. In alpha,
debug runs are repeatable diagnostics. A release benchmark is a separate,
explicitly declared event.

## Active loop

```text
injected questions
  -> writer
  -> optional embedder
  -> optional reranker
  -> answer
  -> mutable .palari-alpha/*.jsonl diagnostics
```

`evals/run-alpha-memory-debug.mjs` owns this orchestration. It does not import a
provider, read credentials, load a dataset, or know a ticket/run identity.
An adapter module exports `createAlphaRun()` and injects questions plus
`writer`, `answer`, and optional `embedder`/`reranker` components.

Each component is either a zero-cost function or:

```js
{
  maxCostUsd: 0.02,
  invoke: async (context) => ({ output, costUsd: 0.013 })
}
```

For CLI runs, the runner persists `maxCostUsd` to
`.palari-alpha/budget.json` before invoking a component. It refuses the call if
that reservation would take aggregate debug spend across invocations above
`--max-dollar`. After a successful bounded settlement it refunds only the
unused reservation; failure or process interruption retains the full amount.
Starting with a cap below the already-accounted amount is rejected. This is
deliberately simple conservative accounting, not a token ledger.

`maxCostUsd` is a pre-dispatch upper bound, not a target or an estimate to fix
afterward. A paid stage that may lazily embed an unindexed corpus must bound
the complete first-use backfill plus every answer and judge call before it is
invoked. If that worst-case reservation does not fit the approved aggregate
cap, the adapter must fail provider-free before any network call. The runner
rejects a result reported above its reservation, but that post-call check
cannot recover money already spent and is therefore not a substitute for a
conservative adapter preflight.

The budget file assumes one alpha runner process at a time. Concurrent CLI
runs are unsupported; wait for one to finish before starting another. Reset or
edit the mutable budget only when deliberately beginning a new founder-approved
debug budget, and retain the old file when continuing the same authorization.

## Command

```bash
npm run alpha:debug -- \
  --adapter .palari-alpha/my-adapter.mjs \
  --questions 11-20 \
  --retries 2 \
  --max-dollar 0.50
```

The adapter, budget state, and logs live under `.palari-alpha/` and are
gitignored. Every file-backed log path is rejected unless it resolves inside
the current working directory's `.palari-alpha/` namespace. Retries are
explicit and capped at three. The default is no retry and
continue-on-error so one broken row does not hide later diagnoses. Add
`--stop-on-error` when a shared failure makes later rows meaningless.

## Two modes, two standards

### Alpha debug

- repeat and repair freely inside the approved dollar cap;
- append or replace local JSONL logs;
- report attempts and failures, never a benchmark grade;
- use focused tests during iteration;
- agree on an explicit scope and review plan for risky or broad changes.

### Release benchmark

Only an explicitly declared release benchmark may require immutable inputs,
preregistered predictions, exact reproducibility hashes, one-shot execution,
or independent grading. Those rules do not leak into ordinary debugging.

## Gates retained in alpha

- never commit or print secrets;
- never weaken cross-user/workspace isolation;
- never make destructive or hard-to-recover changes without explicit scope;
- never call a paid provider without a clear founder-approved maximum dollar
  amount;
- never run sealed U8 question `1568498a`.

## Tests

- `npm test` and `npm run alpha:check`: the small runner contract tier;
- `npm run quickstart`: the real basic memory journey;
- `npm run test:legacy`: the broader product compatibility suite, used before
  broad merges or when touching compatibility behavior.

The pre-reset state is recoverable at annotated tag
`pre-alpha-governance-reset-2026-08-07`. The complete first-alpha evaluator
and workflow tree is recoverable at annotated tag `v0.1.0-alpha.1`.
