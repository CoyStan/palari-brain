# Security review — 2026-08-04

Founder-directed sweep of the whole repository for hardcoded secrets, SQL
injection, unvalidated input, insecure dependencies, permissive CORS, exposed
debug endpoints, and missing authentication. Scope: `src/`, `evals/`,
`scripts/`, `examples/`, `tests/`, dependency manifests, and all reachable git
history.

The repo is a library plus offline eval harnesses. It exposes no HTTP server,
no socket listener, and no browser surface, so CORS, debug endpoints, and
session authentication have no place to be wrong here. Authorization in this
codebase means scope isolation (palari + user) and the admission gate.

## Fixed

### 1. FTS5 query-syntax injection through `searchMemories` / `topicForget` (high)

`memory-store.mjs` `searchMemories(query)` passed the caller's phrase straight
into `memory_fts MATCH ?`. The bound parameter prevents SQL injection, but the
value is still an FTS5 *query expression*, so user text was interpreted as
query syntax:

    topicForget('"tax', scope)          -> Error: unterminated string
    searchMemories('NEAR(', scope)      -> Error: fts5: syntax error near ""
    searchMemories('content: tax')      -> matched via a column filter

`topicForget` is a user-initiated deletion ("forget everything about ..."), so
an apostrophe-free but quote-bearing topic made the deletion throw instead of
delete, and `OR` in a topic could widen what a deletion removed. The properly
sanitizing sibling path already existed (`ftsQueryForKeywords` in
`recallMemories`, `ftsTerm` in `memory-search.mjs`); the topic-forget path
missed it.

Fix: `ftsMatchQueryForPhrase` in `src/store.mjs` turns each whitespace token
into one quoted phrase and keeps the tokens conjunctive, so a phrase can no
longer terminate a string, widen a match, or select a column. Applied in
`topicForget` and in the gate's `searchMemories` surface. The baseline
`memory-store.mjs` stays verbatim (SOURCE-MAP law); the correction lives in the
kernel layer.

### 2. Complete dialogue stored in a world-readable file (medium)

`createPalariMemoryStore` created the workspace SQLite file at the default
`0644`. `createPalariBrain` already hardened it to `0600` (`hardenStoreFiles`),
but every other entry point — `createKernelStore`, the gated kernel surface,
the eval arms — left the complete canonical journal readable by any local
user. Fix: `createKernelStore` chmods the database to `0600` immediately after
open, before the dialogue gate turns on WAL (SQLite copies the database mode
onto `-wal`/`-shm`).

### 3. Ticket CLI passed unvalidated frontmatter into `git` (low)

`scripts/ticket-system.mjs` validated `target_branch` and `worktree` at lint
time and in some commands, but `ticket-worktree`, `scope-check
--committed-plus-dirty`, and the review packet used the raw frontmatter value.
A value beginning with `-` is an option, not a ref or a path. Fix: `ticketTarget`
validates every use through `plausibleGitRef`, and `ticketWorktree` requires an
absolute, non-traversing, control-character-free path.

## Reviewed and clean

- **Secrets.** No key, token, or credential literal in the tree or in git
  history. Provider keys are read from the environment at call time, travel
  only in `x-goog-api-key` / `authorization`, and are never placed in URLs,
  prompts, or result files. `run-bakeoff-live.mjs` and the live runners
  actively strip provider keys from child environments, and the judge
  transport redacts any credential echoed back in headers or bodies.
  `.gitignore` covers `.env`, `*.key`, `*.sqlite`, and `data/`.
- **SQL.** Every value reaching SQLite is a bound parameter. Interpolated SQL
  fragments are module constants (tokenizer names, table names, `?`
  placeholder lists) — no user or model value is concatenated into a
  statement.
- **Scope isolation.** Journal and memory reads go through the
  `visible`/`scopedMemoryPredicate` filter with `palari_id` and `user_id`
  bound; read-by-evidence-ID is scoped the same way. The contract tests cover
  cross-user and cross-palari attempts.
- **Model-supplied input.** Reducer, extraction, and graph payloads are
  parsed, shape-checked, and bounded before use; provenance is verified
  against exact canonical quotes rather than trusted. No `eval`, no
  `new Function`, no dynamic `require` of caller-supplied paths.
- **Prototype pollution.** Parsed payloads are copied field-by-field or spread
  into fresh objects, never merged into shared prototypes, and no
  caller-controlled key becomes an index into a mutable lookup.
- **Command execution.** `child_process` use is `execFile`/`spawn` with
  argument arrays (no shell), in dev tooling only.
- **Dependencies.** Two pinned exact-version devDependencies, no production
  dependency. `npm audit` reports zero advisories. The Rust eval bridge pins
  its git dependency by revision and uses rustls.
- **Result artifacts.** Live-run directories and transcripts are created
  `0700`, keeping conversation content and scores off other local accounts.

## Not applicable

No HTTP server, CORS configuration, debug/admin endpoint, cookie, or
session/authn layer exists in this repository. Hosts embedding the library own
those surfaces; the library's job is the scope filter and the admission gate,
covered above.
