# Palari Brain

The governed memory kernel of Palari, extracted as a standalone,
testable system — with one public objective:

> **Score governed memory on LongMemEval, honestly, and extend the
> benchmark with the safety section it lacks.**

Status: seed stage. An autonomous agent works this repo unit by unit
(see `AGENTS.md` and `STATUS.md`). Nothing here is published as a
result until the founder gates it.

## What "governed memory" means

Most agent-memory frameworks auto-retain every exchange and invisibly
inject recall. Palari's kernel deliberately does not:

- **One gate.** Every durable memory write is a typed proposal through
  an admission gate with evidence thresholds. Producers propose;
  nothing writes directly.
- **Provenance.** Every memory knows where it came from (pipeline,
  source, confidence-at-creation). Source-derived text cannot silently
  become user memory — that boundary is tested, not promised.
- **Visibility & consent.** Memory is a per-workspace SQLite file the
  user can inspect, correct, and delete. Deletion removes FTS and link
  residue. The user owns the diary.
- **Honest absence.** "I don't have a memory of that" is a scored,
  first-class answer.

The bet this repo exists to measure: governance costs some raw recall
and wins on knowledge-updates, abstention, and injection resistance.
LongMemEval scores the first three. Nobody scores the fourth — so we
will write that section and contribute it.

## The wider Palari system

| Piece | Repo | Role |
|---|---|---|
| Product (Sofia) | [palari-v05](https://github.com/CoyStan/palari-v05) | The living app this kernel is extracted from |
| Control plane | [palari-company-os](https://github.com/CoyStan/palari-company-os) | Write boundaries + proof-carrying acceptance for AI work |
| Specification | [The Palari Brain — Unified Specification](https://github.com/CoyStan/palari-v05/tree/claude/palari-brain-adoption-staging/docs/spec-palari-brain) | The book this repo implements (Parts 4–5 are the kernel's normative spec) |
| This repo | palari-brain | Memory kernel + LongMemEval adapter + results |

## Layout (target)

```
kernel/     the extracted memory system (store, gate, extract, recall, brief)
adapter/    LongMemEval harness: their histories in, kernel answers out
evals/      slices, run reports, pre-registered predictions
docs/       kernel contract, references, decisions
data/       (gitignored) benchmark datasets — never committed
```

## Ground rules

Results are reported failing-categories-first. Predictions are written
before runs. Scores are never published without founder acceptance.
See `AGENTS.md` for the full working charter.
