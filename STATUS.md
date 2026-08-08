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
`$8.00840072`; the alpha ledger now accounts `$2.94230755`, for cumulative
accounted spend of `$10.95070827`. It conservatively retains failed
answer-stage reservations. The answer-only
campaign stayed below its approved `$3.38366359` alpha cap and left
`$0.44135604` of accounted headroom. No further live run is needed to diagnose
the clothing case.

The provider-free memory-stage audit is now available without adding a second
runtime or changing product memory behavior. Given explicit local observations,
`npm run memory-stage-audit -- --input <local.json>` classifies the earliest
observed stage as write, retrieval, composition, utilization, ambiguity,
success, or honestly ungraded. It reuses the existing exact-span, selection,
and judged-material-use telemetry, refuses to infer an audit without explicit
input, and performs zero provider or network calls. The RRC discussion paper
now labels importance sampling as a motivating toy readout rather than evidence
that prompt-based RRC approximates a full transformer; learned discrete routing
remains an empirical hypothesis. At that point focused tests passed 30/30,
quickstart passed 6/6, the provider-free answer-interpretation regression
passed 7/7, and its directly relevant contracts passed 5/5. A private local
audit of the current clothing case confirms zero missing canonical, returned,
or selected required evidence IDs and reports `ungraded`: outcome ambiguity
has not yet been judged.
It does not convert the benchmark reference into product semantics.

The audit now also distinguishes required session presence at the canonical
write boundary from session recall. An eight-case provider-free diagnostic
used five terminal v6 misses plus three current canonical cases. All five v6
misses classified at the earlier write/admission stage: four had none of their
answer-bearing sessions in stored memory, and one stored only one of two.
None classified as retrieval. The current Harajuku and language-preference
cases classified success; the clothing action-state case classified ambiguity
because its direct wording says both “need to return” and “exchanged.” Counts
are write 5, retrieval 0, ambiguity 1, success 2, with zero ungraded, provider,
or network calls. The local input and report stay gitignored.

This evidence rejects a Python learned-reranker successor for now: reranking
cannot recover evidence that never crossed the write boundary, and the current
canonical cases do not show a repeated retrieval miss. Enumeration policy now
reserves exclusion for direct evidence of out-of-scope or resolved state and
requires contradictory outstanding/resolution language to remain ambiguous.
The host still verifies structure and exact counts rather than claiming it can
semantically grade arbitrary prose; provider-free contracts prove the policy
is carried on both provider-neutral and OpenAI enumeration paths, not that a
live model will always follow it.

After the session-level audit and ambiguity-policy changes, focused tests pass
32/32, quickstart passes 6/6, the provider-free answer-interpretation
regression passes 7/7, the directly relevant audit/retrieval/OpenAI contracts
pass 76/76, and the complete legacy tier passes 867 with 3 optional skips.

The requested latest-design replay is now complete without touching the
sealed v6 result. The first existing diagnostic passed 6/6 reached cases, but
review found its criterion too coarse: any returned row from an answer-bearing
session counted as a hit. Version 2 instead uses the dataset's exact
`has_answer` turn markers and checks them independently in fresh canonical
journals and returned retrieval. Across the five former v6 misses, all 7
marked answer-bearing spans were stored byte-for-byte and all 7 were returned:
5/5 cases, zero write failures, and zero retrieval failures. The prior reached
success remained correct structurally, the question-7 answer-boundary control
passed, and provider/network calls stayed 0/0. The gitignored report records
schema 2 and dataset SHA-256
`d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`.

This is evidence that canonical-first retention fixes the old extracted-memory
omissions for these five cases. It is not an answer-quality grade: retrieval
used a deterministic local concept embedder and a generous bounded candidate
window, not the live Gemini/Ettin/Luna stack. No product defect or Python
successor is justified by this replay, so only the diagnostic was tightened.
The exact-span regression contracts pass 4/4, focused tests pass 32/32,
quickstart passes 6/6, and the complete legacy tier passes 869 with 3 optional
skips.

The founder-approved `$1.05` fresh live answer diagnostic then replayed those
exact five former misses once each through fresh current canonical journals,
Gemini embeddings, local Ettin reranking, Luna retrieval/answers, and the
pinned GPT-4o LongMemEval-compatible judge. All five completed with committed
answers, no retry, infrastructure failure, or budget stop. The official judge
accepted 3/5: the Fitbit duration, remembered beer recommendation, and
photography-workshop interval. It rejected the phone-battery preference answer
and the earlier-kitchen-gadget answer.

The two rejections have different meanings. The phone-battery answer retrieved,
selected, and materially used the exact portable-power-bank memory and explicitly
tailored charging guidance to it. Manual application of the published preference
rubric therefore accepts it, producing a separately labelled 4/5 rubric review;
the official 3/5 remains the primary reported score and is not overwritten. The
kitchen-gadget case is a real retrieval failure: both the earlier Instant Pot
statement and later Air Fryer statement were canonical, but four live retrieval
operations returned only the Air Fryer statement. Luna honestly abstained. Across
all five cases, 7/7 exact answer-bearing spans were canonical, 6/7 were returned,
and the provider-free stage audit reports success 3, retrieval 1, utilization 1,
with zero write, composition, ambiguity, or ungraded cases. The utilization label
is the official-judge view of the disputed preference case.

The campaign used 45 Gemini calls / 2,439,729 conservatively estimated tokens,
18 Luna dispatches, and five judge calls. Fresh accounted spend was
`$0.38219073`: `$0.36595935` Gemini, `$0.01336138` Luna, and `$0.00287` judge.
Because semantic indexing is lazy, the generic runner initially omitted Gemini
usage that occurred during answer retrieval; that exact measured amount was
reconciled into the durable ledger before reporting. Alpha accounted spend is
now `$3.32449828`, below the approved `$3.99230755` aggregate ceiling with
`$0.66780927` headroom. Historical LongMemEval remains 6/10 and sealed U8 was
not included.

Review also found that the provider-free concept stand-in literally contained
answer-derived terms. Those terms were removed and guarded by contract; the
broad-concept structural replay still passes 5/5 with 7/7 exact spans. That
control remains useful for canonical plumbing, but the live miss confirms it
does not predict production ranking under the real candidate and context
budgets.

The first provider-free successor toward iterative bridge retrieval is now
implemented: every `answerWithRetrieval()` session maintains an immutable,
ephemeral retrieval frontier. It records normalized/repeated queries, new and
repeated raw evidence IDs by round, explicit anchors, selected evidence,
remaining budget, budget refusals, and two-round stagnation. Planning metadata
does not count as evidence discovery, anchors must already have been returned,
and the frontier cannot write durable memory (`durableWrites: 0`). This slice
adds observability only: it does not yet generate bridge probes, rerank from
anchors, or reinforce cross-answer edges. Focused tests pass 36/36, quickstart
passes 6/6, and the complete legacy tier passes 873 with 3 optional skips.

The second provider-free slice is now implemented as the opt-in
`iterativeRetrieval` path. After an ordinary result supplies a returned raw
evidence anchor, `memory_bridge` accepts 2–4 provider-generated natural-language
probes, embeds every semantic query in one batch, scans the scoped vector bank
once, adds complementary local ranked surfaces, fuses/deduplicates canonical
messages, and invokes the configured reranker at most once. The complete batch
costs one retrieval call and returns the updated frontier so the provider can
stop after two no-new-evidence rounds. Unknown anchors, duplicate/oversized
probes, malformed bounds, and calls without the opt-in fail closed. The default
instructions and six-tool provider wire remain byte-identical to the sealed
historical path. A provider-free kitchen plumbing contract recovered the raw
Instant Pot statement from Air Fryer-conditioned probes that did not contain
the missing answer term; this verifies batching and provenance, not production
embedding/model quality or a new live answer. Focused tests pass 39/39,
quickstart passes 6/6, and the complete legacy tier passes 877 with 3 optional
skips.

The third provider-free slice now conditions bridge-only candidate reranking
on a bounded combination of the current question, the primary generated
probe, and exact excerpts from every returned raw anchor. The private routing
query preserves both ends of long fields, represents up to four anchors, and
cannot exceed the reranker adapter's 500-character query limit. It is never
registered as evidence or exposed in the tool result; additive
`rerankConditioning` telemetry reports only its mode, anchor IDs, applied
state, and size. The kitchen contract proves the routing query contains the
Air Fryer anchor but not the missing Instant Pot term, while the final answer
commits only the independently returned raw Instant Pot evidence. A separate
four-anchor contract reaches the exact cap without dropping an anchor. The
default six-tool wire remains unchanged. Focused tests pass 40/40, quickstart
passes 6/6, and the complete legacy tier passes 878 with 3 optional skips.

The fourth successor slice adds a fixed-budget, provider-free control matrix
without changing product code. Employment and relocation cases recover one-hop
temporal predecessors; person-alias and project-codename cases recover a raw
relationship mapping and then use it as the next anchor to reach the answer
memory. All four routes pass against plausible wrong-person or wrong-project
distractors with the same ceiling of three retrieval calls, bridge limit 6,
2,400 returned characters per call, two probes per hop, and ten canonical
candidates. Every intended target ranks first, every semantic probe pair is
batched once, all selected IDs were actually returned, and the answer path
still reports zero durable writes. The probes, embedder, and reranker are
deterministic controls, so this establishes cross-domain routing and provenance
plumbing rather than production model quality. Focused tests pass 45/45,
quickstart passes 6/6, and the complete legacy tier passes 883 with 3 optional
skips.

Two bounded answer-only diagnostics then reused the frozen real kitchen store
that had previously missed the canonical Instant Pot statement. In the first,
the iterative stack answered “Instant Pot” after two retrieval calls, but Luna
bypassed `memory_bridge` and issued a speculative second `memory_search` that
included candidate appliance names. This establishes an end-to-end recovery,
not that the bridge policy caused it. In the second diagnostic, general
answer-term-neutral instructions required the next retrieval operation to use
the returned Air Fryer evidence as a bridge anchor and prohibited a second
ordinary search or guessed answer entities. Luna generated four probes that did
not contain “Instant Pot”; the batched Gemini search plus local Ettin reranker
returned the raw Instant Pot statement at rank 5. Luna selected exact quotes
from both the Instant Pot and Air Fryer memories and answered “You invested in
an Instant Pot before getting the Air Fryer.”

The provider-free stage audit classifies the bridge-required diagnostic as
success: both required raw spans were canonical, returned, selected, materially
used, and the answer matched the exact reference. Its frontier closed after two
rounds with seven new raw evidence IDs from the bridge, two retrieval calls
remaining, no stagnation or budget refusal, and `durableWrites: 0`. The two
diagnostics cost `$0.00419108` and `$0.00458084`; alpha accounted spend is now
`$3.33327020` under the approved `$3.99230755` aggregate ceiling, leaving
`$0.65903735`. No official judge was called, the frozen source store remained
unchanged, and historical LongMemEval remains 6/10. This single positive pair
does not estimate false reinforcement or justify persistent successful-co-use
edges. The observed weaknesses are bridge tool selection and rank robustness.

The general iterative prompt now resolves the tool-selection ambiguity without
a kitchen-specific rule: after a returned raw anchor leaves the related fact
missing, the next retrieval call must be `memory_bridge`, this priority
overrides ordinary `memory_search`, and ordinary search resumes only when no
plausible anchor exists or the bridge reports stagnation. A focused contract
pins that hierarchy, while the existing employment, relocation, person-alias,
and project-codename controls remain green.

One fresh default-policy kitchen diagnostic then removed the one-off bridge
override entirely and recorded the tracked product instruction in its private
manifest. Luna independently chose `memory_plan -> memory_search ->
memory_bridge`, generated four probes containing no “Instant Pot,” and answered
“You invested in a new Instant Pot before getting the Air Fryer.” Both exact raw
memories were selected and materially used. The bridge returned the Instant Pot
statement at rank 6, so routing transferred but ranking remains variable. The
first enumeration commitment included an unselected excluded distractor and
needed the provider's one permitted structural repair; the accepted commitment
then contained only the supported candidate. The provider-free stage audit
classifies the case as success with 2/2 exact-span recall and 2/2 material use,
and the frontier reports two retrieval rounds, eleven new bridge evidence IDs,
two calls remaining, no stagnation, and `durableWrites: 0`.

This diagnostic cost `$0.00953201`, bringing alpha accounted spend to
`$3.34280221` under the approved `$3.99230755` aggregate ceiling with
`$0.64950534` remaining. The original source database still hashes to
`00573efbc2599e8ececed64ebc3db3f659011209f69bd3e57436cf7e817c8a96`.
No official judge was called and historical LongMemEval remains 6/10. Focused
tests pass 46/46, quickstart passes 6/6, and the complete legacy tier passes 884
with 3 optional skips.

A bounded transfer diagnostic then separated direct recall, ambiguous
preference coverage, and raw multi-hop routing. The real Fitbit negative
control answered “about 9 months” after one ordinary search and did not invoke
an unnecessary bridge. The real recommendation case used two ordinary
searches and found a genuine direct true-crime preference, but did not recover
the predeclared stand-up/Netflix preference; its recommendation is therefore
useful evidence of an independent-preference coverage ambiguity, not a graded
bridge success or a proven wrong answer.

The 75-note synthetic Firefly control exposed two general continuation-policy
failures before succeeding. Luna first stopped after discovering that Aurora's
point person was Carla, then on the next prompt revision repeated the original
Firefly anchor rather than continuing from Carla. General successive-anchor
guidance produced the complete raw route `Firefly -> Aurora -> Carla ->
September 12` in three retrieval calls, without putting the missing date in a
probe, and Luna answered September 12 correctly. A further prompt instruction
could not make Luna select Carla as final answer evidence. That is the right
architectural lesson rather than another prompt defect: Carla was necessary
routing evidence, while the Firefly mapping and date note were the evidence
used to state the answer.

The retrieval frontier is now `palari-retrieval-frontier/v2`. The host records
every bridge's canonical anchor IDs, returned IDs, newly discovered IDs, and
ordinals, then derives transitive `selectedRoutingLineage` and the subset of
`routingOnlyEvidenceIds` after the final evidence commitment. This is
ID-only, immutable, answer-session telemetry with `durableWrites: 0`; it does
not copy raw text, assert that every returned candidate is semantically
related, or create a learned edge. The answer prompt now explicitly permits a
routing-only memory to remain outside final answer evidence. Provider-free
contracts preserve the distinction for kitchen retrieval and for employment,
relocation, Paco/Pedro alias, and project-codename routes. They also verify
transitive ancestry, immutable ID-only lineage, and zero durable writes.

The transfer prompt diagnostics added `$0.02773636`, bringing alpha accounted
spend to `$3.37053857` under the approved `$3.99230755` ceiling with
`$0.62176898` remaining. No provider was called to implement or test frontier
v2, no official judge was called, and historical LongMemEval remains 6/10.
Focused tests pass 46/46, quickstart passes 6/6, and the complete legacy tier
passes 884 with 3 optional skips.

A founder-approved `$0.50` fresh diagnostic then ran the latest complete stack
once across the ten current regression/integration questions: canonical raw
memory, Gemini query embeddings, local Ettin reranking, planned search
expansion, trusted retrieval time authority, automatic answer composition,
iterative bridges, frontier v2, Luna answers, and the pinned GPT-4o
LongMemEval-compatible judge. All ten completed with no retry,
infrastructure failure, source-custody failure, or budget stop. The official
judge accepted 8/10. This is a current diagnostic over already examined cases,
not a held-out benchmark or a rewrite of the historical 6/10.

The result cleanly separates retrieval from later answer behavior. All 14/14
dataset-marked raw spans were byte-present in the canonical stores and returned
by retrieval. The provider-free stage audit, independently reproduced through
the repository CLI, classifies success 8, composition 1, utilization 1, and
write/retrieval/ambiguity/ungraded 0. In the Harajuku rejection, retrieval
returned both the older one-month statement and the decisive later three-month
update, but Luna selected the older rank-1 row and answered seven months. In
the cultural-events rejection, retrieval returned all three marked preference
spans and Luna selected the two decisive ones, but asked for the user's location
instead of giving the requested recommendation. These are evidence-choice and
answer-policy failures, respectively; another retrieval rule would not fix
either one.

The iterative bridge ran in 3/10 cases but no bridge-discovered memory was
materially used in an answer, and the batch produced no routing-only evidence
IDs. It therefore supplies no positive training event for asynchronous co-use
edges. Review also found that `selectedRoutingLineage` intentionally follows
all selected commitment IDs, including evidence explicitly marked not used;
any future learner must admit only materially used answer evidence and its
successful routing ancestry, never selected lineage alone. Persistent co-use
ranking remains deferred.

The campaign added `$0.03314374` of accounted spend, bringing the alpha ledger
to `$3.40368231`. It stayed below both the fresh run cap of `$3.87053857` and
the approved aggregate ceiling of `$3.99230755`, leaving `$0.58862524` of
approved headroom. The run made 14 Gemini query-embedding calls and 35 Luna
dispatches. Sealed U8 was absent, the ten source stores remained unchanged, and
all private inputs, traces, answers, judge labels, and provider-free reports
remain gitignored under `.palari-alpha/latest-ten-v1-2026-08-08/`.

The first post-retrieval successor is now implemented provider-free. On the
active `compositionMode: 'auto'` path, a registered `current` plan cannot
silently commit an answer from older direct-user evidence while later highly
ranked direct-user memories remain unassessed. The host bounds review to at
most three later candidates appearing in the top three positions of a returned
evidence set. Each candidate may control the answer or receive a specific
`not_used_reason`; recency forces assessment, never truth. An old-only
commitment crosses the existing one-repair boundary, so a correct first
commitment adds no dispatch. Historical plans and the default standard mode
remain unchanged.

This review is answer-session state over canonical raw evidence, not a durable
semantic fact schema. Its additive `palari-current-evidence-review/v1`
telemetry records candidate, assessed, and materially used IDs with
`durableWrites: 0`. Provider-free medication, employment, and subscription
controls reject old-only current answers and accept the later updates. A
furniture control accepts an older controlling fact after explicitly dismissing
a newer but unrelated lamp update; a historical-office control accepts the
older location without invoking current review. The OpenAI adapter control
also proves that the ordinary forced commitment repair carries the host
rejection and accepts the corrected evidence choice. No provider was called,
spend remains `$3.40368231`, focused tests pass 53/53, quickstart passes 6/6,
and the complete legacy tier passes 891 with 3 optional skips. This is an
offline general mechanism, not a new Harajuku answer result.

The second post-retrieval successor is also implemented provider-free. On the
active auto path, recommendation and suggestion questions resolve to a
structured `recommend` composition mode when the provider declares support;
the bundled OpenAI provider does. A non-abstaining commitment must contain at
least one concrete proposal linked only to materially used evidence, and the
proposal must appear verbatim in the final answer. A clarification question
may follow but cannot replace every proposal. Honest abstention remains
available with zero proposal items.

The contract separates personalization from external availability. When a
proposal depends on current inventory, event listings, or availability not
established by returned evidence or another authorized tool, the provider must
declare `requiresExternalVerification` and include an exact verification note
in the answer. The host verifies proposal presence, evidence linkage, and
caveat presence; it does not claim to semantically prove that the provider
correctly identified every external dependency. Category- or strategy-level
proposals remain the safe fallback when live specifics are unavailable.

Provider-free drink, exercise, and reading controls accept preference-linked
proposals. A cultural-events control reproduces the observed failure shape:
clarification-only is rejected through the ordinary one-repair boundary, then
an evidence-linked French/Spanish language-exchange proposal with an explicit
current-listing caveat is accepted before the location question. Restaurant
controls reject unused evidence, missing verification notes, and proposals
absent from final prose; an unrelated clock memory preserves honest
abstention. Explicit lists/counts still take enumeration priority and explicit
standard mode remains unchanged. No provider was called, spend remains
`$3.40368231`, focused tests pass 61/61, quickstart passes 6/6, and the complete
legacy tier passes 899 with 3 optional skips. This is not a new live
cultural-events result.

The founder-authorized two-case answer-only confirmation then ran once from
custody-verified copies of the frozen canonical stores with zero retries and a
fresh `$0.10` aggregate allowance. Harajuku completed correctly: Luna selected
the later direct “3 months” row, answered “about 3 months,” and the pinned
judge returned `yes`. This confirms the post-retrieval temporal behavior on
the original failure, although no repair was needed because the first
commitment chose the current evidence.

The cultural case retrieved and materially used the direct language-diversity
and French/Spanish preferences and generated three concrete, evidence-linked
proposal records with external-listing caveats. It nevertheless terminated at
the answer boundary before judging. The first commitment's prose paraphrased
its structured clarification, proposal, and caveat fields instead of copying
them verbatim. The host reported only the first mismatch; Luna corrected that
one in its sole repair, then encountered the still-unreported proposal
mismatch. This is a validation/repair ergonomics failure, not another retrieval
miss or a lack of useful recommendation content.

The provider-free successor now accumulates all answer-text occurrence
mismatches for an otherwise well-shaped recommendation into the same host
rejection. Exact proposal, caveat, clarification, and evidence-link checks stay
unchanged, as do the one-repair and seven-dispatch ceilings. A regression
reproduces all three simultaneous mismatches and proves that one rejection
names all three before accepting a fully corrected commitment. The run added
`$0.05245006` of conservative accounted spend—the failed answer stage retains
its `$0.05` reservation—bringing the ledger to `$3.45613237` under the
approved `$3.99230755` ceiling. No retry or second live replay was performed;
historical LongMemEval remains 6/10. Focused tests pass 62/62, quickstart
passes 6/6, and the complete legacy tier passes 900 with 3 optional skips.

The founder then approved one fresh cultural-only confirmation under a `$0.05`
cap. It ran once with zero retries from a custody-verified copy of the same
frozen store. The aggregate surface rejection worked: Luna's repair copied all
three structured proposals, all three exact external-verification notes, and
the complete clarification question into useful final prose. The answer still
terminated before judging because its `current` retrieval plan had exposed a
later direct-user row that the commitment did not assess. That independent
current-evidence defect was reported only after the surface repair consumed
the single repair turn.

The generalized provider-free successor now accumulates recommendation-text
occurrence defects and unresolved bounded current-evidence review into the
same late-validation rejection. It does not weaken exact text, evidence use,
recency assessment, one-repair, or dispatch limits. A combined regression
starts with missing proposal/caveat/clarification text and an omitted later raw
memory, verifies that the one rejection names all four defects including the
later evidence ID, and accepts one fully corrected commitment. The failed live
stage conservatively retained its full `$0.05` reservation, bringing accounted
spend to `$3.50613237`. No additional replay was made, and historical
LongMemEval remains 6/10.

Focused tests pass 63/63, quickstart passes 6/6, and the complete legacy tier
passes 901 with 3 optional skips.

## Active commands

```bash
npm test                 # focused alpha runner contracts
npm run alpha:check      # same explicit focused gate
npm run quickstart       # six-step product memory journey
npm run test:legacy      # complete historical suite, on demand
npm run alpha:debug -- --adapter <module> --questions 11-20 --max-dollar 0.50
npm run memory-stage-audit -- --input <local.json> # classify observed failure stage
```

Alpha debug logs, local adapters, and aggregate budget state belong in
`.palari-alpha/`. They are mutable and gitignored; logs are diagnostics, not
benchmark grades. Run only one alpha CLI process at a time.

## Next

Do not tune retrieval further for `0a995998`: all three original statements
were returned and enumerated. The general policy now treats an action phrased
as both outstanding and resolved as ambiguous rather than forcing either the
model's prior 2 or the benchmark's 3. No new live answer is claimed. Continue
collecting explicitly labelled current-product cases with the stage audit.
The five-case final-answer replay is complete and must not be repeated or used
to regrade sealed v6. The iterative bridge can now continue through raw alias
and codename memories, and frontier v2 preserves which intermediate raw
memories actually routed a selected answer memory. The ten-case diagnostic
showed that the immediate product work was after retrieval. The temporal
successor is now confirmed live on its original failure. The recommendation
successor produced useful structured content on its original failure but two
fresh confirmations exposed a multi-error/single-repair waterfall. The host
now reports the observed recommendation-text and current-evidence defects
together. Do not replay this same cultural case again; collect distinct real
relationship cases before deciding whether the structured recommendation
contract is worth its latency and complexity. Make no provider call without a
new explicit founder-approved cap. Continue collecting
distinct real relationship cases, recording bridge use, candidate rank,
materially used answer evidence, routing-only lineage, audited outcome, and
unnecessary bridge calls. Do not tune from the single ambiguous recommendation
case or repeat the same kitchen/Firefly pair to manufacture recurrence.

Do not let co-use metadata affect ranking yet. Once distinct successful and
failed lineages exist, evaluate a provider-free asynchronous edge proposal
using only materially used answer evidence plus successful routing ancestry,
with negative controls for irrelevant candidates, deletion cascades, scope
isolation, and non-reinforcement after failure. Selected-but-not-used evidence
is not a positive event. Only retain the proposal if an offline ablation
improves later retrieval at fixed cost without false reinforcement. Do not add
a Python learning lab unless current canonical retrieval failures repeat and
this simpler bridge-search path stops improving them.

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
