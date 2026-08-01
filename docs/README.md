# docs/ — what is current and what is a record

Half of this directory is documentation of the active system; the other
half is sealed records of how it got here — design eras, executed
contracts, and provenance for paid, unrepeatable evaluation runs. Records
are load-bearing evidence: fix a factual error by all means, but do not
rewrite what they claimed at the time, and never move or rename anything a
sealed run identity pins.

## Active — describes the system as it is today

| Document | What it covers |
| --- | --- |
| [BRAIN-API.md](BRAIN-API.md) | The complete active contract: canonical journal, reducer/digest, retrieval-to-answer, forgetting. Start here. |
| [CONSUMER-SEAM.md](CONSUMER-SEAM.md) | The supported application boundary: stable imports, versioning promise, shared-scope `authorId` attribution, SQLite concurrency, migration discipline. |
| [TICKET-WORKFLOW.md](TICKET-WORKFLOW.md) | The governed workflow for founder-requested, multi-session, reviewed, or R2-R4 work. |
| [DECISIONS.md](DECISIONS.md) | Append-only founder decision and license ledger, newest first. |

Also active, outside this directory: the root `README.md` (orientation),
`AGENTS.md` (agent charter), `STATUS.md` (the loop ledger),
`PROMPT.md` (standing-agent bootstrap), and `evals/README.md` (measurement
map).

## Historical — sealed records, each carrying its own banner

Extraction and kernel era (July 2026; the extracted v0.5 kernel is now the
historical comparator):

- [SOURCE-MAP.md](SOURCE-MAP.md) — where every extracted file came from in
  palari-v05; still authoritative as provenance.
- [KERNEL-API.md](KERNEL-API.md), [KERNEL-CONTRACT.md](KERNEL-CONTRACT.md)
  — the kernel design and its distilled normative contract.
- [REFERENCES.md](REFERENCES.md) — the reading list behind that design.
- [ADVERSARIAL-REVIEW.md](ADVERSARIAL-REVIEW.md) — the pre-registered case
  against the kernel.
- [RESTRUCTURE-PROPOSAL.md](RESTRUCTURE-PROPOSAL.md) — a five-layer
  competitiveness plan that was never ratified.
- [PALARI-V2-ARCHITECTURE.md](PALARI-V2-ARCHITECTURE.md) — the archived v2
  north star (machinery archived at the `v2-proof-archive` tag).

Evaluation eras (J3 bake-off, then J4 LongMemEval; identities under
`evals/live-runs/` are sealed):

- [JOURNEY-BANK.md](JOURNEY-BANK.md) — schema and pins for the offline
  journey bank the comparator arms run against.
- [BAKEOFF-J3-PREP.md](BAKEOFF-J3-PREP.md),
  [BAKEOFF-J3-HEALING.md](BAKEOFF-J3-HEALING.md) — the J3 live series,
  prepared, run, repaired, and closed.
- [LONGMEMEVAL-J4-PREP.md](LONGMEMEVAL-J4-PREP.md) — the J4 S-60 protocol
  and cost provenance.
- [J4-SIMPLE-HARNESS.md](J4-SIMPLE-HARNESS.md),
  [J4-INCREMENTAL-HARNESS-AUDIT.md](J4-INCREMENTAL-HARNESS-AUDIT.md),
  [J4-INCREMENTAL-HARD-CAP-CONTRACT.md](J4-INCREMENTAL-HARD-CAP-CONTRACT.md)
  — successor harness design, the audit of the failed first incremental
  harness, and the spend-reservation contract that replaced it.
- [U8-PREP.md](U8-PREP.md) — the sealed U8 live slice runbook.

Root-level records: `WE-MESSED-UP.md` (the postmortem that redirected the
project), `TRIM-CONTRACT.md` and `BAKEOFF-CONTRACT.md` (executed one-shot
contracts).

`STATUS.md` is always the authority on which gates are open, consumed, or
sealed; no historical document re-opens one.
