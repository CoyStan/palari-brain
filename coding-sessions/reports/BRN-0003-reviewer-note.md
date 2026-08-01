# BRN-0003 Reviewer Note

Reviewer: Codex, fresh-context independent reviewer
Reviewed commit(s): `2751c4383aa8a5388c939c6ea366122b349596ae`
Target branch: `main` at `87b4688ebfdb8707d744c8d3008bafd2901ad5a5`

## Review Result

Fail. The mechanism/policy split, additive evidence migration, unattributed
output compatibility, and attribution on the requested read surfaces are
sound, but the documented concurrency contract is not implemented at process
open and two attribution guarantees are overstated or incompletely tested.

## Findings

- **P1 — The supported same-host multi-process contract fails before the
  configured busy timeout exists.** `createPalariBrain` awaits
  `createKernelStore` before constructing the dialogue gate
  (`src/brain.mjs:186`, `src/brain.mjs:190`, `src/brain.mjs:192`), and the
  store wrapper awaits baseline store creation before it can return
  (`src/store.mjs:56`, `src/store.mjs:57`). The new `busy_timeout` is installed
  only later by `createDialogueGate`/`ensureActiveSchema`
  (`src/dialogue-evidence.mjs:233`, `src/dialogue-evidence.mjs:257`,
  `src/dialogue-evidence.mjs:259`). In an adversarial check, four independent
  Node processes concurrently opened the same already-initialized local
  database and ingested distinct turns; three failed immediately during store
  initialization with `ERR_SQLITE_ERROR` / SQLite errcode 5 (`database is
  locked`), and only one turn landed. This contradicts the promises that every
  opened connection gets a 5,000 ms wait and that same-host processes may open
  the same database (`docs/CONSUMER-SEAM.md:104`,
  `docs/CONSUMER-SEAM.md:111`, `docs/CONSUMER-SEAM.md:120`). Failure was loud
  and no corruption was observed, but the advertised wait/support contract is
  false. The committed concurrency test cannot expose this: it opens both
  handles sequentially and constructs `Promise.all` calls whose canonical
  transaction runs synchronously before the first await
  (`tests/shared-consumer.contract.test.mjs:370`,
  `tests/shared-consumer.contract.test.mjs:378`, `src/brain.mjs:537`). It tests
  serialized success and source conflict, not overlapping lock/busy behavior.

- **P1 — Author immutability is lost once the attributed row is forgotten.**
  The consumer/API documents promise that replaying a `sourceMessageId` under
  a different author throws `SOURCE_MESSAGE_CONFLICT`
  (`docs/CONSUMER-SEAM.md:79`, `docs/CONSUMER-SEAM.md:114`,
  `docs/BRAIN-API.md:60`, `docs/BRAIN-API.md:62`). The turn-manifest comparison
  does not include author (`src/dialogue-evidence.mjs:833`,
  `src/dialogue-evidence.mjs:838`), and a tombstone skips the retained-row
  author comparison (`src/dialogue-evidence.mjs:892`,
  `src/dialogue-evidence.mjs:905`, `src/dialogue-evidence.mjs:924`,
  `src/dialogue-evidence.mjs:931`). Independent verification ingested
  `author-a`, forgot that evidence, then replayed identical bytes/time as
  `author-b`; the call completed with `forgotten_user_message` instead of
  throwing. The negative test covers re-attribution only while the canonical
  row still exists (`tests/shared-consumer.contract.test.mjs:325`). This does
  not resurrect or alter evidence, but it violates the advertised immutable
  source identity and leaves the deletion boundary untested.

- **P2 — Graph-extractor forgery handling does not match the fail-closed
  documentation or negative coverage.** The document says extractor response
  schemas reject attempts to add an author field
  (`docs/CONSUMER-SEAM.md:86`, `docs/CONSUMER-SEAM.md:88`). An adversarial graph
  extractor returned a valid assertion plus `authorId: 'forged-member'`;
  `indexGraph` accepted one edge instead of rejecting the payload. The queried
  edge still receives the trusted author host-side from canonical evidence
  (`src/dialogue-evidence.mjs:1353`, `src/dialogue-evidence.mjs:1362`,
  `src/dialogue-evidence.mjs:1375`), so the forged value cannot become
  provenance. However, the new graph fixture checks only that the extractor
  input lacks `authorId` and never forges an output field
  (`tests/shared-consumer.contract.test.mjs:67`), while the strict negative
  test covers only the statement extractor and reducer
  (`tests/shared-consumer.contract.test.mjs:265`). The rejection promise and
  claimed no-model-writable negative coverage therefore do not agree with the
  graph path.

## Verification Reviewed

- Confirmed clean committed review point at
  `2751c4383aa8a5388c939c6ea366122b349596ae`; inspected the complete
  `main...HEAD` diff and ticket contract.
- `node --test tests/shared-consumer.contract.test.mjs
  tests/memory-exploration.contract.test.mjs
  tests/memory-semantic.contract.test.mjs tests/memory-search.contract.test.mjs
  tests/memory-graph.contract.test.mjs tests/memory-forget.contract.test.mjs
  tests/retrieval-answer.contract.test.mjs` — 63 pass, 0 fail.
- `npm run quickstart` — green.
- `npm run trust-bench` — 5/5.
- `git diff --check main...HEAD` — green.
- `node scripts/ticket-system.mjs check BRN-0003` before this note — ticket
  lint/scope passed; report lint correctly reported the then-missing reviewer
  note and the still-required Level 1 human report.
- Independently verified all requested find/read/timeline, semantic, hybrid,
  briefing, graph, exact-quote, and forget-residual attribution paths; no
  app-specific roles, membership, authorization, or per-author deletion policy
  was added.
- Independently exercised graph-output forgery, post-forget re-attribution,
  and four-process concurrent open/ingest against temporary local databases;
  no provider, network, credential, dataset, eval, or founder-gated action was
  used.
- Specialist evidence reviewed: full suite 650 pass, 0 fail, 15 skipped
  across 665 tests; six shared-consumer contracts green; quickstart green;
  trust bench 5/5.

## Required Changes

- Make the concurrency stance true before any connection performs schema
  work: either install and test the bounded wait before store initialization,
  or explicitly refuse concurrent multi-process opening/writing and narrow the
  documentation. Replace or extend the current Promise-only check with a real
  independent-worker/process lock test that proves the chosen busy/failure
  behavior. If that needs a path outside this ticket's `allowed_paths`, stop
  and obtain a scoped contract change or child ticket.
- Preserve the original optional author in durable turn identity so a
  different-author replay still conflicts after evidence deletion, with an
  additive migration and a post-forget negative test. If erasing that identity
  is intentional policy, narrow the immutable-replay documentation and ticket
  claim explicitly instead.
- Align graph-extractor handling and tests with the documented contract:
  either reject a forged author field and test the rejection, or document the
  safe ignore behavior and add a negative test proving the forged field cannot
  alter the host-recovered author.
- Rerun the focused shared-consumer contracts, full suite, quickstart, trust
  bench, ticket check, and a fresh independent review.

## Recommendation

Recommend `reopen`. This recommendation does not itself accept, merge, or push
the ticket.
