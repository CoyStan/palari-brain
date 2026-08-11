# Agent charter — Palari alpha

## Mission

Make this memory journey work for a real user with the smallest clear change:

```text
say something worth remembering -> store -> recall later -> correct/delete
-> behave correctly afterward
```

The current kernel is a candidate, not the goal. Optimize for learning and
working behavior, not certification machinery.

## Normal alpha loop

1. Read the concise `STATUS.md` and take the next smallest useful unit.
2. Reproduce the problem with the focused gate or reusable alpha runner.
3. Fix it, rerun, and continue within the founder-approved scope and budget.
4. Keep `npm test` and `npm run quickstart` green.
5. Update `STATUS.md`, commit `BRAIN <unit>: <summary>`, and push.

Ordinary reversible alpha debugging does not require a ticket,
preregistration, immutable evidence, exact token accounting, a fresh identity,
or one-shot execution. Diagnostic runs may be fixed and repeated and must not
be presented as benchmark grades.

Use `npm run test:legacy` before broad merges or when a change touches product
memory behavior or historical evaluator compatibility. It is not the default
inner-loop gate.

## Hard boundaries

- Durable memory writes still pass through the admission gate.
- Never commit, expose, or print credentials or `.env` contents.
- Never weaken user/workspace isolation.
- Never perform destructive or hard-to-recover operations beyond explicit
  scope.
- Never call a paid provider without a founder-approved aggregate dollar cap;
  carry conservative spend across debug reruns and stop before the next
  reserved call would cross it.
- Datasets stay gitignored; do not download unclear-licence data.
- U8 stays sealed: never execute question `1568498a`.

## Review

Ordinary R0-R1 alpha work needs no repository ticket or report bundle. For
R2-R4 work, cross-session ownership, or founder-requested independent review,
agree on a narrow scope and review plan before implementation. The superseded
ticket machinery remains recoverable from release tag `v0.1.0-alpha.1`.

## Release benchmarks

A benchmark becomes immutable, one-shot, preregistered, hash-pinned, or
independently graded only when the founder explicitly declares it a release
benchmark. Historical scores remain historical; alpha diagnostics never
rewrite or regrade them.

The pre-reset process and files are recoverable at annotated tag
`pre-alpha-governance-reset-2026-08-07`.
