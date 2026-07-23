# Palari Brain

A governed memory kernel for chat assistants, in one SQLite file per
workspace: one admission gate for every durable write, provenance on
every atom, supersession that keeps history, deletion that removes FTS
and link residue, honest absence, and a write boundary that external
documents cannot cross.

Extracted from the running palari-v05 assistant (baseline `190a4ad2`)
and kept deliberately small: zero dependencies, Node >= 22.5
(node:sqlite), roughly three thousand lines of source, one test
command.

## Quickstart

```bash
npm test              # 54 contract tests, offline, zero dependencies
npm run quickstart    # the whole product loop in one script, offline
```

The quickstart demonstrates, deterministically and with no API key:

1. **remember** — a stated preference enters through the gate;
2. **recall** — a later conversation gets a provenance-carrying
   briefing;
3. **correct** — supersession closes the old value and links it; the
   history survives in the file;
4. **forget** — topic deletion removes matching rows and their FTS and
   link residue;
5. **honest absence** — the same question now abstains instead of
   guessing;
6. **injection boundary** — a poisoned document cannot mint memory,
   while the same fact asserted by the user can.

## Comparing memory engines

The journey bank runs 17 offline user-memory scenarios as 44 graded
checks across every arm. Each arm receives the same scripted writes,
questions, scopes, and expected outcomes so its failures stay directly
comparable.

```bash
npm run bakeoff
```

The current reference kernel passes 42/44; its known findings are
`correction-espresso-04:p2` (superseded history is unavailable to
as-of recall) and `conflict-cities-05:p2` (uncued reassertions leave
both conflicting facts current). The deployed v0.5 parity arm — routed
through the same extraction pass production runs — TIES the kernel at
42/44 with the same two findings: on dry behavior probes, the deployed
memory is already this good, because the injection boundary and
supersession live in the extraction pass both share. What the kernel
adds is not visible to these probes: the typed admission gate (closing
the raw-door writer class), evidence-time provenance, and briefing v1
attribution. The deliberately ungoverned baseline passes 33/44 —
that 9-probe gap is what the shared boundary is worth. See [the
J1.2 authoring guide](docs/JOURNEY-BANK.md) for the fixture and scoring
rules, and [the J3 preparation
runbook](docs/BAKEOFF-J3-PREP.md) for the founder-gated live comparison.

## Using it in an assistant

```js
import {
  createKernelStore, createGatedStore,
  ingestChatTurn, answerQuestion, stubProvider,
} from 'palari-brain'

const store = await createKernelStore({
  memoryEnabled: true,
  statePath: '/path/to/workspace-state.json',
  workspaceId: 'my-workspace',
})
const gated = createGatedStore(store)

await ingestChatTurn(gated, {
  userMessage, assistantMessage, eventAt,
  palariId, userId, sourceMessageId,
}, { extractor, extractorId })

const { answer, abstained } = await answerQuestion(gated, {
  provider, question, palariId, userId,
})
```

`extractor` and `provider` are injected async functions: plug a
language model in production, or the deterministic stubs
(`deterministicMockMemoryExtraction`, `stubProvider`) for offline use.
The kernel itself never reads an API key.

## What "governed memory" means

Most agent-memory frameworks auto-retain what a model extracts and
invisibly inject recall. This kernel deliberately does not:

- **One gate.** Every durable memory write is a typed proposal through
  an admission gate with evidence thresholds. Producers propose;
  nothing writes directly.
- **Provenance.** Every memory records where it came from (writer,
  source kind, extractor, evidence time, confidence-at-creation).
  Source-derived text cannot silently become user memory — that
  boundary is tested, not promised.
- **Visibility and consent.** Memory is a per-workspace SQLite file
  the user can inspect, correct, and delete. Deletion removes FTS and
  link residue. The user owns the diary.
- **Honest absence.** "I have no stored memory of that" is a
  first-class, scored answer — never papered over.

## Status and history

- Direction: product-led. The journey bank of concrete assistant-memory
  scenarios and the measured dry comparison against local controls are
  complete. The next decision is the
  J3 founder gate for a bounded live comparison with an established
  memory framework. See `STATUS.md`.
- The 2026-07 v2 proof machinery (governed bundle substrate, atomic
  decision journal, authority core) is preserved at the git tag
  `v2-proof-archive` and is not part of the working tree. The candid
  postmortem of that phase is `WE-MESSED-UP.md`.
- The U8 live evaluation slice is SEALED (see `STATUS.md`); no scores
  are published here.
- Reference docs: `docs/KERNEL-API.md` (design + surface),
  `docs/KERNEL-CONTRACT.md` (distilled contract),
  `docs/JOURNEY-BANK.md` (fixtures + scoring),
  `docs/BAKEOFF-J3-PREP.md` (founder-gated live runbook),
  `docs/SOURCE-MAP.md` (provenance from palari-v05),
  `docs/DECISIONS.md` (append-only decision log).

License: MIT.
