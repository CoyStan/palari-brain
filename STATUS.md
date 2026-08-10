# STATUS — Palari alpha

## 2026-08-10 current handoff

BRN-0044 adds a provider-free candidate for graceful model-dispatch closure.
The configured limit still bounds normal planning, retrieval, confirmation,
and answer work. If that limit ends without an accepted answer, the OpenAI
adapter now allows at most two additional closure-only calls: the first may
assess an already-returned confirmation page or commit, and the second is
commit-only for the existing single repair. These calls cannot start another
memory retrieval. Evidence-backed output still requires the unchanged
host-owned memory-number translation and commitment validation; invalid
closure remains terminal. Closure responses are now validated against the
exact tools offered for that call, so a commitment mixed with a memory or
unknown tool fails before the repair path. Focused OpenAI contracts pass 42/42
across 40 top-level tests, including tool-disabled no-evidence closure,
pending-page review, repaired commitment, mixed forbidden-tool rejection, and
exact physical-call exhaustion. The alpha gate passes 90/90, quickstart passes
6/6, and the complete legacy tier passes 942 with 15 optional skips and zero
failures across 957 tests. No provider, credential, private alpha
artifact, dataset, or sealed U8 question was accessed in the ticket worktree.
The paused S60 alpha campaign and any founder-authorized failed-case rerun are
outside the ticket and remain pending review, acceptance, merge, and push.

The repository now presents Palari Brain as an evidence-first memory kernel
with the tagline “Memory that can show its work.” A current read-only survey of
Mem0, Letta, Graphiti, and Supermemory informed the README structure: one clear
position, an early quick start, a compact feature scan, and a visible system
path. Palari keeps its own trust-led category position rather than copying a
hosted-platform or benchmark-leader claim. Original generated mark and header
artwork live under `assets/brand/`, with palette, prompt, and processing notes.
The README's missing architecture link is removed, package metadata now carries
repository discovery fields, and dry packaging includes the brand assets. This
change does not alter memory behavior. All local README links pass, the focused
provider-free gate passes 90/90, and quickstart passes 6/6.

BRN-0043 now has a provider-free score-preserving native-reranker safety
candidate. The generic Transformers and modular Ettin adapters measure exact
query/document pair lengths with their loaded tokenizer, pass explicit
512-token and 7,999-token model ceilings respectively, stably bucket by length,
and run at most eight pairs under a `batch * padded_tokens^2 <= 2^24` target.
A pair that alone exceeds the target is an explicit one-item batch rather than
padding up to 49 unrelated candidates. Scores are restored to caller order;
only one rerank runs per adapter; encoded inputs and outputs are disposed on
success and failure; explicit idempotent close releases the loaded model when
supported. Content-free metrics report batch work, timing, boundary RSS, and
process high-water RSS. Confirmation may still gather and information-filter
up to 200 cheap candidates, but only the first 50 in stable fused order can
cross the public reranker boundary.

Focused provider-free contracts pass 77/77, core tests pass 90/90, quickstart
passes 6/6, and the complete legacy tier passes 935 with 15 optional skips and
zero failures across 950 tests. The inert Ettin identity verifier still pins
the same model, three modular-head artifacts, 16-case bank, and audited
Transformers.js 4.2.0 closure. A new external-path `--profile` mode can repeat
a mixed-length 50-pair native workload and record within-run repeat stability,
schedule shapes, latency, and RSS. After the ticket merge, the frozen bank and
native profile ran against the audited external runtime and model cache. The
frozen bank kept recall@5 at 15/15, placed the expected result first in 14/15
cases, and measured MRR 0.9667. Its 37.51 ms warm mean was 43.5% slower than
the prior 26.14 ms run. The 20-by-50-pair profile was stable, had zero score
change, and reached a 3.19 GiB process RSS high-water mark. It used 13 batches
per iteration; the longest pair had 6,421 tokens. These are local diagnostic
measurements, not a release benchmark regrade.

Independent review reopened the first candidate after finding that one
successfully loaded native component could be orphaned when a parallel factory
failed, and that profile shutdown failure was suppressed. Component loading is
now transactional across synchronous throws, asynchronous rejection, and
post-load validation: every fulfilled disposable component is rolled back
before the load error escapes. The profile now records a typed failed result
when close fails. Provider-free regressions reproduce both findings.

The active T3 service exposed a 12 GiB memory limit during post-merge native
validation. BRN-0043 does not mutate systemd, cgroups, containers, T3, or
deployment state, so OS-level worker containment remains a separate operations
step. Likewise 512-token Ettin passage windows, MaxP, AVX2 uint8, fused-head
ONNX, candidate reduction below 50, and model/runtime replacement remain
separate quality challengers. No provider, credential, dataset, private alpha
artifact, or sealed U8 question was accessed during the ticket review itself.

The OpenAI final-answer wire no longer asks the model to transcribe evidence
IDs or quote text already held by the host. For every answer base, the model
now sends a stable answer-local `memoryNumber`, a `used` or `not_used`
disposition, and one rationale. The adapter binds that number to the canonical
ID and a bounded exact excerpt of the returned text before the unchanged host
validator runs. Enumeration uses the same boundary while retaining its label,
action, classification, and reason. Confirmation numbering and the distinct
page-local review number remain stable. Custom providers keep the historical
canonical-ID and exact-quote contract.

Provider-free validation passes the 52/52 focused parent contracts, 89/89 core
tests, quickstart 6/6, and the final integrated complete legacy tier with 940
passes, 3 optional skips, and 0 failures across 943 tests. The independent
detached review environment observed the same 943-test tier with 928 passes and
15 optional skips. The active generation and count-projection request bodies
are each 24 bytes smaller and have refreshed active pins; historical BRN-0025
pins are unchanged. This removes a redundant transcription/plumbing failure
mode. It does not claim a semantic ownership, airline, or other reasoning fix,
and it does not regrade a benchmark.

Recovery of the interrupted super-hard diagnostic found ten planned cases:
seven had started and three never started. Of the seven starts, two produced
judge results (the music-companion case correct and the airline case incorrect),
three recorded failures (two invalid bounded commitments after one repair and
one dispatch-budget exhaustion), and two stopped with only `inflight` markers.
The airline run returned all 3/3 marked spans but selected none. The honest
summary is therefore 1/2 among judged answers, five started but unjudged, and
three not run. No diagnostic process remains active. The recovered private
ledger was `$43.75766948` under its recorded `$48` cap. BRN-0042 made no paid
call, did not retry the diagnostic, and did not read or modify its private
artifacts.

The founder then authorized one clean-scratch rerun of the same frozen ten on
the merged host-owned-evidence product at commit `850ae69`, with no retries or
inter-case tuning and a new `$50` aggregate ceiling. All ten received exactly
one start. Six completed, reached the judge, and all six were judged correct:
museum ordering, concert ordering, Valentine's-Day airline, shoes cleaned,
music-event companion, and model-kit count. The honest result is 6/6 among
judged answers plus four unjudged `inflight` interruptions—not 6/10. The
airline-ordering process ended with the chat-session crash; the final charity,
fitness-class, and furniture cases were killed by the host with exit 137 under
memory pressure. None was retried and no diagnostic process remains active.

Across the six completed answers, all 21/21 dataset-marked spans were returned,
17/21 were selected, and 15/21 were materially used. All source-custody hashes
verified, confirmation made no durable write, and no completed answer failed
the new host-owned commitment boundary. The previously incorrect
Valentine's-Day airline case now returned and selected all 3/3 marked spans,
materially used the decisive airline evidence, and was judged correct. This is
encouraging live evidence that redundant quote transcription is gone, but one
nondeterministic rerun does not prove that the wire change caused every answer
improvement.

Measured spend for the six completions was `$0.15372462`: `$0.14934137` for
OpenAI answer dispatches, `$0.00040575` for embeddings, and `$0.00397750` for
six judge calls. Four interrupted cases conservatively retained `$2.80` in
reservations, so the aggregate ledger advanced by `$2.95372462` to
`$46.71139410`, leaving `$3.28860590` under the approved `$50` ceiling.

After the native safety checks passed, the founder approved one no-retry canary
and then the other three interrupted cases as separate processes. The charity
canary answered two months and was judged correct. The fitness case answered
five classes and was judged correct. The furniture case answered three; the
reference is four, so the judge marked it incorrect. The final airline case
did not reach an answer or judge because OpenAI returned HTTP 429. It was not
retried. The honest continuation result is therefore two correct and one
incorrect among three judged answers, plus one unjudged provider failure.

All four processes exited without host memory pressure. Their process RSS
high-water marks ranged from 1.23 GiB to 1.62 GiB, and the T3 cgroup recorded
zero `memory.max`, OOM, and OOM-kill events throughout. This removes the prior
exit-137 infrastructure blocker for these workloads on the current host. The
three completed cases measured `$0.06219460`. The provider failure retained
its full `$0.70` reservation, so the aggregate ledger advanced by `$0.76219460`
to `$47.47358870`, leaving `$2.52641130` under the approved `$50` ceiling.

A provider-free source review confirms that all four distinct decisive
furniture facts were present in canonical memory, returned, selected, and
materially used. The fifth dataset-marked span was a duplicate coffee-table
statement. The model included the coffee table, bookshelf, and kitchen table,
but kept the ordered Casper mattress separate from the definite count because
purchase or receipt was not explicitly established.

The first local stage audit incorrectly labelled this as utilization because
the agent supplied a manual `ambiguous: false` judgment and treated the fixed
reference as product truth. The founder rejected that policy: Palari should not
assume that the user has an item only because it was ordered. The corrected
founder-labelled audit classifies the case as `ambiguity`, with zero write,
retrieval, composition, utilization, ungraded, provider, or network events.
The GPT-4o judge saw only the question, fixed answer `4`, and Palari response;
it did not see the memories or judge whether caution was useful. Its `No` means
reference mismatch, not a proved product defect. No transaction-semantic
prompt change should proceed from this case.

The founder then authorized one new no-automatic-retry airline run after the
HTTP 429. It completed in 56.75 seconds with a 1.24 GiB process RSS high-water
mark and no cgroup memory or OOM event. Palari answered `JetBlue`, `Delta`,
`United Airlines`, then `American Airlines`; the fixed reference judge returned
`Yes`. The run measured `$0.02777550`, bringing the aggregate ledger to
`$47.50136420` and leaving `$2.49863580` under the approved `$50` ceiling. The
earlier HTTP 429 reservation remains conservatively retained.

## 2026-08-09 current handoff

The latest practical-memory path still uses canonical raw dialogue with
provenance, hybrid retrieval, local Ettin reranking, model-directed iterative
queries, exact-session navigation from prior Palari answers, `memory_bridge`,
and an ephemeral retrieval frontier. No fixed semantic schema or persistent
successful-co-use edge was added.

The OpenAI answer wire now gives each citable returned memory a stable,
answer-local integer and asks Luna to commit those short numbers rather than
copy opaque evidence IDs. The adapter translates them back before the
unchanged host validation boundary, so exact quotes, provenance, scope,
enumeration, temporary-inference provenance, recommendation support, and
material confirmation evidence remain canonical-ID checked. Confirmation
seeds prior evidence into the same mapping before fresh results extend it;
page-local `candidateNumber` remains separate. Unknown numbers use the existing
single repair. Custom providers retain the historical evidence-ID contract,
and old BRN-0025 request hashes remain historical while the new active wire has
its own pin. Two independent reviews found and closed prompt/rejection ID leaks,
confirmation seeding, bounded-callback isolation, and adjacent-fixture gaps.
Provider-free validation passes 84/84 adjacent contracts, `npm test` 89/89,
quickstart 6/6, and the complete legacy suite 939 with 3 optional skips.

The founder-authorized isolated instrument rerun then completed once with zero
retries under the rounded `$42` aggregate cap. The interface fix worked:
all four main/confirmation commitments used short integer memory numbers, the
host accepted the final answer, and the prior malformed-Korg-ID failure did not
recur. All 4/4 dataset-marked spans were retrieved; 2/4 exact marked spans were
selected and materially used, while alternative direct raw rows made all 4/4
smallest decisive instrument facts retrieved, selected, and materially used.
No bridge call, frontier refusal, stagnation, or durable write occurred.

The completed answer was still judged incorrect. Palari definitively counted
the Fender Stratocaster, Korg B1, and Yamaha FG800, but classified the Pearl
Export drum set as ambiguous because the user was preparing to sell it and no
later memory confirmed whether the sale completed. It answered three confirmed
and four if still owned; the reference expects four. Confirmation performed two
searches and two sparse reviews over 40 genuinely unseen candidates, found six
material ownership-related rows in the first page, then closed normally after
a second page had no material findings. This converts an unjudged interface
failure into a clean semantic answer-interpretation miss; it is not a retrieval,
bridge, or source-custody failure and is not a benchmark regrade.

Fresh accounted spend was `$0.02288860`: `$0.02211530` OpenAI across eleven
answer/reviewer dispatches, `$0.00008580` for four embedding inputs, and
`$0.00068750` for the official judge. The aggregate ledger is now
`$40.10470059`, leaving `$1.89529941` under the approved `$42` ceiling. The
isolated process exited normally with a 3,481,812 KB peak resident set and no
swaps. The 1,556,480-byte frozen source remains exactly
`68180eb61d7afda6f9bc799527daae723b562b9147d89e718fb49ee8c94c9303`.

GPT-5.6 Standard settlement now accounts for cache-write tokens as a distinct
input subset at 1.25 times ordinary input, while preserving historical
zero-write Luna and Sol behavior. The provider-free correction increased the
private aggregate ledger from `$4.35556818` to `$4.36187003`. The evaluation
path also has an exact-content, namespace-bound SQLite embedding cache and a
transport-only rolling Gemini pacer. The cache stores only digests and derived
vectors, never raw text or provenance, and fails closed on corruption.

The all-runnable LongMemEval alpha diagnostic excluded all ten sealed U8 IDs
before source ingest and hash-verified 490 immutable source stores. It completed
the first 21 cases before Gemini credit exhaustion: 21/21 were judged correct,
all 22/22 marked spans were retrieved, and 20/22 were selected and materially
used. These were all single-session-user cases, so this is positive but narrow
diagnostic evidence, not a benchmark score. The interrupted population run was
not retried or presented as a regrade.

A separately frozen hard set then targeted multi-session composition, temporal
reasoning, and knowledge updates. A 1,024-token per-dispatch ceiling caused two
answer-agent completion failures, so an explicitly labelled follow-up changed
only that ceiling to 5,120. Of eight cases run at 5,120, seven produced accepted
answers and four of those seven were judged correct. Across the seven completed
cases, 24/31 dataset-marked spans were returned, 17/31 were selected, and 15/31
were materially used. A manual fact-level audit found 16/20 decisive facts
returned and 15/20 selected and used. The three incorrect answers were two
retrieval-coverage misses and one post-retrieval latest-update selection miss.
The eighth case proposed the substantively correct count but retained an
invalid evidence ID after one repair, so the host rejected the commitment
before judging. All eight source hashes remained unchanged.

No completed hard case used `memory_bridge`; there were no frontier budget
refusals, stagnation flags, or durable writes. The incorrect completed cases
all closed with unused retrieval calls, so the next practical work is retrieval
completeness/continuation and latest-update selection—not learned co-use edges.
This hard-set work is alpha diagnostic evidence and does not change historical
LongMemEval grades.

The founder-authorized follow-up reran the three judged-wrong hard cases plus
the host-rejected charity case through the new confirmation path at 5,120
output tokens, with no retries or inter-case tuning. None reached the judge, so
this produced zero new grades and is not a benchmark regrade. Health-device
retrieval improved from two to three device types but still missed the
nebulizer, then failed the main commitment and its one repair before
confirmation. The other three produced provisional answers and entered
confirmation: instruments improved from two to three but still missed the
Pearl drum set; Rachel recovered both Chicago and the later suburbs update but
still emphasized Chicago; charity correctly enumerated all four prior events.
All three exhausted two confirmation rounds because every unseen paraphrase or
merely related row was treated as materially new.

The follow-up made 11 searches, two reads, and two `memory_bridge` calls.
Bridge recovered facts used by the provisional instrument and charity answers,
but no answer completed successfully, so this is not yet evidence for durable
successful-co-use edges. All four copy-first source audits completed their
failure-path verification, and current source hashes still match frozen
preflight hashes. The failed answer calls measured `$0.06090755`; conservative
failure accounting retained four `$0.70` reservations, or `$2.80`. The private
failure audit is resumable under `.palari-alpha/`.

A second founder-authorized follow-up ran the same four frozen cases through
confirmation v3 under aggregate cap `$33.63738150`, again with no retries or
inter-case tuning. It also produced zero completed answers and zero judge
calls, so it adds no grades. Health retrieval now found the nebulizer but
missed hearing aids; instruments returned only the Fender and Korg; Rachel's
provisional answer used only the older Chicago statement; charity again
proposed the correct four-event answer. In health, instruments, and Rachel,
the reviewer naturally tried a second search after its first non-empty search,
while v3 required classification to be smuggled through a final-answer
commitment; the host correctly blocked the unassessed-search bypass. Charity
did attempt that commitment-based classification, but a one-repair sequence
ended with a malformed evidence ID. None of these outputs is a result.

The v3 follow-up made 14 searches and one instrument `memory_bridge` call. All
four sources remained byte-identical. Provider calls measured `$0.04666944`,
while conservative failure accounting retained another four `$0.70`
reservations. Failure-path frontier snapshots were again unavailable because
the answer API threw before returning its structured result; the private audit
records that telemetry limitation rather than inferring a clean frontier.

The product answer path now has an opt-in, answer-type-independent novelty
closure review. Its first answer is provisional. A fresh provider invocation
receives the draft and one representative per previously returned information
identity. Its provider-facing tools are host-filtered `memory_search` plus the
ephemeral `memory_candidate_review` control.
Information identity combines normalized content with speaker, optional
author, and observation time. The host removes every previously returned ID
and exact/cosmetic duplicate before top-K truncation and collapses duplicates
within a result. A search match is now an unseen candidate, not automatically
new information. After every non-empty search, v4 requires one exact candidate
review covering every latest evidence ID. Material evidence keeps the answer
open and forces another unseen search; ignored candidates cannot be returned
again. Review calls consume no retrieval budget, perform no durable write, and
cannot be replaced by a second search or premature commitment. The final
retrieval boundary still exposes review before forcing commitment. An empty
search or a review classifying an unsaturated latest set as non-material closes
the check. A full 20-candidate set always requires another duplicate-filtered
search because more unseen candidates may remain; the next search cannot
return any already returned or ignored information identity. All earlier
material evidence must remain assessed in the final commitment. This is a
general reviewer judgment rather than a hand-authored semantic schema or a
similarity threshold that could hide negations and corrections.

The v4 confirmation telemetry separates all unseen candidates, materially new
information, explicitly ignored candidates, and exact duplicates suppressed
before retrieval, and counts classification calls separately from searches.
The final selected answer evidence still contains only rows with a material
consequence. Identical Palari speech cannot hide direct user evidence, and the
same words observed later remain available for temporal review. Once any
candidate is assessed, it cannot recur in that answer journey.

Provider-free controls cover health-device composition, archive recall,
paraphrase rejection, temporal repetition, speaker authority, and a
project-name update: exact copies are invisible, every candidate is assessed,
material novelty forces revision, a non-material candidate set may close,
premature commitment is rejected, and a final novel result cannot be released
when the review budget ends. The OpenAI loop still treats the special host
rejection as a command to reopen retrieval rather than enter commit-only
repair.

The founder-authorized v4 live diagnostic reran the same four frozen hard
cases with no retry or inter-case tuning. Three completed and reached the
official judge: charity was correct, while instruments and Rachel were
incorrect. Health failed exact-evidence commitment after its one repair and
did not reach the judge. This is 1/3 among completed answers plus one unjudged
failure, not a four-question score and not a benchmark regrade.

The v4 control worked mechanically on every completed answer: three searches
returned 11 never-repeated candidates, three explicit reviews classified all
11 as `not_used`, and every journey closed without a durable write. It did not
provide positive evidence for semantic completeness. Rachel's later direct
suburbs statement was already among all three retrieved marked spans, but the
answer selected the older Chicago statement and the reviewer still closed.
The instrument answer retrieved only 1/4 marked spans, missed the Yamaha, and
treated an expressed intention to sell the still-owned Pearl drum set as
ambiguous. Charity retrieved all 6/6 marked spans and correctly composed four
earlier events. Health retrieved evidence for Fitbit, Accu-Chek, nebulizer,
and hearing aids, but proposed three definite devices plus an ambiguous fourth
before its malformed exact-evidence commitment failed. Across the three
completed cases, 10/13 marked spans were retrieved, 6/13 selected, and 5/13
materially used.

No v4 case called `memory_bridge`; completed frontiers had no budget refusals
or stagnation. All four current source hashes match their frozen preflight
hashes. The expected fresh spend was `$0.05–$0.20`; measured provider spend was
`$0.05047783`. Conservative failure accounting charged `$0.74036789`, bringing
the mutable private aggregate ledger to `$34.37774939` under the approved
`$36.43738150` ceiling. The remaining ceiling headroom is `$2.05963211`, but
the approved no-retry run is complete and no provider process is running.
Expected spend and authorization ceilings remain distinct.

The finding is narrower than “confirmation failed”: explicit classification
and duplicate exclusion now work, but a reviewer can still close confidently
after an unproductive query or overlook decisive evidence already present in
its prior returned-information context. The next product change should target
general reviewer coverage and prior-evidence conflict assessment, not
`memory_bridge` or persistent co-use edges.

A provider-free replay then isolated the health infrastructure failure. The
first commitment used a non-contiguous hearing-aid quote and correctly received
its one repair. The repaired commitment used exact quotes, but the host still
rejected it because two later top-ranked user rows—another daily Fitbit use and
an irrelevant health-planner statement—were absent from its evidence
bookkeeping. The provider had received only a general instruction, not the
host's hidden two-ID candidate list.

That current-evidence rule is now deliberately smaller. The host no longer
requires arbitrary unused retrieval rows to be selected and explained, and the
matching prompt sentence was removed. Exact returned evidence IDs, exact
contiguous quotes, one declared consequence or non-use reason for every row the
provider does select, scope isolation, and provenance validation remain
mandatory. `currentEvidenceReview` still reports candidate, assessed, and
unresolved IDs as diagnostic telemetry, but unresolved IDs cannot reject an
otherwise valid answer or consume a repair. This removes a false infrastructure
failure. Replaying the exact repaired health commitment against a copy of its
frozen source now accepts it while retaining both unresolved IDs in telemetry;
the replay used only the existing content-addressed cache and local reranker.
This does not claim to solve semantic errors such as Rachel selecting Chicago
over the already returned suburbs update. No paid call tested this
simplification. Focused current-evidence/confirmation/OpenAI contracts pass
42/42, `npm test` passes 83/83, quickstart passes 6/6, and the complete legacy
suite passes 926 with 3 optional skips.

The founder-authorized no-retry follow-up then ran the same four frozen cases
on that simplified setup under aggregate cap `$37.17774939`. Two completed and
reached the judge: charity was correct and Rachel again selected the older
Chicago statement over the already retrieved later suburbs update. Health and
instruments reached confirmation but failed there, so they are unjudged. This
is 1/2 among completed answers plus two unjudged failures, not a four-question
score and not a benchmark regrade.

The intended simplification worked: health's repaired main commitment was
accepted and entered confirmation instead of being rejected for absent
bookkeeping on arbitrary later rows. Its new provisional answer found Fitbit,
Accu-Chek, and hearing aids but omitted the nebulizer. After one material
candidate review and another search, its second review mistyped one evidence
ID and the host rejected it. Instruments again missed Yamaha and treated the
Pearl set as ambiguous. Both bounded confirmation searches found material
ownership-related candidates; after the final review left closure open with no
search budget, the model attempted an invalid extra review using stale IDs and
the host rejected it rather than release an unconfirmed answer.

Across the two completed cases, all 9/9 marked spans were retrieved, 3/9 were
selected, and 3/9 materially used. Their confirmation searches returned six
never-repeated candidates, classified all six `not_used`, and performed no
durable write. Across all four cases there were no `memory_bridge` calls;
Rachel used one `memory_read`. All four current source hashes match frozen
preflight. Expected fresh spend was `$0.05–$0.15`; measured provider spend was
`$0.05057792`. Conservative accounting retained two `$0.70` failure
reservations and charged `$1.42353239`, bringing the private ledger to
`$35.80128178` under the approved `$37.17774939` ceiling. The completed run
leaves `$1.37646761` ceiling headroom, but no provider process or additional
paid call is running.

This rerun supports the smaller boundary: the former false host rejection is
gone, while Rachel remains plainly a model reasoning error. The remaining
unjudged cases expose narrow confirmation-control problems—one copied-ID typo
and one invalid action after bounded material discovery—not evidence for more
memory machinery, bridge learning, or a fixed semantic schema.

The health confirmation failure exposed an avoidable interface defect rather
than a reason to add prompting or memory machinery. The reviewer had been
required to reproduce each opaque 64-hex-character evidence ID; it omitted
five characters from one otherwise correctly understood candidate. Confirmation
schema `palari-answer-confirmation/v5` now accepts exactly one
`{disposition, reason}` assessment per latest candidate in result order, and
the host binds those positions back to its immutable evidence IDs. Full IDs
remain in ephemeral audit telemetry, while the model can no longer mistype,
duplicate, or invent them. Strict count validation still rejects omitted or
extra assessments, and old ID-bearing review payloads fail closed. This was a
provider-free correction: focused confirmation/OpenAI tests pass 35/35,
`npm test` passes 84/84, quickstart passes 6/6, and the complete legacy suite
passes 927 with 3 optional skips. The private ledger remains `$35.80128178`;
no paid rerun was made.

The founder then authorized aggregate cap `$36.50128178` for one fresh,
no-retry health-case diagnostic on confirmation v5. The mechanical correction
worked: the ordered five-candidate review completed, every assessment was
bound to its host-owned evidence ID, and no malformed-ID failure occurred.
The answer was nevertheless wrong: it returned 2 devices (Fitbit Versa 3 and
Accu-Chek Aviva Nano) against reference count 4, and the official judge
returned false. Main retrieval recovered 3/6 marked spans and only 1/6 marked
spans was selected and materially used; both hearing-aid spans and the
nebulizer span were missed. One confirmation search returned five genuinely
unseen but non-material Fitbit/nasal-spray candidates, correctly ignored all
five, then closed with one confirmation call and two main retrieval calls still
unused. There were no bridge or read calls, no repeated confirmation evidence,
and no durable writes. This isolates the remaining failure as retrieval-query
coverage plus premature semantic closure, not ID plumbing.

Expected fresh spend was `$0.01–$0.03`; measured and accounted fresh spend was
`$0.01027536` (`$0.00979001` OpenAI, `$0.00003285` embeddings, and
`$0.00045250` judge). The private ledger is now `$35.81155714`, below the hard
aggregate authorization ceiling `$36.50128178`. The embedding cache recorded
458 hits and 2 misses. Source custody passed and the source database hash still
matches frozen preflight. This remains an alpha diagnostic, not a benchmark
regrade.

Provider-free inspection then found that the five-result confirmation was not
a five-candidate limit. The reviewer requested up to 20 candidates, but five
long complete messages consumed its model-authored 12,000-character budget;
the host incorrectly allowed that character-truncated page to close because it
was shorter than 20. Confirmation schema `palari-answer-confirmation/v6` now
keeps those budgets host-owned, presents at most 20 compact exact 800-character
excerpts inside 20,000 characters, and places direct user evidence before
derivative Palari navigation anchors. Complete canonical messages remain
host-side for exact-quote validation and audit; ordinary retrieval still
returns complete messages unchanged.

Confirmation results now state whether truncation left an unseen tail. A tail
keeps the answer provisional and forces the next duplicate-filtered page even
when every displayed candidate was classified `not_used`. Previously returned,
ignored, or provenance-aware duplicate information remains ineligible, so the
next page contains only genuinely unseen information identities. A focused
regression proves character-truncated pages are disjoint, preserve full source
validation, perform no durable write, and cannot close early. `npm test` passes
85/85, quickstart passes 6/6, and the complete legacy suite passes 928 with 3
optional skips. No paid call was made; the private ledger remains
`$35.81155714`.

The founder then authorized aggregate cap `$36.51155714` for one no-retry
health rerun on confirmation v6. The case did not complete and the official
judge was never called, so it has no grade and is not a benchmark regrade. Its
main answer was nevertheless substantively correct: two searches selected four
raw user memories and answered that the user uses four devices—Accu-Chek Aviva
Nano, Fitbit Versa 3, a nebulizer, and Phonak BTE hearing aids—matching the
reference. Main retrieval returned 4/6 dataset-marked spans. The complete
journey returned all 6/6 marked spans; 2/6 marked spans were selected and
materially used because the Fitbit and nebulizer facts used alternate direct
user spans. All four smallest decisive device facts were returned, selected,
and materially used.

The new compact interface removed the former five-message character cutoff.
Confirmation returned two disjoint 20-candidate pages with no character
truncation. The first review classified three candidates as material and 17 as
`not_used`; the second classified all 20 as `not_used`. Both searches still
reported a lower-ranked top-K tail from 50 eligible candidates, so the host
correctly kept the answer provisional under the current v6 rule. With its two
confirmation searches spent, the model attempted a one-item stale review
instead of another search; the host rejected it. There were no bridge or
session-read calls and no durable writes. A provider-free exact-action replay
reproduced the failure, used 461 cache hits with zero misses, verified that
confirmation pages did not repeat evidence, and verified the frozen source
database hash byte-for-byte.

Expected fresh spend was `$0.01–$0.03`; measured provider spend was
`$0.01683535` (`$0.01674850` OpenAI and `$0.00008685` embeddings, with no
judge). Because the answer stage failed, conservative accounting retained its
full `$0.70` reservation. The private aggregate ledger is therefore exactly
`$36.51155714`, equal to the approved hard ceiling. No provider process or
further paid call is running. `npm test` remains 85/85 and quickstart remains
6/6.

This distinguishes two kinds of tails. A character-truncated intended page is
incomplete and must continue; an ordinary lower-ranked tail beyond a fully
delivered top-K page does not itself show missing relevant evidence. Treating
both as mandatory exhaustion turns the abstract semantic check into a broad
corpus scan and can reject a correct answer after 40 reviewed candidates. The
next smallest product decision is whether a fully delivered top-K page whose
candidates are all `not_used` may close while character-truncated pages remain
open. Increasing budgets or adding a fixed health schema is not supported by
this evidence.

BRN-0036, independently reviewed and founder-accepted, implements that
distinction as confirmation schema
`palari-answer-confirmation/v7`. The host now reports
`candidatePageComplete` separately from
`lowerRankedCandidatesAvailable`. Character truncation makes the intended
top-20 page incomplete and still forces another duplicate-filtered search. A
fully delivered top-20 page may close after every displayed candidate is
explicitly classified `not_used`, even when lower-ranked retrieval candidates
remain. Any material candidate still forces revision and another search, and
unresolved material evidence still fails closed. Compact exact excerpts,
direct-user-first ordering, full host-side canonical validation, information-
identity duplicate exclusion, the two-search budget, and zero durable writes
are unchanged.

The general provider-free contracts cover both tails: a complete 20-candidate
page closes without scanning its lower-ranked tail, while a character-
truncated page stays open and its next page contains only unseen information.
Focused confirmation tests pass 9/9, `npm test` passes 85/85, quickstart passes
6/6, and the isolated complete legacy suite passes 916 with 15 optional
private-artifact skips. No provider call, private diagnostic mutation, or
benchmark regrade was performed; the private aggregate ledger remains
`$36.51155714`.

The founder-authorized BRN-0037 alpha diagnostic then ran the same frozen
health-device question once, with no retry or tuning, under aggregate cap
`$37.21155714`. It did not complete and the official judge was never called,
so it has no grade and is not a benchmark regrade. The provisional answer
named only two of the reference's four devices: Fitbit Versa 3 and Accu-Chek
Aviva Nano. Main retrieval returned 3/6 dataset-marked spans and selected and
materially used 2/6. At the smaller decisive-fact level, main retrieval found
and used 2/4 device categories.

Confirmation then returned one character-complete page of 20 unique candidates
with 17 direct-user rows, zero evidence overlap with main retrieval, and an
ordinary lower-ranked tail among 50 eligible candidates. Across the complete
journey, retrieval reached 5/6 marked spans and all 4/4 decisive device facts,
including raw user evidence for the missing hearing aids and nebulizer. The
reviewer recognized five rows as material, but emitted only 19 ordered
assessments for the 20 candidates. The host rejected the incomplete review
before binding it, revising the answer, or exercising v7's complete-page
closure rule. Thus this run neither confirms nor refutes that closure change;
it exposes a separate bounded confirmation-interface failure.

There were no `memory_bridge` or `memory_read` calls and no durable writes.
Failure-path frontier output remains unavailable because the answer API threw
before returning its structured result. The source database hash remained
`b1ac32ef9e5ce86cd7509eec1891e0080a80a1b7dc269b2f2c1c0efca3a1f70b`.
Six OpenAI dispatches plus three embedding inputs measured `$0.00853124`
(`$0.00848354` OpenAI and `$0.00004770` Gemini); no judge spend occurred.
Conservative failure accounting retained the full `$0.70` reservation, so the
private ledger is exactly `$37.21155714`, equal to the approved ceiling. A
provider-free replay reproduced the 20-versus-19 rejection with 460 embedding-
cache hits and zero misses. This identity is consumed and must not be rerun.

BRN-0038, independently reviewed and founder-accepted, replaces that fragile
ordered assessment list with confirmation
schema `palari-answer-confirmation/v8`. Every displayed candidate now carries
a short page-local `candidateNumber`. The fresh reviewer returns only material
findings as `{candidateNumber, reason}`; `{findings: []}` means that no
displayed candidate changes the provisional answer. The host maps numbers to
immutable canonical evidence IDs, rejects missing, fractional, out-of-range,
duplicate, stale-review, extra-field, and legacy assessment payloads, and never
asks the model to reproduce opaque IDs.

A valid sparse review still covers the whole displayed page. Listed findings
remain material, force answer revision and another unseen search, and must be
supported in the final commitment. Every unlisted candidate becomes
non-material for that answer journey and cannot recur. Empty findings close
only a character-complete page; character-truncated pages continue, while an
ordinary lower-ranked tail does not prevent closure. Compact exact excerpts,
full host-side canonical validation, direct-user-first ordering, duplicate
information exclusion, bounded work, isolation, and zero durable writes are
unchanged.

Provider-free contracts cover empty findings, reordered sparse findings,
invalid/duplicate numbers, old payload rejection, repeated-review rejection,
material continuation, complete lower-ranked tails, character-truncated
disjoint pages, temporal identity, speaker authority, and bounded failure.
Focused confirmation tests pass 10/10, `npm test` passes 86/86, quickstart
passes 6/6, and the complete legacy suite passes 917 with 15 optional skips
and zero failures across 932 tests. No provider or private artifact was
accessed and the private ledger remains `$37.21155714`.

BRN-0041 simplifies that confirmation design after a live alpha diagnostic
showed the reviewer behaving correctly while the host discarded its progress.
Two consecutive confirmation searches each found material health-device
information. The reviewer revised the answer, but the old special two-search
limit left no clean closure round and converted the latest evidence-backed
commitment into an exception. The mistake was the control policy, not the
reviewer's materiality judgment.

Confirmation schema `palari-answer-confirmation/v9` now treats the reviewer as
one model-owned reasoning loop. It chooses unseen queries, reports sparse
material findings, revises, and continues while work remains. The default is
the existing full four-search retrieval allowance rather than a special limit
of two. The host still binds page-local numbers to immutable evidence IDs,
removes previously returned and duplicate information, requires every
displayed page to be assessed, and validates final raw evidence.

The work bound is now an emergency boundary rather than a semantic workflow.
After the latest displayed page has been assessed and the allowance is spent,
the reviewer may return its newest host-valid evidence commitment. Palari
returns that answer with `status: "bounded_incomplete"`, `complete: false`,
`exhausted: true`, and `closureReason: "emergency_bound"` instead of erasing
the answer. Normal empty-search or no-material-findings closure remains
`closed_no_new_material_information`. Invalid evidence, malformed findings,
and unassessed pages still fail closed. The default OpenAI dispatch guard grew
from 7 to 11 so normal model-directed review has room to search, assess, and
commit; it remains a hard emergency ceiling.

Provider-free tests demonstrate three material rounds followed by a fourth
clean check, emergency best-answer return, and rejection of premature or
forged bounded commitments. Independent review then caught an adapter seam:
after the last search, a premature commit could route into bounded completion
before the latest page was reviewed, and that correct host rejection escaped
instead of returning control to the model. The adapter now feeds that rejection
back so the model can review the pending page, and preserves one ordinary
repair opportunity for a malformed bounded commitment. Real host-plus-OpenAI
contracts cover both paths. Focused confirmation/OpenAI tests pass 41/41,
`npm test` passes 87/87, quickstart passes 6/6, and the complete legacy suite
passes 921 with 15 optional skips and zero failures across 936 tests. No
provider, credential, private evaluation artifact, dataset, or sealed U8 was
accessed for BRN-0041.

A second independent review caught the same responsibility boundary missing
from the thin recommendation commitment. The model could correctly mark newer
confirmation evidence material, then submit a recommendation citing only
older evidence; that early return skipped the ordinary commitment check. The
host now rejects only that contradiction and returns control to the model for
its normal one repair. It still does not decide materiality or recency for the
model. Real host-plus-OpenAI tests cover both normal clean closure and
bounded-incomplete closure: a stale Atlas-only recommendation is rejected and
the model's Nova-backed correction is accepted. Focused confirmation/OpenAI
tests now pass 43/43 and the complete legacy suite passes 923 with 15 optional
skips and zero failures across 938 tests; core and quickstart remain 87/87 and
6/6. This correction was also entirely provider-free.

A third independent review found a custom-provider race at the same emergency
boundary. A provider could launch the last search without awaiting it and ask
for bounded completion while the search counter was exhausted but the new
page had not yet replaced the previously assessed page. The host now tracks
outstanding confirmation searches synchronously, refuses concurrent searches,
and refuses bounded completion until the final search has settled. A real
provider-free regression fills one 20-item page, launches a final search that
returns one genuinely unseen item, and proves commitment stays blocked until
that item is reviewed. Focused tests now pass 44/44, core passes 88/88,
quickstart passes 6/6, and legacy passes 924 with 15 optional skips and zero
failures across 939 tests.

A fourth independent review found no remaining P0 or P1 code issue. It found
two stale public API statements: three references to the former seven-dispatch
ceiling and an incomplete description of recommendation evidence validation.
The API now states the actual eleven-dispatch emergency ceiling and explains
that a non-abstaining recommendation must cite evidence its own confirmation
reviewer marked material. The host still does not decide materiality.

The founder then authorized one fresh no-retry health-device diagnostic on
merged BRN-0041 under aggregate ceiling `$39.31155714`. The first v11
invocation made no provider call and spent nothing: binary floating-point
addition represented the exact `$38.61155714 + $0.70` reservation a few
quadrillionths above the decimal cap, so the alpha runner stopped before the
answer stage. The runner now compares dollar boundaries with a one-billionth
of a dollar tolerance and normalizes persisted arithmetic to twelve decimal
places. A focused exact-boundary CLI contract proves the reservation is
admitted without storing a value above the authorized cap.

The fresh v12 diagnostic then completed `gpt4_31ff4165` once with no retry or
inter-case tuning. Palari answered **4**—Accu-Chek Aviva Nano, Fitbit Versa 3,
nebulizer machine, and Phonak BTE hearing aids—and the official judge returned
`Yes`. All 6/6 dataset-marked spans were consulted. The four smallest decisive
device facts were retrieved, selected, and materially used; one additional
hearing-aid battery span was selected as corroborating but explicitly not used
as another device. This is a successful alpha diagnostic, not a benchmark
regrade.

Confirmation used all four searches and four sparse reviews. Its 71 returned
candidates were 71 unique evidence IDs across disjoint 20/18/14/19 pages; all
four generated queries were distinct, 69 candidates were ignored without
recurrence, and there were zero confirmation budget refusals or durable
writes. Round one found direct current hearing-aid use and changed the answer
to four; round two found corroborating hearing-aid battery evidence; rounds
three and four found nothing material. The final pages were character-
truncated, so Palari correctly did not claim a clean no-new-information round.
BRN-0041 preserved the latest host-valid answer as `bounded_incomplete` with
`closureReason: "emergency_bound"` instead of discarding it. No bridge was
needed, so this case still provides no positive evidence for learned co-use
edges.

Measured fresh spend was `$0.03903765`: `$0.00011505` Gemini embedding,
`$0.03841760` Luna across the main and independent confirmation sessions, and
`$0.00050500` for the official judge. The aggregate ledger closed at
`$38.65059479`, leaving `$0.66096235` below the approved ceiling. The frozen
source database remained exactly
`b1ac32ef9e5ce86cd7509eec1891e0080a80a1b7dc269b2f2c1c0efca3a1f70b`.
After the decimal correction, `npm test` passes 89/89, quickstart passes 6/6,
and the complete legacy suite passes 937 with 3 skips and zero failures across
940 tests.

The founder-authorized non-health hard follow-up then selected the frozen
instrument, Rachel-relocation, and charity-composition cases with no retries,
no inter-case tuning, 5,120 output tokens, and confirmation v9. The first
multi-case process completed the instrument and Rachel attempts, then the host
OOM-killed `t3code.service` during charity. The machine's 6 GB swapfile was
full. The source stores contain only 474--511 canonical rows and about 1.6 MB
each, while the later isolated charity process measured a 4,101,484 KB peak;
the failure was host-wide memory pressure around a heavy local evaluation
stack, not corpus size or a provider-credit failure. With founder approval,
five stale preview servers rooted in deleted worktrees exited cleanly on
`SIGTERM`, freeing about 1.0 GB resident memory and 2.3 GB of swap. No other
process was signalled. Future hard cases on this host should use one fresh
process per case.

The instrument case is unjudged. Three searches led Luna to a substantively
incomplete proposal of Fender Stratocaster, Yamaha FG800, and Korg B1 while
omitting the still-owned Pearl Export drum set. More importantly, the main
answer commitment mistyped the Korg row's opaque evidence ID in both its first
attempt and sole repair, so the host correctly released no answer before
confirmation or judging. The failure artifact has no structured retrieval
transcript, so this attempt's marked-span retrieval coverage is ungraded. This
exposes the same interface defect previously removed from candidate review:
the main commitment still asks the model to reproduce long evidence IDs.

Rachel completed but remained incorrect. All 3/3 dataset-marked spans,
including the later suburbs update, were retrieved; Luna selected and used
only the older Chicago statement. Its independent confirmation inspected one
character-complete page of 20 unique evidence IDs with zero overlap with main
retrieval, marked all 20 non-material, and closed normally. This is not a
fresh-retrieval miss: the decisive correction was already in prior evidence,
and the model failed to resolve that conflict. Main retrieval still had two
calls remaining, with no bridge, stagnation, or budget refusal.

Charity completed correctly in a fresh single-case process after the OOM
interruption. Palari answered **4** and named Dance for a Cause, Walk for
Wildlife, the July 17 charity golf tournament, and Food for Thought. All 6/6
dataset-marked spans were retrieved; 4/6 marked spans were selected, while all
4/4 smallest decisive event facts were retrieved, selected, and materially
used. Confirmation achieved the intended clean stop: one complete page of 20
unique, entirely new evidence IDs, zero material findings, and normal
`no_material_findings` closure without exhausting its allowance. The official
judge returned `Yes`. No hard case used `memory_bridge` or made a durable
write, so this adds no positive evidence for learned co-use edges.

The three-case work is alpha diagnostic evidence, not a benchmark regrade:
two cases completed and reached the judge (one correct, one incorrect), while
the instrument case is an unjudged infrastructure failure. Conservative
accounting retained `$0.70` for the instrument failure and `$0.70` for the
OOM-interrupted charity attempt. The isolated charity completion cost
`$0.02002410`; known measured provider spend across the instrument, Rachel,
and completed charity attempts was `$0.04341935`, while provider spend inside
the abruptly killed attempt is unknown and remains covered by its retained
reservation. The aggregate ledger is `$40.08181199` under the founder's
rounded `$41` ceiling. All three frozen source hashes remain unchanged.
`npm test` passes 89/89 and quickstart passes 6/6. The legacy suite was not
rerun because this diagnostic changed no product behavior or historical
evaluator compatibility.

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

The first genuinely fresh generalization batch then selected the first five
IDs in immutable S60 order with no prior result or failure artifact. Selection
used IDs and artifact metadata only; question text, answers, and supporting
memories were not inspected. Sealed U8 was mechanically excluded. The founder
approved a `$0.50` fresh cap and `$4.00613237` aggregate ceiling. Five new
canonical stores ingested 2,426 raw turns without a failed turn, and all five
questions ran once with zero retries through Gemini retrieval embeddings,
local Ettin, the latest iterative answer path, Luna, and the pinned GPT-4o
judge.

Four cases produced complete answer-and-judge artifacts. Three were judged
correct: the system composed two April event spans into 3 days, composed a
one-hour preparation span with a 30-minute commute into 90 minutes, and
recalled a 16GB RAM upgrade. The Tokyo-advice case was judged incorrect. Both
dataset-marked direct-user preparation rows—Suica and the later Suica-plus-
TripIt statement—were canonical, but neither was returned. Luna made one
search, selected a prior Palari Suica answer plus situational rows, gave generic
transit advice, and never used the available bridge/read path. This is a
retrieval-completeness failure, not an answer-use failure.

The fifth, Miami, returned its one dataset-marked direct hotel-preference row
and generated a useful evidence-linked proposal with an external-verification
caveat, but failed before judging. Its proposal field named the same hotel and
strategy as its prose in different words; the one repair repeated the
paraphrase instead of copying the exact proposal. Combined with the independent
cultural-events failures, this establishes that requiring the model to emit
the same recommendation in both prose and structured fields is an operationally
brittle composition boundary across distinct domains.

The provider-free successor makes the structured recommendation canonical and
has the host append any missing validated proposal, caveat, or clarification
to the bounded final text. The provider no longer has to duplicate exact
strings. Evidence must still be returned and materially used, external
verification still requires an exact caveat, abstention remains explicit, and
current-evidence review still fails closed. Restaurant, multi-surface OpenAI,
and combined current-review controls prove host rendering without spending a
repair on presentation duplication.

The post-run audit classifies success 3, retrieval 1, composition 1, and every
other stage 0. All 8/8 marked spans were canonical; at least 6/8 were returned,
5 were selected, and 5 were materially used. Miami's failed trace provides a
returned lower bound rather than a complete retrieval transcript. No case
called `memory_bridge`, so the batch provides no successful routing lineage or
co-use event.

Fresh measured spend was `$0.39068731`: `$0.36927405` for 48 lazy Gemini
embedding calls over 2,461,827 tokens, `$0.01893326` for Luna answers, and
`$0.00248` for four judges. Lazy index construction occurred during answer
retrieval rather than writer ingest, so the private adapter's `$0.05` answer
reservation was too low. Four complete result artifacts were consequently
reported as runner failures after their provider work completed; the fifth was
the genuine commitment failure. The persistent ledger was conservatively
corrected from the runner's `$3.75613237` to measured `$3.89681968`, still
`$0.10931269` below the approved aggregate cap. Future fresh-store diagnostics
must reserve `$0` for writer and `$0.10` for lazy indexing plus answer and
judge. Historical LongMemEval remains 6/10; this diagnostic does not regrade
it.

The founder then challenged the premise of the recommendation host boundary.
The Miami failure was not bad retrieval or a bad recommendation: deterministic
code was using exact string occurrence as a proxy for semantic agreement
between two model-authored answer surfaces. The active recommendation path is
now deliberately thinner. Luna writes the complete answer once and declares
only the IDs of returned memories that support it. The host verifies shape,
size, uniqueness, and membership in the current scoped answer session, then
derives the evidence excerpts itself. It does not ask Luna to copy quotes,
duplicate proposals, declare verification metadata, or produce prose for an
exact-string check; it never appends or rewrites recommendation text. Semantic
quality and external-current caveats remain model responsibilities measured by
evaluation. `answerRecommendation` remains a null compatibility tombstone.
This provider-free successor was not replayed live. Focused tests pass 63/63,
including drink, exercise, reading, Miami-shaped, invalid-ID, duplicate-ID,
unsupported-answer, abstention, and current-context controls. Quickstart passes
6/6, and the complete legacy tier passes 901 with 3 optional skips.

The fresh Tokyo miss is now reproduced provider-free from an isolated copy of
its saved canonical store. The original failed search had returned a prior
Palari Suica answer with three retrieval calls left. Starting from that exact
anchor, the real answer API used `memory_find` and then
`memory_read(anchor.session)` to recover both dataset-marked direct user rows:
the Suica card the user had just obtained and the later Suica-plus-TripIt
preparation statement. This proves a two-call recovery route within the
existing four-call budget; it does not claim that Luna will follow it live.

The active agent instructions now treat a relevant prior Palari answer as
navigation rather than user evidence. When it appears to expose user-specific
resources, preferences, goals, relationships, or preparations, the agent reads
that exact scoped source session before answering; if the session is
insufficient, it continues through `memory_bridge`. The host does not classify
the prose, expand every Palari answer, or create memory. Provider-free travel,
kitchen, and legal controls recover their direct user source statements, while
an unrelated-session control proves that generic museum advice cannot acquire
a Museum Pass mentioned elsewhere. No provider was called and spend did not
change. Focused tests pass 68/68, quickstart passes 6/6, and the complete
legacy tier passes 906 with 3 optional skips.

The first distinct live relationship case now confirms that Luna follows the
new source-session rule. In fresh photography case `06878be2`, the broad
question did not mention Sony. Its untouched source held 443 canonical raw
messages across 48 sessions and three dataset-marked direct user spans. The
initial `memory_search` returned two marked spans plus a relevant prior Palari
answer; Luna immediately called `memory_read` on that answer's exact source
session and recovered the missing Sony 24–70mm span. All 3/3 marked spans were
returned, selected, and materially used in a Sony A7R IV-specific answer. No
bridge was needed, two retrieval calls remained, the provider-free stage audit
classified success, and the pinned independent judge returned yes. This is a
fresh current-product diagnostic, not a benchmark regrade, and it must not be
replayed merely to tune the successful prompt.

That same run exposed a separate budget-preflight defect. The first semantic
search lazily embedded the previously unindexed 443-message corpus: eight
Gemini calls accounted 495,338 tokens and `$0.07430070`; three Luna dispatches
accounted `$0.00402052`; the judge accounted `$0.00131500`. Total measured
fresh spend was `$0.07963622`, exceeding the approved `$0.05` reservation by
`$0.02963622`. The runner correctly rejected settlement above the declared
reservation and made no retry, but post-call rejection cannot undo provider
spend. The mutable aggregate ledger was therefore corrected upward to
`$3.97645590`. No more provider calls were made. Future fresh-store adapters
must include the worst-case lazy corpus-embedding backfill in their
pre-dispatch reservation or fail provider-free before dispatch.

A five-case fresh memory matrix now broadens that live evidence without tuning
the successful path. Untouched, hash-verified stores covered remote-colleague
personalization (`54026fce`), Rachel's current employer (`5a4f22c0`), relative
meeting order (`gpt4_88806d6e`), the jointly chosen Fissionator name
(`561fabcd`), and a two-session gift total (`a3332713`). All five completed
once with no retries and no paid judge. The provider-free stage audit reports
success 5 and every failure stage 0. All 8/8 dataset-marked spans were returned;
the only unselected marked span was Rachel's older conference context, while
the later TechCorp statement correctly controlled the answer. The smallest
decisive sets were 7/7 returned, selected, and materially used, and all five
answers matched their references. Fissionator used one relevant scoped
`memory_read`; the other four cases needed one search, and no case used
`memory_bridge`.

The new per-provider-call guard kept every case inside its `$0.14` reservation.
Fresh measured spend was `$0.37911228` against a `$0.70` cap, bringing the
aggregate ledger to `$4.35556818`. Forty-five Gemini calls embedded 2,461,582
tokens for `$0.36923730`; sixteen Luna dispatches cost `$0.00987498`.
All five pristine source hashes remained unchanged. This matrix is diagnostic,
not a benchmark regrade. It supports the current hybrid retrieval and scoped
session-read design, but because no bridge was needed it supplies no evidence
yet for learned co-use edges.

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

Do not retry the interrupted hard cases merely to test quote plumbing. The new
host-owned evidence boundary is proven provider-free; remaining ownership,
airline, and other misses should be treated as semantic selection or reasoning
work unless new evidence shows otherwise. Any live continuation needs its own
explicit founder-approved aggregate cap and process plan. Run future hard cases
as separate processes on this host so native reranker memory is reclaimed at
each case boundary.

The four interrupted cases have now received one clean continuation under the
bounded reranker, and the airline provider failure received one separately
authorized fresh attempt. All four questions now have completed answers. Do
not replay them. Keep the cautious furniture answer as product-semantic
ambiguity rather than changing the prompt to match the fixed reference. Do not
reuse or reinterpret an old `inflight` artifact.

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
successor produced useful content on its original failure, and the fresh Miami
case confirmed that dual prose/structure generation is brittle. The active
path now removes the second recommendation surface entirely; the host retains
only scoped returned-ID provenance checks. Do not replay either recommendation
case. The fresh Tokyo store proves provider-free that a returned prior Palari
answer can route through its exact source session, and the distinct live
photography case confirms that Luna follows that route and uses evidence it
adds. The five-case fresh matrix then passed personalization, update, temporal,
prior-conversation, and multi-session composition cases without a product
change. Do not replay these successes merely to tune their prompts. The next
useful cases should be genuinely alias- or multi-hop-shaped cases where the
first search does not already return every decisive span, selected
provider-free before requesting a new cap. Continue bounding the one-time
embedding backfill and every provider call before dispatch.
Make no provider call without a new explicit founder-approved cap. Continue
collecting distinct real relationship cases, recording bridge use, candidate
rank,
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
   evidence failure is corrected live. A subsequent five-case fresh matrix
   passed personalization, knowledge update, temporal reasoning, prior-dialogue
   recall, and multi-session composition with 7/7 decisive-span use. This is
   broader diagnostic evidence, not a release benchmark or a reliability
   guarantee.
3. Existing framework: the survey found useful patterns, but adding a full
   framework would add more surface than Palari needs.
4. Founder request: yes, simplify the overbuilt prototype workflow.
5. If removed: question 19 regresses to generic recommendations, and a model
   can again hide canonical memories by inventing retrieval time bounds.
