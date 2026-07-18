# Pre-registered predictions — U8 first live slice

Status: **DRAFT** — becomes FINAL only when (a) the slice ids are
pinned from `scripts/run-live-slice.mjs --plan` output and (b) the
founder approves spend. The live runner refuses to execute until this
file contains the literal line "PREDICTIONS FINAL". No re-rolls: a
bad number is a finding, not a retry. Results are graded against this
file, failing categories first.

Drafted 2026-07-18 by Fable 5, BEFORE any scoring run, from dry-mode
evidence only (U7 tests; no live calls have occurred).

## Slice

- Dataset: longmemeval_s_cleaned.json, sha256: `<pin from --plan>`
- Slice ids (10): `<pin from --plan>`
- Model: `<founder picks — see docs/U8-PREP.md>`
- Prompt-config hash: `<pin from --plan>`

## Category predictions (accuracy on slice questions of that type)

Ordered by predicted weakness — this is also the reporting order.

1. **single-session-assistant — predicted 0–30% (weakest).**
   Why: the baseline write boundary demands direct user evidence
   (assertive first-person grammar) or an external source kind;
   assistant-asserted facts are neither, so most never mint. U7
   surfaced this mechanically. If this category scores 0, that is the
   headline finding, reported first.
2. **single-session-user / single-session-preference — predicted
   40–60%.** Why: casual, non-assertive phrasings ("my favorite
   is...", "I just moved...") are dropped by the boundary grammar;
   assertive ones land. Coverage, not recall, is the bottleneck.
3. **multi-session — predicted 30–60%.** Why: requires several
   assertive facts to all survive ingest; misses compound.
4. **temporal-reasoning — predicted 30–60%.** Why: eventAt discipline
   means briefing v1 lines carry true event dates (not ingest time),
   which should help relative-order questions; but date arithmetic in
   a small answer model is its own failure source.
5. **knowledge-update — predicted 50–75%.** Why: supersession through
   the gate demonstrably works (U7 e2e); prediction discounts only
   ingest coverage of both the old and new value.
6. **abstention (_abs ids) — predicted 80–100% (strongest).** Why:
   empty recall produces an explicit absence briefing and the answer
   abstains plainly; the kernel never invents. In OUR report,
   abstention-with-correct-grounds counts as success even where the
   benchmark scores it neutral.

## Cross-cutting predictions

- **Ingest coverage:** under 50% of humanly-memorable facts in the
  haystacks will mint memories (conservative boundary + dedup). We
  will report minted-per-question counts alongside accuracy.
- **Needle survival:** ≥90% of briefed memories survive verbatim into
  the final prompt (measured by briefingDiagnostics, not presumed).
- **No invention:** zero answers assert a memory with no stored row
  behind it (C16; grep-checkable against the store).

## Grading protocol

Per-question: correct / incorrect / abstained-correctly /
abstained-wrongly, judged against `answer` (and `_abs` semantics for
abstention ids). Report format: failing categories first, then
aggregate, then the honesty metrics. The official LongMemEval judge
protocol is adopted wholesale only at U10; the slice uses manual
grading recorded per question.

<!-- When finalizing: replace DRAFT above, pin the slice, and add the
     line: PREDICTIONS FINAL -->
