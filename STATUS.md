# STATUS — Palari alpha

## Current state

BRN-0035 is independently accepted and merged at `23da4f1`. The default gate
is now the small alpha runner contract; the complete historical suite remains
available on demand. File-backed logs stay inside `.palari-alpha/`, and
conservative accounted spend persists across CLI reruns in
`.palari-alpha/budget.json`. The product kernel and historical evidence are
unchanged. The full pre-reset repository is preserved at annotated tag
`pre-alpha-governance-reset-2026-08-07` (target `332b133`).

The first live alpha diagnostic completed question `18bc8abd` end to end on
2026-08-07: 44 sessions / 436 canonical turns -> Gemini semantic indexing ->
local Ettin reranking -> two Luna dispatches -> one evidence-committed answer.
Palari answered “Kansas City Masterpiece,” matching the reference, after one
retrieval call. The first diagnostic attempt exposed a gitignored-adapter bug:
messages longer than Gemini's 8,000-character embedding limit were not chunked.
Adding the already-proven chunk-and-normalized-mean compatibility wrapper made
the corrected attempt complete. This is an alpha diagnostic, not a benchmark
grade. The wrapper now lives at the dedicated provider-neutral
`palari-brain/embedder` package subpath; it keeps canonical text whole while
chunking only derived embedding requests. Focused tests pass 17/17, quickstart
passes 6/6, and the complete legacy tier passes 839 with 3 optional skips.

Question `19b5f2b3` then completed through that reusable boundary: 43 sessions
/ 482 canonical turns, one host-validated temporal retrieval plan, one
retrieval call, and three Luna dispatches. Palari answered “two weeks,” matching
the reference, and committed the exact user quote “I spent two weeks traveling
solo around the country.” This remains an ungraded alpha diagnostic.

Question `1a1907b4` reached four Luna dispatches and relevant cocktail evidence,
but failed because Luna returned an invalid evidence commitment after its one
internal repair. This is an answer-boundary finding, not a retrieval miss. The
gitignored adapter now preserves safe per-dispatch commitment output and
preloads questions `1a1907b4` through `36b9f61e` for a bounded rolling debug
batch; no product change or benchmark regrade follows from the failure.

Historical LongMemEval result: `6/10`, unchanged. Sealed U8 question
`1568498a` remains forbidden. Pre-alpha accounted provider spend was
`$8.00840072`; the alpha ledger now accounts `$0.49641132`, for cumulative
accounted spend of `$8.50481204`. Known alpha provider usage was approximately
`$0.27579692`; the higher ledger value conservatively retains failed
answer-stage reservations.

## Active commands

```bash
npm test                 # focused alpha runner contracts
npm run alpha:check      # same explicit focused gate
npm run quickstart       # six-step product memory journey
npm run test:legacy      # complete historical suite, on demand
npm run alpha:debug -- --adapter <module> --questions 11-20 --max-dollar 0.50
```

Alpha debug logs, local adapters, and aggregate budget state belong in
`.palari-alpha/`. They are mutable and gitignored; logs are diagnostics, not
benchmark grades. Run only one alpha CLI process at a time.

## Next

Capture the rejected `1a1907b4` commitment, make the smallest general fix, then
continue through questions `2133c1b5` to `36b9f61e` under one explicitly
approved rolling cap. Do not add benchmark or governance machinery while this
loop is still finding product-path bugs.

## Product check

1. Basic journey runnable: yes, quickstart passed 6/6.
2. Measurable improvement: one real 436-turn path now answers correctly with a
   cited canonical user quote.
3. Existing framework: the survey found useful patterns, but adding a full
   framework would add more surface than Palari needs.
4. Founder request: yes, simplify the overbuilt prototype workflow.
5. If removed: routine debugging returns to the 825-test, per-run governance
   path that repeatedly failed before reaching memory behavior.
