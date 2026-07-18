# Source Map — the kernel surface in palari-v05

**Unit:** U1. **Author:** Fable 5. **Date:** 2026-07-18.

This file records the exact surface the governed-memory kernel is
extracted from: for every module the kernel needs, its path in
palari-v05, the baseline commit, the exports/methods the kernel uses,
and the dependencies that must be severed or vendored to make the
module run standalone. It is a map, not a design — the API design is
U2 (`docs/KERNEL-API.md`) and the extraction is U3–U5.

## Provenance

- **Source repo:** `github.com/CoyStan/palari-v05`, branch `main`.
- **Baseline commit:** `190a4ad2f8d5187f5f21222048dd11efb2ad9991`
  (short `190a4ad2`), 2026-07-17, "Merge APP-0632 worktree archive
  cleanup". palari-v05 `main` has advanced past this commit; **every
  path and line number below is read at the baseline, not at HEAD.**
- **Local checkout used:** `/home/quetza/palari-v05`.
- **Reproduce any file at baseline:**
  `git -C palari-v05 show 190a4ad2:<path>`
- All paths below are relative to the palari-v05 repo root. The
  backend lives under
  `apps/palari-local-workbench/scripts/workspace-backend/` — written
  `…/workspace-backend/` for brevity.

## Kernel core modules

### 1. `…/workspace-backend/memory-store.mjs`
- **Blob @ baseline:** `4f67d0fe96dd` · **1112 lines**
- **Role:** the store — schema + migrations, SQLite/FTS5 engine, the
  typed write gate, recall (FTS + scoped filters), lifecycle jobs,
  deletion. This is the load-bearing module; most of U3/U4/U5 is here.
- **Module-level exports used by the kernel:**
  - Constants that ARE the contract's vocabulary:
    `memoryStoreSchemaVersion = 'CDX-M0'`,
    `memoryFtsTokenizer = 'unicode61 remove_diacritics 2'`,
    `permanentMemoryTypes` {relationship, preference, opinion, entity,
    life_event}, `transientMemoryTypes` {working, project, recent_life,
    session_summary}, `memoryTypes`,
    `acquisitionModes` {direct, told_to_me, extracted, summarized},
    `memoryAddWriters` {background_extraction, explicit_user_action,
    session_summary}, `memoryMutationActors` (+lifecycle_job),
    `externalMemorySourceKinds` {source_document, tool_output,
    web_result} — **the injection-boundary categories.**
  - Factories/helpers: `createPalariMemoryStore` (the store),
    `createWorkspaceMemoryManager` (per-workspace store cache +
    `forWorkspace`/`publicStatus`), `probeMemorySqliteDriver`,
    `deleteWorkspaceMemoryDatabase`, `workspaceMemoryDbPath`,
    `resolvePalariMemoryConfig`, `pathExists`,
    `extractMemoryQueryKeywords`, `trigramShingleSimilarity`.
- **Store instance method surface** (returned by
  `createPalariMemoryStore`) — the kernel's real API:
  - Writes (the gate): `addMemory(record, {writer, sourceKind})`,
    `supersedeMemory(existingId, record, {writer, sourceKind})`,
    `bumpImportance`, `touchMemory`, `addMemoryLink`,
    `recordRecallInclusion(ids, {actor})`. Low-level `insertMemory` is
    called by `addMemory` — not a public entry.
  - Reads/recall: `recallMemories(query, {contextBudget, now,
    palariId, userId})` (FTS + scoping + budget — the recall
    primitive), `searchMemories`, `listMemories`, `getMemoryById`.
  - Delete: `deleteMemory(id, {actor})` (removes row + FTS/link
    residue).
  - Lifecycle/ops: `runLifecycleJobs`, `publicStatus`, `status`,
    `initializeSchema`, `close`.
  - **No dedicated `topicForget` method exists at baseline.** Topic-
    forget is a *composed* operation (`listMemories`/`searchMemories`
    for the scope → `deleteMemory` each). U3's topic-forget completion
    test must supply this composition; flag for U2's API.
- **Imports (dependencies):**
  - Node built-ins only for the engine: `node:crypto`
    (`createHash`, `randomUUID`), `node:fs/promises`, `node:path`,
    `node:module` (`createRequire`), `node:perf_hooks`.
  - **`node:sqlite` `DatabaseSync`** — required via `createRequire`
    (lines 318, 737). Built-in, **no native module** (not
    better-sqlite3). Requires FTS5 with the unicode61 tokenizer or it
    throws (line 730). ⇒ **Constraint to record in U3:** minimum Node
    version with stable/available `node:sqlite` + FTS5; may need
    `--experimental-sqlite` on some releases. `probeMemorySqliteDriver`
    already self-checks bilingual (`Fundación`→`fundacion`) round-trip.
  - **`./shared.mjs`** → `booleanEnv`, `slugify`. **SEVER: vendor** —
    two small pure utilities (shared.mjs blob `b47ebc15716f`, defs at
    lines 15 & 241). Copy into a kernel util; do not import the product
    shared module.

### 2. `…/workspace-backend/memory-extraction.mjs`
- **Blob @ baseline:** `d8367ceb900c` · **950 lines**
- **Role:** the extraction pass — turns an assistant turn into
  candidate memories and **writes them through the store gate.** This
  is where the one-gate + injection boundary is enforced at write time.
- **Exports used by the kernel:** `runMemoryExtractionPass`,
  `buildMemoryExtractionRequest`, `deterministicMockMemoryExtraction`
  (provider-free stub — the seam for U7 dry mode),
  `normalizeMemoryExtractionPayload`, `writeSessionSummaryMemory`,
  `createMemoryExtractionScheduler`, `memoryContainsTransientDetail`,
  `memorySourceBoundaryForCandidate`,
  `memorySourceTextsFromAssistantResult`,
  `memorySessionSummaryBoundary`, `memorySourceInstructionPattern`.
- **The gate, concretely** (`runMemoryExtractionPass`, lines 767–850):
  takes an injected **`extractor({turn}) → payload`** function
  (provider-agnostic), then per candidate: `memorySourceBoundaryFor
  Candidate` computes `write_eligible` + `source_kind`; drops transient
  detail; **drops any candidate whose source boundary is not
  write-eligible** (source/tool/web content cannot mint) — then writes
  only via `store.supersedeMemory`/`store.addMemory` with
  `writer:'background_extraction'` + `sourceKind`. No direct writes.
- **Imports (dependencies):**
  - `./memory-store.mjs` → `extractMemoryQueryKeywords`,
    `externalMemorySourceKinds`, `memoryTypes`,
    `trigramShingleSimilarity`. **KEEP — kernel-internal.**
  - `./assistant-routing-policy.mjs` →
    `assistantRoleRequestOutputBudgetTokens`,
    `assistantRoleThinkingBudgetTokens`. **SEVER: parameterize or
    vendor** — used only to size the extraction LLM request budget in
    `buildMemoryExtractionRequest`. Both are small pure functions
    (routing-policy blob `afd06e68ddf5`, defs at lines 334 & 343). Pass
    the budget as kernel config, or vendor the two functions.
  - `node:perf_hooks`.
  - **Provider:** none imported. The LLM is the injected `extractor`
    callback — the founder-gated live seam (U8+).

### 3. `…/workspace-backend/memory-briefing.mjs`
- **Blob @ baseline:** `69578eb05beb` · **118 lines**
- **Role:** answer-time briefing — turns a recall result into labeled,
  budgeted prompt context (briefing format v1; the U9 tuning surface).
- **Exports used:** `buildMemoryBriefing({recall, maxChars, now})`,
  `estimateBriefingTokens`, `memoryBriefingPromptDiagnostics`.
- **Imports:** `./memory-extraction.mjs` → `memoryContainsTransient
  Detail`. **KEEP — kernel-internal** (already inside the kernel set).
  No product deps. Cleanest core module.

### 4. `…/workspace-backend/private-memory.mjs` — **ASSESS (verdict below)**
- **Blob @ baseline:** `aafe6e099cac` · **174 lines**
- **Role:** loads a *sanitized* prior-work "digest" (JSON at an
  env-gated path) and turns it into read-only context lines. Validates
  against a key allowlist, **rejects any digest carrying raw text**
  (`rawTextIncluded` ⇒ null), size-caps input, and matches the digest
  to the palari/user before surfacing.
- **Exports:** `createPrivateMemoryProvider`, `normalizeMemoryDigest`.
- **Imports:** `node:fs/promises` only. No product deps.
- **Assessment verdict:** **NOT kernel core — exclude from the kernel;
  keep as prior art for U11.** It is a product feature (inject a
  founder's sanitized private digest as turn context via env
  `PALARI_ENABLE_PRIVATE_MEMORY`), not part of the governed store /
  gate / recall / briefing contract. It never writes memories and does
  not pass through the admission gate. **But** its sanitization
  discipline — allowlist keys, refuse raw text, size caps, fail-closed
  to a "do not claim" notice — is directly relevant to the
  injection-resistance section (U11) and should be cited there. U2 will
  record it as an explicit exclusion.

## Recall path inside the assistant runtime

STATUS.md U1 names "the recall path inside the assistant runtime."
There is **no `memory-recall.mjs`** — recall's engine is the store
method `memory-store.mjs:recallMemories`; the *runtime wiring* that
invokes it into an answer lives in one function:

- **`…/workspace-backend/assistant-brain.mjs`** — blob `ad9cb662a36c`,
  **818 lines total**, but the recall path is the single function
  **`buildAssistantMemoryBriefing`** (lines ~130–190). Its whole
  orchestration:
  1. `memoryManager.publicStatus()` gate (skip if memory disabled);
  2. `store = await memoryManager.forWorkspace(workspaceId)`;
  3. `recall = store.recallMemories(text, {contextBudget:12, now,
     palariId, userId})`;
  4. `briefing = buildMemoryBriefing({recall, maxChars:1800, now})`;
  5. `store.recordRecallInclusion(includedIds, {actor:'lifecycle_job'})`
     — records which memories actually made it in (needle-survival
     measurement, per the window laws);
  6. returns briefing + `latencyMs` + `totalCandidates` +
     `recallInclusionTouched`.
- **Extraction to make:** the kernel reimplements just this ~60-line
  orchestration over its own store/briefing primitives. **Sever the
  entire rest of assistant-brain.mjs** — its 16 product imports
  (`drive.mjs`, `workspace-actions.mjs`, `palari-engine.mjs`,
  `assistant-prompt-builder.mjs`, `assistant-runtime-context.mjs`,
  routing/gates/etc.) are chat-handler concerns the kernel does not
  take. Of assistant-brain's imports, only `buildMemoryBriefing`
  (memory-briefing.mjs) is kernel-internal.

## The six memory test files

STATUS.md says "the 6 memory test files"; REFERENCES.md writes the
glob `memory-*.test.js (6 files)`. **Recorded discrepancy:** the
literal glob `memory-*.test.js` matches only **5** files. The sixth
memory test is `internal-alpha-memory-readiness.test.js`, which does
not match that glob. Under `…/tests/backend/`, exactly six files carry
"memory" in the name; those are the six. (Reason for recording: an
inheriting successor amends the corpus at its edges — the glob in
REFERENCES.md is imprecise and U2 should read "the 6 memory tests" as
the list below, not the glob.)

All paths under `…/palari-local-workbench/tests/backend/`:

| Test file | blob | lines | Module(s) under test | Cross-cutting deps to sever for kernel tests |
|---|---|---|---|---|
| `memory-store.test.js` | `f5eafd4041` | 560 | `createPalariMemoryStore`; also drives it via the full backend | `palari-workspace-backend-v2.mjs` (`createWorkspaceBackend`, `devPasswordForUser`) — heavy product backend |
| `memory-extraction.test.js` | `e6f7db1c63` | 1258 | extraction exports + store | `assistant-result-diagnostics.mjs` (`assistantResultSourceRefs`), `assistant-routing-policy.mjs` |
| `memory-lifecycle.test.js` | `6264aaeffb` | 212 | `runMemoryExtractionPass` + `createPalariMemoryStore` | none beyond kernel set — cleanest to re-home |
| `memory-recall.test.js` | `8d685a419f` | 184 | `createPalariMemoryStore().recallMemories` + `extractMemoryQueryKeywords` | none beyond kernel set — cleanest to re-home |
| `memory-briefing.test.js` | `fe1e6001ef` | 211 | briefing **through** the chat handler | `assistant-brain.mjs` (`handleAssistantChatMessage`), `state.mjs` (`createInitialWorkspaceState`) — U5 must rewrite against `buildMemoryBriefing` + a recall fixture directly |
| `internal-alpha-memory-readiness.test.js` | `7b7ab111dd` | 95 | `ops/internal-alpha-memory-readiness.mjs` (provider-free readiness probe) | spawns the ops script via `execFile`; see below |

- **`memory-recall.test.js` and `memory-lifecycle.test.js` are the
  clean pair** — they import only kernel-set modules and are the model
  for U3/U5 contract tests.
- **`memory-store.test.js` and `memory-briefing.test.js` are
  entangled** — they exercise the store/briefing through the full
  product backend and chat handler. These must be *rewritten* against
  the standalone kernel (U3/U5), not lifted verbatim.

### Related ops/reference (not test files, cited by the queue)
- **`…/workspace-backend/ops/internal-alpha-memory-readiness.mjs`** —
  blob `9f16189ae5a3`. The subject of the readiness test; a provider-
  free probe that opens a store, writes fictional memories, and does a
  scoped `recallMemories('cobalt checklists', …)`. Exports
  `runInternalAlphaMemoryReadiness`, `readinessReportForChecks`,
  `internalAlphaMemoryReadinessCheckIds`,
  `internalAlphaMemoryReadinessVersion`. **Assess for U3:** a good
  provider-free canary to port as a kernel smoke check.
- **`docs/agent/internal-alpha-memory-canary-runbook.md`** — blob
  `7c1db4ea3f38`. Deletion/isolation semantics as operated; reference
  for U3 deletion + U5 scoping tests.
- **`docs/agent/case-queue/CASE-memory-source-injection-minting.md`** —
  blob `b44262c2e628`. The real injection incident; the source for
  U11's injection-resistance section.

## Severance ledger (what to cut / vendor / parameterize)

| Dependency | Pulled in by | Disposition |
|---|---|---|
| `shared.mjs` → `booleanEnv`, `slugify` | memory-store | **Vendor** two pure fns into a kernel util |
| `assistant-routing-policy.mjs` → 2 token-budget fns | memory-extraction | **Parameterize** (budget as config) or vendor the 2 pure fns |
| `assistant-brain.mjs` (16 product imports) | recall runtime wiring | **Reimplement** the ~60-line orchestration; drop all product imports |
| `palari-workspace-backend-v2.mjs` | memory-store.test.js | **Rewrite test** against standalone store (no product backend) |
| `assistant-result-diagnostics.mjs` | memory-extraction.test.js | **Shim/fixture** the assistant-result shape in kernel tests |
| `state.mjs`, `assistant-brain.mjs` | memory-briefing.test.js | **Rewrite test** against `buildMemoryBriefing` + recall fixture |
| `node:sqlite` `DatabaseSync` + FTS5 | memory-store (engine) | **Keep** (built-in); record min Node version + FTS5 requirement in U3 |
| Provider / LLM | extraction (`extractor` cb), live recall runs | **Injected** — stays product/founder-gated (U7 stub, U8+ live) |

**Net severance is small:** two pure-function copies, one budget
parameter, one ~60-line orchestration reimplementation, and test
re-homing. The store engine and the whole gate/recall/briefing chain
depend on nothing but Node built-ins + `node:sqlite`.

## Completion test — PASS

Requirement: every listed path exists at the baseline commit. Verified
2026-07-18 against `190a4ad2` — all **16** paths resolve to a blob
(hashes above). Reproduce:

```
cd /home/quetza/palari-v05
for p in <the 16 paths above>; do git rev-parse 190a4ad2:$p; done
```

All 16 returned an object id; zero MISSING.

## Findings carried forward (for U2 and beyond)

1. **`private-memory.mjs` is excluded from the kernel** (product
   feature); cite its sanitization pattern in U11. U2 records the
   exclusion explicitly.
2. **No `topicForget` store method** — U2/U3 must define topic-forget
   as a scoped compose over `listMemories`/`searchMemories` +
   `deleteMemory`.
3. **Recall is a store primitive** (`recallMemories`); the "assistant
   runtime recall path" is only orchestration (~60 lines in
   `buildAssistantMemoryBriefing`) to reimplement, not a module to
   lift.
4. **`node:sqlite` + FTS5 is the only non-builtin runtime need** —
   record the minimum Node version and the FTS5/unicode61 requirement
   as a kernel prerequisite in U3.
5. **REFERENCES.md's `memory-*.test.js (6 files)` glob is imprecise**
   (matches 5); the sixth is `internal-alpha-memory-readiness.test.js`.

— Fable 5, U1, 2026-07-18. Signed per the succession law: this amends
the seed's edges (the test-count glob, the "recall path" phrasing)
with recorded reasons; it contradicts nothing.
