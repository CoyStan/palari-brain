# U8 prep — first live slice (FOUNDER GATE)

Prepared 2026-07-18 by Fable 5. At preparation time everything below
was built and tested spend-free; execution amendments are recorded
before the original decision sheet. The gate is mechanical: the runner
refuses without `PALARI_CONFIRM_SPEND=1`, a provider key, and a
finalized predictions file.

## What is prepared

- `scripts/run-live-slice.mjs` — three modes:
  - `--plan` (spend-free): pins the deterministic 10-question slice
    (stratified across the 6 types, ≥1 abstention), dataset sha256,
    prompt-config hash, per-question counts, cost table.
  - `--dry` (spend-free): full plumbing pass over the real slice with
    the deterministic mock extractor + stub provider.
  - `--live`: the actual run. Hard-refuses unless the founder sets
    `PALARI_CONFIRM_SPEND=1` + `GEMINI_API_KEY` (or Anthropic once a
    translated runner exists) AND `evals/predictions.md` contains
    "PREDICTIONS FINAL". Results land in `evals/results/`
    (gitignored — they contain dataset-derived text) with provenance:
    dataset sha256, model, prompt-config hash, date.
- `src/slice.mjs` — selection/estimation/guard logic, contract-tested
  (current suite 47/47).
- `evals/predictions.md` — FINAL pre-registration, categories ordered
  failing-first, written before any scoring call.

## Pre-score execution amendments

- Founder GO was recorded for the original 2.5 Flash-Lite plan.
- The first invocation used legacy query-parameter authentication and
  failed before scoring; no result file was produced. Current transport
  uses `x-goog-api-key`, retries transport failures only, and checkpoints
  completed questions to prevent re-rolls.
- With authentication corrected, Gemini returned `404 NOT_FOUND` because
  2.5 Flash-Lite is unavailable to this new API user. On 2026-07-18,
  before any benchmark score, Quetzali selected the documented stable
  successor `gemini-3.1-flash-lite` and authorized a $1.25 cap. Current
  paid-tier estimate for the sealed slice is ~$1.06. Dataset, slice,
  prompt hash, and outcome predictions are unchanged.

## Original founder decision sheet (historical)

1. **Dataset variant.** Recommend `longmemeval_s_cleaned.json` (the
   standard setting; the honest test). The oracle file is cheaper but
   evidence-only — fine for debugging, not for claims.
2. **Model.** Recommend `gemini-2.5-flash-lite` for the first slice:
   cheapest, and the baseline extraction request format is
   Gemini-native (zero translation risk). Anthropic requires a
   request translation I have deliberately not improvised — say the
   word and it becomes a unit.
3. **Spend cap.** Estimate for the full 10-question S-slice, both
   ingest and answering (documented ~115k history tokens/question,
   ~250–400 extraction calls/question):
   | model | est. cost |
   |---|---|
   | gemini-2.5-flash-lite | **< $1** |
   | gemini-2.5-flash | ~$2 |
   | claude-haiku-4-5 | ~$4.50 |
   These are from documented dataset statistics; `--plan` recomputes
   from the real slice before any spend. Prices entered 2026-07-18 —
   re-verify at spend time.
4. **GO/NO-GO.** On GO: download the dataset (MIT — verdict in
   DECISIONS.md) into `data/`, run `--plan`, pin slice ids into
   predictions.md, mark it FINAL, then run `--live`.

## Execution transcript for the founder

```bash
# 1. fetch dataset (never enters git)
#    from https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned
#    -> data/longmemeval_s_cleaned.json

node scripts/run-live-slice.mjs --plan     # spend-free, pins everything
node scripts/run-live-slice.mjs --dry      # spend-free plumbing check
# finalize evals/predictions.md (slice ids + "PREDICTIONS FINAL")
PALARI_CONFIRM_SPEND=1 GEMINI_API_KEY=... \
  node scripts/run-live-slice.mjs --live --model gemini-3.1-flash-lite
```

## Known limitations, stated up front

- The Anthropic provider path is unimplemented by design (format
  translation is a decision, not a default).
- Slice grading is manual per-question (protocol in predictions.md);
  the official judge pipeline is adopted at U10.
- The U7 finding stands: the baseline write boundary is conservative
  (assertive-evidence grammar). The slice will measure it; nothing
  has been patched to look better.
