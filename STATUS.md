# STATUS — Palari alpha

## Current state

BRN-0035 implemented the lightweight alpha reset at `9220d80` and is ready for
independent review. The product kernel and historical evidence are unchanged.
The full pre-reset repository is preserved at annotated tag
`pre-alpha-governance-reset-2026-08-07` (target `332b133`).

Historical LongMemEval result: `6/10`, unchanged. Sealed U8 question
`1568498a` remains forbidden. Accounted historical provider spend remains
`$8.00840072`. No provider, credential, dataset, or live-evaluation action is
part of BRN-0035.

## Active commands

```bash
npm test                 # focused alpha runner contracts
npm run alpha:check      # same explicit focused gate
npm run quickstart       # six-step product memory journey
npm run test:legacy      # complete historical suite, on demand
npm run alpha:debug -- --adapter <module> --questions 11-20 --max-dollar 0.50
```

Alpha debug logs and local adapters belong in `.palari-alpha/`. They are
mutable, gitignored diagnostics, not benchmark grades.

## Next

Complete independent review of BRN-0035. After acceptance, use
the reusable debug runner to repair the first broken end-to-end memory path
under one explicit aggregate budget. Do not freeze another benchmark identity
until the full path works.

## Product check

1. Basic journey runnable: yes, quickstart passed 6/6.
2. Measurable improvement: default feedback targets the active alpha loop.
3. Existing framework: the survey found useful patterns, but adding a full
   framework would add more surface than Palari needs.
4. Founder request: yes, simplify the overbuilt prototype workflow.
5. If removed: routine debugging returns to the 825-test, per-run governance
   path that repeatedly failed before reaching memory behavior.
