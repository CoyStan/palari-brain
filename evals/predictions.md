# Pre-registered predictions — U8 first live slice

Status: **PREDICTIONS FINAL** — pinned 2026-07-18 after founder GO
(Quetzali, in session: "use MIT, i agree with the rest"; spend
authorization recorded in docs/DECISIONS.md). The category
predictions below are verbatim from the pre-GO draft — written before
any live call, unchanged at finalization. No re-rolls: a bad number
is a finding, not a retry. Results are graded against this file,
failing categories first.

Drafted 2026-07-18 by Fable 5, BEFORE any scoring run, from dry-mode
evidence only (U7 tests; no live calls have occurred).

## Slice

- Dataset: longmemeval_s_cleaned.json, sha256:
  `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`
- Slice ids (10): 001be529, 00ca467f, 0100672e, 01493427, 031748ae,
  031748ae_abs, 06878be2, 08f4fc43, 0e5e2d1a, 1568498a
  (types: 1 single-session-user, 2 multi-session, 2 knowledge-update
  + 1 knowledge-update abstention, 1 single-session-preference,
  1 temporal-reasoning, 2 single-session-assistant; 480 sessions,
  2402 user turns, ~4.93M history chars)
- Model: gemini-2.5-flash-lite (founder-approved; est. ~$0.35)
- Prompt-config hash: `7fea1393c11b1f47`
- Dry-run plumbing check passed 2026-07-18 (zero spend): ingest
  through the gate 2-11 mock memories/question, no failures.

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
