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
batch. An instrumented repeat isolated the cause: Luna's otherwise valid
two-evidence recommendation commitment was truncated at the legacy 512-token
ceiling. The OpenAI retrieval provider now supports an explicit bounded answer
ceiling override; active alpha uses 1,024 while historical request bytes keep
their 512 default. Relevant contracts pass 78/78 and the complete legacy tier
passes 840 with 3 optional skips. The committed retry then answered with a
Pimm's Cup variation supported by two exact memories.

The first rolling pass over questions 14–20 completed six of seven. Questions
16–18 matched their references. Four general findings remain: question 14
extrapolated seven months from an older statement instead of finding the later
direct “3 months” update; question 15 borrowed Harajuku's duration while
caveating that Shinjuku was unsupported; question 19 duplicated one evidence
ID in its commitment and failed repair; question 20 returned a definitive
`$1,700` total after missing an `$800` gown. The active composition now adds
provider-neutral completeness guidance for latest direct updates, exhaustive
totals, named-entity mismatches, and unique commitment evidence IDs. Its focused
contracts pass 74/74 and the complete legacy tier passes 841 with 3 optional
skips. These are alpha findings, not benchmark grades.

The targeted repeat of questions 14, 15, 19, and 20 completed without an
infrastructure failure. Question 20 improved to the complete `$2,500` total,
question 15 correctly distinguished unsupported Shinjuku from the retrieved
Harajuku duration, and question 19's duplicate commitment was eliminated.
Two answer-quality findings remain: question 14 still stopped at an older
one-month statement and extrapolated seven months instead of using the later
direct three-month update; question 19 retrieved only current-city context and
never retrieved the user's language/cultural preferences. Offline inspection
confirmed that both missing direct user statements were already available to
the retrieval surfaces. The active-only guidance now operationalizes the
general remedies: a second same-entity retrieval before temporal inference,
and both situational and preference facets before a personalized
recommendation. Each gitignored diagnostic now records its question, reference,
workspace, and full retrieval transcript so question 14 can be assessed from
one artifact instead of repeatedly reopening its store. Focused tests pass
17/17, quickstart passes 6/6, and the complete legacy tier passes 841 with 3
optional skips.

The next targeted run completed questions 14 and 19 for `$0.15141059` of
accounted spend. Question 19 now retrieved the original direct French/Spanish
language-exchange preference, materially used it, and answered with the right
personalization while declining to invent a current location. Question 14
still answered seven months, but its now-self-contained trace isolated a
different cause: Luna performed the required second search while applying the
question time (`08:39`) as a hard `before` bound, which excluded the dataset's
canonical three-month statement timestamped later that day (`20:50`). The
active planning guidance now treats question time as relative-time context,
not an automatic cutoff; explicit before/after/as-of/during wording can still
bound retrieval. This is a general temporal rule, not a question-specific
keyword. Relevant contracts pass 34/34; focused tests and quickstart remain
17/17 and 6/6 respectively.

The final authorized question-14 repeat completed for `$0.07540561` but still
answered about six months rather than the reference three months. Luna again
invented the same question-time `before` bound and stopped after one search,
despite the active instructions requiring open inferred bounds and a second
same-entity retrieval. This establishes that prompt guidance is not an
enforcement boundary. The self-contained diagnostic records the complete
question, reference, plan, search results, commitment, provider calls, and
workspace at `.palari-alpha/current-palari-e2e-2133c1b5.json`; no store reopen
is needed to diagnose this case again. Live work stopped after this invocation
as planned. Historical LongMemEval remains 6/10 and was not regraded.

Historical LongMemEval result: `6/10`, unchanged. Sealed U8 question
`1568498a` remains forbidden. Pre-alpha accounted provider spend was
`$8.00840072`; the alpha ledger now accounts `$1.85372398`, for cumulative
accounted spend of `$9.86212470`. Known alpha provider usage was approximately
`$1.48781641`; the higher ledger value conservatively retains failed
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

Replace advisory timestamp behavior with a host-enforced boundary: preserve
question time for host-computed relative-time metadata, but do not let a
provider turn that metadata into retrieval authority unless the user's
question explicitly supplies a temporal bound. Keep the change provider- and
benchmark-neutral, verify it offline, and prepare (do not execute) one Q14
confirmation. Only `$0.14627602` remains under the approved rolling cap, less
than the current `$0.15` answer reservation.

## Product check

1. Basic journey runnable: yes, quickstart passed 6/6.
2. Measurable improvement: question 19 now retrieves and uses the direct
   language preference, but the final advisory-only timestamp change did not
   improve question 14.
3. Existing framework: the survey found useful patterns, but adding a full
   framework would add more surface than Palari needs.
4. Founder request: yes, simplify the overbuilt prototype workflow.
5. If removed: question 19 regresses to generic recommendations and diagnostics
   again require manual store reopening; the timestamp instruction itself is
   not sufficient and must not be mistaken for enforcement.
