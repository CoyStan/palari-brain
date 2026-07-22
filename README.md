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

- **One gate (governing law; bounded M2 falsifier complete).** Every durable
  memory mutation must arrive as a typed proposal through Admit → Resolve
  → Apply; a direct durable write is a defect, never an exception.
  V2-M2 leaves no supported in-file production bypass: one exact trusted,
  ratified, private zero-link erasure co-commits its governed journal and CDX
  atom/FTS projection, while candidate creation/supersession, links, lifecycle,
  topic-forget, recall telemetry, extraction/summary/scheduler writes, and
  whole-store deletion deterministically refuse. V2-M3 restores governed
  candidate operations and receipts. CDX-M1 remains runtime/read authority;
  this is not a bundle cutover.
- **Provenance.** Every memory knows where it came from (pipeline,
  source, confidence-at-creation). Source-derived text cannot silently
  become user memory — that boundary is tested, not promised.
- **Visibility & consent.** Memory is a per-workspace SQLite file the user can
  inspect. The currently enabled governed deletion is deliberately narrow: an
  authorized private zero-link erasure removes the atom and its FTS membership;
  linked, shared, general, cross-scope, topic, and whole-store deletion refuse
  until their own authority and receipt substrates exist.
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

## The v2.0 architecture

The north-star design — memory engines as swappable, certified
commodities under a governed journal — lives in
[docs/PALARI-V2-ARCHITECTURE.md](docs/PALARI-V2-ARCHITECTURE.md).
It guides all future units here.

## Ground rules

Results are reported failing-categories-first. Predictions are written
before runs. Scores are never published without founder acceptance.
See `AGENTS.md` for the full working charter.
