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

The host-enforced successor is now prepared without another provider call.
`answerWithRetrieval()` accepts an optional trusted retrieval time range; when
present, its host-owned bounds override provider-authored bounds for exact,
hybrid, and timeline navigation, while omitted configuration preserves every
historical caller. The active gitignored adapter supplies an explicitly
unbounded trusted range. An offline replay against Q14's persisted canonical
store proved that the exact original user statement (“living in Harajuku for
3 months”) is now returned even when the provider requests the bad `08:39`
cutoff; the returned result exposes the effective host range. Contracts pass
35/35, focused tests pass 17/17, quickstart passes 6/6, and the complete legacy
tier passes 842 with 3 optional skips. No live result is claimed yet.

The founder-authorized live Q14 confirmation then completed successfully in
one invocation for `$0.07551414`. Luna still requested the incorrect
question-time `before` bound, but the host replaced it with the trusted
unbounded range. Hybrid retrieval returned the canonical original user
statement at rank 3, Luna selected its exact evidence ID and quote (“I've been
living in Harajuku for 3 months now”), and answered “about three months,”
matching the reference. The complete safe trace remains self-contained at
`.palari-alpha/current-palari-e2e-2133c1b5.json`. This is an alpha diagnostic
success, not a benchmark regrade; historical LongMemEval remains 6/10.

The provider-free anti-overfitting matrix is now part of the focused gate. It
places older and newer facts from six unrelated domains into one noisy
workspace: residence, medication, employment, subscriptions, travel, and
purchases. Current queries must defeat a provider's false old cutoff in the
first three; explicit historical queries must enforce the host cutoff and
exclude later updates in the other three. All six pass through the real
canonical ingest and retrieval path. Focused tests now pass 24/24 and
quickstart remains 6/6.

A five-question live held-out set was selected from dataset metadata before
reading any question or reference answer: temporal `gpt4_59149c77`, preference
`8a2466db`, multi-session aggregation `0a995998`, knowledge update `6a1eabeb`,
and multi-session abstention `88432d0a_abs`. None was used to design or debug
the Q14/Q19 changes, and U8 is absent. The authorized one-invocation run
completed two answer-quality successes, one answer-quality failure, one
infrastructure failure, and one safe budget stop. Preference correctly used
the original Adobe Premiere Pro preference; knowledge update correctly
returned `25:50`. Aggregation returned only the boots instead of all three
clothing errands, although offline inspection confirmed the missing blazer
and return/exchange evidence was already canonical. The temporal case failed
before retrieval because Luna emitted the valid general relation `between`,
which the host rejected. The final abstention case was not dispatched because
the next reservation would have crossed the approved cap. This is mixed
held-out diagnostic evidence: preference and knowledge-update behavior
transferred, but exhaustive aggregation has not yet generalized.

The temporal compatibility defect is fixed offline. Plan normalization now
accepts `between` as an internal general relation while the published provider
schema remains byte-for-byte unchanged for historical callers. Its focused
contract passes, focused tests pass 25/25, quickstart passes 6/6, and the
complete legacy tier passes 850 with 3 optional skips. No clothing-specific or
benchmark-specific retrieval rule was added, and no second held-out invocation
was made.

The aggregation successor is now implemented and proven offline without a
provider call. Product callers can opt into planned-search expansion: one
ordinary semantic query is complemented by local ranked queries derived from
the original question plus the registered plan's anchor and category. The host
deduplicates the candidate pool, runs Ettin once, then fuses semantic/ranked
coverage, reranker order, and original-user provenance so verbose prior Palari
responses cannot crowd every direct user statement out of the returned window.
No answer keyword, benchmark ID, clothing rule, extra embedding request, or
extra generation dispatch is involved. Provider-free controls demonstrate the
same behavior for instrument, document, and equipment collection/return tasks,
including a deliberately weak reranker. On the exact persisted failed held-out
store, the same search now returns both original boots statements at ranks 1
and 2 and the missing original navy-blazer statement at rank 4; previously the
blazer was outside the returned window. This satisfies the retrieval-side
acceptance offline but is not a new answer result. Targeted retrieval contracts
pass 40/40, focused tests pass 25/25, quickstart passes 6/6, and the complete
legacy tier passes 855 with 3 optional skips.

The one authorized live aggregation confirmation on `0a995998` completed on
2026-08-07 without an infrastructure or budget failure, but its answer still
did not match the reference `3`. Retrieval itself met the acceptance: the first
search returned the original replacement-boots pickup at rank 1, the original
old-boots return wording at rank 2, and the original navy-blazer pickup at rank
4. A second search again returned all three at ranks 1–3. Luna selected the
replacement-boots and blazer evidence but interpreted “exchanged them for a
larger size” as proving that no separate return remained, then answered one
store pickup plus the blazer separately. This is now an answer-interpretation
finding, not a retrieval miss. No further retrieval tuning or provider call was
made, and the historical LongMemEval result remains 6/10.

The general answer-composition successor is now implemented and proven
offline. `answerWithRetrieval()` keeps its historical standard mode unchanged,
while product callers may select `auto` or `enumerate`. High-confidence count
and complete-list questions receive a strict structured commitment: every
directly evidenced candidate retains its label, action, evidence ID, exact
quote, included/excluded/ambiguous disposition, and reason. The host verifies
all evidence links and recomputes referenced, included, and ambiguous counts;
it does not force uncertain evidence into a definite answer or persist an
answer-time inference. The OpenAI adapter exposes this schema only for an
enumeration session, so the default and frozen historical request wires remain
byte-identical. Provider-free contracts cover documents, instruments,
medication, travel, scalar-duration exclusions, malformed counts, and the
default wire. On the exact persisted `0a995998` store, local Ettin returned all
three original user statements and the host accepted an honest composition of
two definite pickups plus one ambiguous old-boots return. This is not a new
Luna result and does not regrade the historical 6/10. Focused tests pass 25/25,
the answer/OpenAI contracts pass 73/73, quickstart passes 6/6, and the complete
legacy tier passes 860 with 3 optional skips. No provider was called and spend
did not change.

A founder-approved `$1.00` fresh answer-only campaign then reused three frozen
stores rather than paying to rewrite their histories. Ten Luna samples ran
under a `$3.38366359` cumulative alpha cap with no retries: five clothing
aggregation attempts, three luxury-spend aggregation attempts, and two honest
zero-event count attempts. Seven completed and three failed the commitment
boundary; all three failures were clothing attempts. Luxury spending completed
3/3, and the captured run enumerated the three direct purchases and answered
the `$2,500` reference. Zero-event counting completed 2/2, and the captured run
correctly excluded a fruit-tart discussion and abstained on egg-tart frequency.
The first captured clothing failure exposed a contract mismatch: Luna linked
an excluded candidate to selected `not_used_reason` evidence, while the host
required materially-used evidence. The general boundary now permits excluded
candidates to link any selected evidence; temporary inferences still require
materially-used evidence. The post-fix clothing run completed and enumerated
all three original user statements, but classified the old-boots return as
excluded because the same statement says the boots were exchanged. It answered
`2`, not the benchmark reference `3`. This isolates the remaining disagreement
to semantic interpretation of contradictory wording: retrieval and candidate
coverage succeeded. The campaign added `$0.55864396` of conservative accounted
spend, including `$0.45` retained for three failed answer reservations, bringing
alpha accounted spend to `$2.94230755`. Historical LongMemEval remains 6/10.

Historical LongMemEval result: `6/10`, unchanged. Sealed U8 question
`1568498a` remains forbidden. Pre-alpha accounted provider spend was
`$8.00840072`; the alpha ledger now accounts `$2.38366359`, for cumulative
accounted spend of `$10.95070827`. The alpha ledger now accounts `$2.94230755`;
it conservatively retains failed answer-stage reservations. The answer-only
campaign stayed below its approved `$3.38366359` alpha cap and left
`$0.44135604` of accounted headroom. No further live run is needed to diagnose
the clothing case.

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

Do not tune retrieval further for `0a995998`: all three original statements
were returned and enumerated. The next decision is product semantics, not more
provider sampling: whether an action phrased as both “need to return” and
“exchanged” should be reported as ambiguous, excluded as resolved, or counted
literally. Palari currently chooses excluded/resolved and therefore answers 2.
Preserve that evidence and do not force the benchmark's 3 without a general
policy for contradictory action state.

## Product check

1. Basic journey runnable: yes, quickstart passed 6/6.
2. Measurable improvement: live Q14 and Q19 improved, the same temporal
   authority passes current/historical counterexamples across six unrelated
   domains, two held-out answer cases transferred, and the held-out aggregation
   evidence failure is corrected live. The live answer still interpreted the
   complete evidence differently from the reference, so broad answer-quality
   generalization is not yet established.
3. Existing framework: the survey found useful patterns, but adding a full
   framework would add more surface than Palari needs.
4. Founder request: yes, simplify the overbuilt prototype workflow.
5. If removed: question 19 regresses to generic recommendations, and a model
   can again hide canonical memories by inventing retrieval time bounds.
