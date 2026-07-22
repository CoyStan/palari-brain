# Palari Brain

> **Direction review, July 22, 2026:** We overbuilt this project relative to
> the original goal of giving a chatbot better memory. Read the candid
> postmortem: **[We Messed This Up Big](WE-MESSED-UP.md)**.

The governed memory kernel of Palari was extracted as a standalone, testable
system. The repository was created with one public objective:

> **Score governed memory on LongMemEval, honestly, and extend the
> benchmark with the safety section it lacks.**

Status: founder direction review. Autonomous implementation is paused at a
coherent cut point while the project is compared with the original product
goal (see `WE-MESSED-UP.md` and `STATUS.md`). Nothing here is published as a
result until the founder gates it.

## What "governed memory" means

Some simple agent-memory integrations automatically retain exchanges and
inject recalled text. Palari's kernel deliberately takes a stricter approach:

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

The original research bet was that governance costs some raw recall and wins
on knowledge-updates, abstention, and injection resistance. LongMemEval scores
the first three; the proposed extension would score the fourth. The current
direction review asks whether pursuing that research bet serves the original
assistant product goal. No extension work is authorized while that gate is
open.

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

The v2 design — memory engines as swappable, certified commodities under a
governed journal — remains documented in
[docs/PALARI-V2-ARCHITECTURE.md](docs/PALARI-V2-ARCHITECTURE.md).
It does not authorize further implementation while the founder direction gate
in `STATUS.md` is unresolved.

## Ground rules

Results are reported failing-categories-first. Predictions are written
before runs. Scores are never published without founder acceptance.
See `AGENTS.md` for the full working charter.
