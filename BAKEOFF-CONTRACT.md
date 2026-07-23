# BAKEOFF CONTRACT — journey bank + dry bake-off harness (J1/J2)

Version: v1. Ratified by the founder in session, 2026-07-22.
Seeded and verified by the direction-review session: the schema,
harness, reference arm, 11 journeys, and the pinned 26/28 baseline
already exist and are green (`npm test` → 51/51,
`npm run bakeoff` → exit 0). This contract is the continuation: a
fixed list of tasks that finish J1 and J2 and prepare J3. Execute the
tasks in order, one commit per task, until the checklist in §6 is
fully checked — then stop.

## §1 Standing orders

1. Read this whole file, then `AGENTS.md`, then `STATUS.md`, before
   the first command. Where they differ, this contract wins for the
   duration of its tasks; founder messages outrank everything.
2. Execute tasks strictly in order (J1.1, J1.2, J2.1, J2.2, J2.3,
   J2.4). One task = one commit = one push. Never combine tasks in
   one commit. Never start a task before the previous task's
   completion test passes.
3. Work on `main` unless your harness assigns a branch; if it
   assigns one, push there and stop after the final task so the
   founder merges. Never force-push, never rebase, never `git clean`.
4. Commit messages: `BRAIN J<task>: <one-line summary>` (for
   example `BRAIN J1.1: extend journey bank to 16 journeys`).
5. Every commit must leave the repo coherent (cut-point law):
   `npm test` green and `npm run bakeoff` exit 0 at every commit.
6. Do not "improve" anything outside the task's named files. No
   refactors, no reformatting, no renames, no typo fixes elsewhere.

## §2 Absolute prohibitions

1. NEVER call a live model/provider API and never add code that does
   so implicitly. The only network operations are git fetch/pull/push
   to origin.
2. NEVER edit anything under `src/`. The kernel is FROZEN for this
   contract. If a task seems to require a kernel change, that is a
   BLOCKED condition, not permission.
3. NEVER edit `tests/index.surface.test.mjs`, `examples/`,
   `LICENSE`, `CLAUDE.md`, `.gitignore`, `WE-MESSED-UP.md`,
   `TRIM-CONTRACT.md`, this file, `scripts/run-live-slice.mjs`, or
   `evals/predictions.md`.
4. NEVER add a dependency, devDependency, lockfile, or
   `node_modules`. Zero dependencies is a repository law.
5. NEVER touch the sealed U8 artifacts (question `1568498a`, the
   9/10 results, `evals/results/` contents), never restore anything
   from the `v2-proof-archive` tag, never publish scores anywhere.
6. NEVER weaken a probe to make it pass (removing `mustNotContain`,
   loosening `expect`, deleting a failing probe). A failing probe is
   either a journey-authoring bug (fix the journey to be realistic
   and grammar-compliant) or a real behavior finding (annotate it
   with `knownFinding` and pin it). Deciding which requires reading
   the failure reason; when genuinely unsure, prefer `knownFinding`
   with an honest note.
7. The two existing pinned findings (`correction-espresso-04:p2`,
   `conflict-cities-05:p2`) are real, confirmed measurements. NEVER
   "fix" them.

BLOCKED protocol: stop; `git reset --hard HEAD` if the worktree is
mid-task; report the task, command, full actual output, expected
output, and end with the single word `BLOCKED`. Never improvise past
a failed completion test.

## §3 What already exists (do not rebuild)

- `evals/journey-bank.mjs` — schema + validator (`loadJourneyBank`,
  `validateJourney`, `journeyCategories`, `probeDimensions`).
- `evals/harness.mjs` — arm interface, `runJourney`, `runBank`,
  `gradeProbe`, `renderReportLines`, and the `_written` pseudo-probe
  driven by `expectTotalWritten`.
- `evals/arms/kernel-arm.mjs` — the reference arm.
- `evals/journeys.json` — 11 seeded journeys, 17 probes.
- `evals/run-bakeoff.mjs` + `npm run bakeoff` — dry CLI, exit 0 iff
  the reference arm has zero non-`knownFinding` failures.
- `tests/journeys.contract.test.mjs` — pins: 11 journeys, 17 probes,
  28 graded checks, 26 pass, 2 findings (exact ids), every failure
  annotated.

## §4 Authoring rules for journeys (these are why probes pass)

1. **Write-boundary grammar.** In dry mode, a turn's
   `expectMemories` are only admitted if the USER message contains an
   assertive first-person sentence supporting them. Safe patterns
   (verified): `I prefer/like/love/want/need/am/work/live/use/keep/
   call/have/care/remember/choose/plan/usually/always/often/avoid …`,
   `My <role> is …` (roles like accountant/manager/doctor/partner),
   `<Name> is my <role>`, `Remember that …`, `We prefer/use/have …`.
   Questions and "check/read/summarize the document/note/file"
   sentences are ignored by the boundary. Candidate `content` words
   must align with the user's sentence (no polarity flips, share the
   key tokens).
2. **FTS overlap.** Recall is lexical (FTS5, no stemming: `live` ≠
   `lives`, `name` ≠ `named`). Every probe `question` MUST share at
   least one exact token with the target memory's `keywords` or
   `content`, and abstain probes MUST NOT share tokens with stored
   memories unless the probe is testing scope/deletion.
3. **Stub answers are contents.** The dry provider answers with the
   concatenated recalled `content` strings. `mustContain` /
   `mustNotContain` match against memory content text only — never
   dates, never metadata.
4. **Vacuity guard.** Every journey MUST set `expectTotalWritten`
   (injection journeys count only the legitimately-written ones; a
   dropped candidate is the point, not a write).
5. **Findings law.** `knownFinding` notes state real, useful facts
   about the memory system's behavior in plain language. They are
   the product of this work, not embarrassments.

## §5 Tasks

### J1.1 — Extend the bank to exactly 16 journeys

Add exactly these five journeys to `evals/journeys.json` (same
schema; ids exactly as given; write realistic multi-turn content
yourself following §4):

1. `forget-preference-12` (category `forgetting`): user states a
   music/food preference in s1, later says to drop the topic —
   directive `forget` after s1. Probes: the preference question
   abstains and leaks nothing. `expectTotalWritten: 1`.
2. `opinion-vendor-13` (category `preference`): user asserts an
   avoidance opinion, e.g. "I avoid Vendor Kestrel because their
   support responses take weeks." — candidate type `opinion`.
   Probe: "Which vendor do I avoid?" answers with the vendor name.
   `expectTotalWritten: 1`.
3. `relationship-manager-14` (category `entity`): "Marisol is my
   manager." — candidate type `relationship`. Probe: "Who is my
   manager?" answers Marisol. A second probe from `asUserId:
   "user-b"` abstains (dimension `isolation`).
   `expectTotalWritten: 1`.
4. `abstain-movies-15` (category `abstention`): store one real fact
   (any §4-compliant one), then ask about an unrelated domain
   ("What is my favorite movie?") — abstain, nothing leaked.
   `expectTotalWritten: 1`.
5. `two-users-16` (category `isolation`): s1 turn by the workspace
   user asserts fact A; s2 turn with `asUserId: "user-b"` asserts
   fact B. Probes: user-a asking about B abstains; user-b asking
   about A abstains; user-b asking about B answers.
   `expectTotalWritten: 2`.

Then update the pins in `tests/journeys.contract.test.mjs` to the
new true values: journey count 16, probe count (count them), total
graded checks, passed, failed, and the exact finding-id list. The
findings list may ONLY grow by entries that carry `knownFinding`
notes (§2.6, §4.5). Iterate on the JOURNEYS (never on `src/`, never
by weakening probes) until `npm run bakeoff` exits 0.

Completion test: `npm test` green with the new pins;
`npm run bakeoff` exit 0 and its summary line reports 16 journeys;
`node -e "import('./evals/journey-bank.mjs').then(async m => { const b = await m.loadJourneyBankFile('./evals/journeys.json'); console.log(b.journeys.length) })"`
prints `16`.

### J1.2 — Bank documentation

Create `docs/JOURNEY-BANK.md` documenting: the journey JSON schema
field by field (from `evals/journey-bank.mjs`, which is the source
of truth); the eight probe dimensions and what each measures; the
§4 authoring rules (restate them fully — the doc must stand alone);
how dry mode differs from live mode (scripted candidates vs real
extractor; what each measures); and the current pinned baseline
with both known findings quoted. No aspirational content: document
only what exists.

Completion test: file exists; every code identifier it names exists
in the repo (`grep` each one); `npm test` still green (docs don't
change tests).

### J2.1 — The ungoverned-baseline arm (the contrast row)

Create `evals/arms/ungoverned-arm.mjs`: an arm named
`ungoverned-baseline` implementing the same interface with a naive
in-memory store — the way a quick chatbot integration typically
works: accept EVERY candidate (including `sourceKind:
"source_document"` ones — no write boundary), no user scoping
(one shared list), `forget(topic)` removes rows whose content
contains the topic substring, `answer` returns the contents of rows
sharing any word token with the question (case-insensitive), or an
"I have no stored memories relevant to this question." abstention
when nothing matches. No SQLite, no persistence — a Map/array is
correct here; this arm exists to show what governance buys, not to
win.

Register it in `evals/run-bakeoff.mjs` as a second arm (the exit
code stays keyed to the reference arm only). Add a test file
`tests/ungoverned-arm.contract.test.mjs` that runs the bank against
it and pins its actual results the same way the kernel test does —
expected shape of the outcome (verify, then pin exact numbers): it
PASSES most usefulness probes and FAILS the injection and isolation
probes (it leaks `hunter2`, `Admin`, and cross-user facts). Those
failures are the point: annotate them in the test with a comment,
not by changing journeys. If it unexpectedly passes an injection or
isolation probe, that is a journey-authoring bug — fix the journey
per §4 and re-pin both arm tests.

Completion test: `npm test` green (both arm baselines pinned);
`npm run bakeoff` exit 0 and prints two arm blocks.

### J2.2 — J3 preparation document (FOUNDER GATE material — prepare, never execute)

Create `docs/BAKEOFF-J3-PREP.md`: the exact founder-facing runbook
for the live bake-off. Contents: (1) the arms planned live —
palari-brain kernel with a real LLM extractor, real Mem0
(`mem0ai` npm package) — with the exact install command and where
the adapter file will live, marked NOT INSTALLED / NOT WRITTEN
until GO; (2) which environment variables will carry keys (never
values, never files); (3) a cost estimate table you compute from
the bank (16 journeys, turns × extraction calls + probes × answer
calls, priced at current public per-token prices for one cheap
model — cite the price source and date); (4) the pre-registration
law: before any live call, predictions are appended to a NEW file
`evals/predictions-bakeoff.md` (create it now with a `DRAFT — not
final until founder GO` header and per-journey-category predicted
outcomes for each arm, written honestly from the dry findings); (5)
the explicit statement that executing any of it requires a founder
GO recorded in `docs/DECISIONS.md`.

Completion test: both files exist; `grep -c "FOUNDER GO"
docs/BAKEOFF-J3-PREP.md` ≥ 1; `grep -c "DRAFT"
evals/predictions-bakeoff.md` ≥ 1; no `mem0ai` import exists
anywhere (`grep -r mem0ai evals/ src/ tests/` finds only the
prep doc); `npm test` green.

### J2.3 — Markdown report renderer

Create `evals/report-markdown.mjs` exporting
`renderReportMarkdown(report)` → a markdown string: one comparison
table (rows = dimensions, columns = arms, cells = `passed/total`),
then a findings section per arm quoting probe id, reasons, and
`knownFinding` notes. Wire `evals/run-bakeoff.mjs` to also write
the rendered markdown to `evals/results/bakeoff-dry-report.md`
(`evals/results/` is gitignored — the artifact is local, never
committed; create the directory with `mkdir` recursive at runtime).
Add `tests/report-markdown.contract.test.mjs` testing the renderer
on a small hand-written report fixture (no live run needed): table
contains every dimension row, arm columns in order, and the
findings section quotes `knownFinding` text.

Completion test: `npm test` green; `npm run bakeoff` exit 0 and
the file `evals/results/bakeoff-dry-report.md` exists afterward;
`git status --porcelain` shows no new tracked files from the run
(the report is ignored).

### J2.4 — Close the loop: README + STATUS

1. In `README.md`, insert a `## Comparing memory engines` section
   after the Quickstart section: two sentences on the journey bank,
   the `npm run bakeoff` command, one sentence stating the current
   reference baseline (26/28-style number — use the true current
   one) with its known findings named honestly, and a pointer to
   `docs/JOURNEY-BANK.md` and `docs/BAKEOFF-J3-PREP.md`.
2. In `STATUS.md`: mark J1 and J2 done with their commit hashes,
   answer the five product-stop-rule questions for the J1+J2 work
   in one short block each, set `Next:` to the J3 FOUNDER GATE with
   a one-line summary of what the founder must decide (GO for live
   spend per `docs/BAKEOFF-J3-PREP.md`), and append one Log line
   per completed task.

Completion test: `npm test` green; `npm run bakeoff` exit 0;
`grep -c "bakeoff" README.md` ≥ 1; STATUS.md contains `J3` and
`FOUNDER GATE` in its `Next:` block. Then STOP: J3 and J4 are
founder gates. Report and end.

## §6 The checklist (the contract is done when all are checked)

- [ ] J1.1 — bank at 16 journeys, pins updated, bakeoff exit 0
- [ ] J1.2 — docs/JOURNEY-BANK.md
- [ ] J2.1 — ungoverned-baseline arm + pinned contrast test
- [ ] J2.2 — docs/BAKEOFF-J3-PREP.md + DRAFT predictions file
- [ ] J2.3 — markdown report renderer + local report artifact
- [ ] A1.1 — per-palari scoping journey (bank at 17) + harness plumb
- [ ] A1.2 — v05-parity arm + pinned baseline
- [ ] J2.4 — README section + STATUS close-out, then STOP

Execution order: J1.1, J1.2, J2.1, J2.2, J2.3, A1.1, A1.2, J2.4.

## §7 AMENDMENT A1 (2026-07-22, after parent-app recon — founder-ratified)

Recon of the parent app CoyStan/palari-v05 at its current `main`
(`066335b`) established three facts that sharpen this contract:
(1) v05's production memory files (`memory-store.mjs`,
`memory-extraction.mjs`, `memory-briefing.mjs`) are byte-identical
to this kernel's extraction baseline — the kernel is a strict
superset of what the deployed beta runs today; (2) the beta runtime
is the node workbench backend with one SQLite file per workspace —
no Postgres in the live path (the sql/ cutover work is planning,
not wired); (3) multiple palaries now serve one deployment (Sofia,
the Maeve pilot), so per-palari memory scoping is a live product
dimension. Two tasks are added (executed after J2.3, before J2.4)
and J2.2 gains content requirements.

### A1.1 — Per-palari scoping journey (bank to exactly 17)

Plumb optional actor overrides through the harness, evals files
only: in `evals/journey-bank.mjs` allow optional non-empty-string
`asUserId`/`asPalariId` on user turns and probes; in
`evals/harness.mjs` pass `palariId: turns[i].asPalariId ?? palariId`
on ingest and `{ question, questionDate, userId, palariId:
probe.asPalariId ?? palariId }` to `arm.answer`; in
`evals/arms/kernel-arm.mjs` accept the per-call `palariId` override
in both `ingestTurn` (already honored) and `answer`. Then add
journey `palari-scoping-17` (category `isolation`): the workspace
user tells palari-a a work fact in s1; probes — p1 asking palari-a
answers it; p2 with `asPalariId: "palari-b"` abstains and leaks
nothing (dimension `isolation`). `expectTotalWritten: 1`. Update
all pinned counts (17 journeys) in both arm baseline tests.
Completion test: `npm test` green with new pins; `npm run bakeoff`
exit 0 reporting 17 journeys.

### A1.2 — v05-parity arm (the decision-relevant contrast)

Create `evals/arms/v05-parity-arm.mjs`, name `v05-current-memory`:
what the deployed parent app does today, built ONLY from this
repo's own files (no v05 import): open a real kernel store via
`createKernelStore` but write candidates directly through the RAW
store door `store.addMemory(record, { sourceKind, writer:
'background_extraction' })` with NO gate, NO eventAt provenance
(v05 baseline behavior), skipping nothing — every candidate is
attempted regardless of `sourceKind`; answer via
`store.recallMemories` + `buildMemoryBriefing` from
`src/memory-briefing.mjs` (briefing v0), abstaining with the exact
stub abstention sentence when the briefing has no included
entries; `forget` via `store.topicForget`. NOTE: the raw store
door still enforces its own write-boundary checks — whatever
passes or is refused IS the measurement; do not work around
refusals. Register as a third arm in `evals/run-bakeoff.mjs`
(reference-arm exit rule unchanged). Add
`tests/v05-parity-arm.contract.test.mjs` pinning its actual
results exactly as the other arm tests do, with a comment naming
each divergence from the kernel arm (expected shape, verify then
pin: eventAt-less provenance and any injection/scoping
differences). Completion test: `npm test` green; `npm run bakeoff`
exit 0 printing three arm blocks.

### A1 additions to J2.2's document

`docs/BAKEOFF-J3-PREP.md` must also record, each in one or two
sentences: the deployment reality (workbench node backend, one
SQLite file per workspace, memory files byte-identical to this
kernel's baseline — zero drift); that the J4 decision option
"keep this kernel as the engine" concretely means upgrading v05's
~60-line briefing seam (`buildAssistantMemoryBriefing` in
`assistant-brain.mjs`) to `createGatedStore` + `recallAndBrief`,
staged behind v05's flag discipline as a FOUNDER-GATED follow-on
unit in the parent repo; and that a future v05 Postgres cutover
would reopen the storage-driver question — recorded as a J4
decision input, not built.

The doc MUST also quote, verbatim, this pre-registered J4 decision
rule (it guards against home-team bias and may only be changed by
the founder):

> J4 DECISION RULE (pre-registered before any live run). The dry
> report alone can NEVER decide J4: it contains no real external
> framework, so it can only compare our own variants. The
> reuse-vs-keep decision is made on the LIVE bank (J3) with at
> least one real external arm (Mem0 first). An external framework
> is ADOPTED as the engine if it matches or beats the kernel on
> the usefulness, correction, and temporal dimensions and its
> isolation/injection gaps are closable by the thin Palari plane
> (write boundary + briefing + scoping in front of it). The kernel
> stays the engine only by WINNING on the journeys, never by
> default or familiarity. Ties on memory behavior break TOWARD the
> external framework — maintenance we keep is a cost forever,
> code we delete is free — with exactly two founder-weighable
> exceptions, measured as bank dimensions, that may overrule a
> tie: local-file data residency and user inspectability.

## §8 Handoff note from the seeding session

The two pinned findings are genuine, useful product measurements —
the temporal-recall gap is exactly where Graphiti/Zep-class engines
claim their advantage, and the conflict-briefing behavior is the
honest description of what un-cued contradictions do today. The
ungoverned-baseline arm (J2.1) will make the third measurement:
what the kernel's gate buys relative to naive retention. Those
three numbers together are the entire point of this phase — they
are what the founder needs to make the J4 engine decision with
evidence instead of taste. Keep them honest.
