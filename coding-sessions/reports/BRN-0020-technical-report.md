# BRN-0020 Technical Report

## Files Changed

- `evals/predictions.md`: freezes P-set 30 and the launcher hash before any
  credential/provider activity.
- `STATUS.md` and `docs/DECISIONS.md`: record the comparison boundary, ledger,
  meter rates, provider-free evidence, and next founder gate.
- `coding-sessions/tickets/open/BRN-0020-*.md`: governs the one-shot evaluation.
- Gitignored mode-0600 private launcher: rehashes sealed sources, copies exact
  databases, runs current Sol retrieval/commitment, meters requests, compares
  canonical tables, and seals terminal artifacts.

## Verification

- Private launcher `node --check`: PASS.
- Private launcher `--verify`: PASS without credential or network access.
- It rehashes 74 BRN-0017 artifacts, five SQLite files, six required original-
  user evidence spans, four question/date objects, eight accepted product
  files, two exact tool wires, and the 3,208-file native Ettin closure.
- The one-shot result namespace is absent. Invalid/no authority fails before
  namespace creation, credential access, or transport.
- Full `npm test`: 727 passed, 0 failed, 15 optional skips across 742 tests.
- `npm run quickstart`: PASS, 6/6 journey stages.
- Governed scope and `git diff --check`: PASS.
- Credential reads / provider calls / inference / spend: `0 / 0 / 0 / $0.00`.

Independent review of submitted head `e1986d9` reopened three findings. The
launcher repair now file- and directory-syncs every meter reservation before
dispatch; emits separate, non-aliased pending records for equivalent-fact and
material-use terminal judgment; reconciles meter, report, terminal hash, and
caps during sealing; and persists an explicit failed manifest with errors when
any reconciliation, artifact, mode, or credential scan fails.

Rereview of repaired head `08e4a59` reopened two P1 accounting findings: the
Gemini bound used UTF-16 code units and settled usage-absent responses as
measured, while the OpenAI request/response did not pin Standard/default
service. The cumulative repair reserves Gemini from UTF-8 text bytes and
retains successful usage-absent calls as uncertain/accounted. It also injects
`service_tier: "default"` into the actual serialized OpenAI request, reserves
those exact bytes, and rejects a response whose tier is not `default` before
settlement.

Rereview of cumulative head `c12eb73` found that missing, null, or string
OpenAI usage fields could still be coerced to zero/numbers and erase a real
reservation. The repair requires plain provider usage with own raw numeric
safe-integer input/output/total and cached/cache-write fields and consistent
totals. Any malformed usage is persisted as `invalid-usage`, terminates the
cell, and leaves the entire durable reservation uncertain/accounted.

Rereview of strict head `8d047b0` found that explicit zero usage and numeric
usage beyond the durable reservation could still settle. The cumulative fix
requires positive input/output/total tokens, constrains input to the serialized
UTF-8-byte bound, output to 512, and measured dollars to the reserved amount.
Any zero or out-of-bound usage follows the same terminal `invalid-usage` path
without releasing uncertainty.

Fresh independent review of exact clean pushed head `2d4beec` replayed all
prior defects and the full cumulative contract. It found no P0-P3 issue and
recommends the frozen identity for founder-gated dispatch. No credential,
network, provider, local inference, result namespace, or spend activity
occurred during review.

## Risks / Follow-Ups

- Sol may choose not to plan, may fail the stricter commitment, or may miss the
  required spans. Those are measured findings; this identity permits no tuning
  or reroll.
- `$0.50` is a hard accounted cap, not a promise of completion. Any uncertain
  request retains its reservation and stops if the next call cannot fit.
- Material use and equivalent fact remain judged diagnostics. The sealed run
  leaves both explicitly pending; one independent terminal reviewer labels
  them exactly once from raw trace evidence in tracked terminal reporting.
  Structural commitment fields do not prove semantic use or regrade BRN-0017.
- The authorized identity is now terminal and consumed; no retry, resume,
  replacement identity, or top-up is permitted.

## Terminal Result

- The exact founder-authorized invocation ran once. Its modern commitment
  smoke passed with the answer “The compatibility color is indigo.”
- Phone completed. It recalled and selected the exact original user statement
  about owning a portable power bank, declared its consequence, and explicitly
  recommended keeping that power bank charged as a short-term backup. Session
  recall and exact-span recall were both `1/1`. Independent terminal review
  judged equivalent-fact recall PASS `1/1` and materially-used evidence PASS
  `1/1` exactly once from the sealed raw trace.
- Instant Pot registered the general `before` plan, called timeline, and
  requested semantic search. Before the next model dispatch, its conservative
  reservation would have crossed the fresh cap. The meter refused before
  transport; Instant Pot has no terminal result. Tokyo and Miami were not
  reached.
- P-set 30 completion is FAIL: smoke pass, only `1/4` fixed questions complete.
  Accounting/integrity is PASS: seven successful OpenAI calls used 21,745
  input / 715 output tokens with 12,915 cached and 8,809 cache-write tokens;
  transport latency totaled 22,614.3 ms. Three Gemini calls remain uncertain.
- Fresh spend is `$0.08306875` measured + `$0.00002310` uncertain =
  `$0.08309185` accounted. Cumulative accounted is `$7.75502179`, below the
  `$8.17192994` ceiling. Seal: 16 mode-0600 artifacts, zero credential matches,
  zero sealing errors, manifest `a039a12a...`.
- This incomplete diagnostic creates no official score and does not alter the
  historical BRN-0017 6/10.

## Terminal Review Disclosure

- P0/P1: none. Terminal call, usage, accounting, cap, source, transcript, and
  historical-result reconciliation passed.
- P2: after sealing, the specialist's SQLite `readOnly:true` canonical check
  retouched the manifested Phone SHM timestamp and created unmanifested Instant
  Pot SHM/WAL sidecars. All 16 manifested bytes still rehash, both copied main
  DBs remain byte/canonically exact, the added SHM is mode 0600 SHA
  `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb`,
  and the empty WAL is mode 0600 SHA `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Preserve all files; do not delete, reseal, rerun, or claim a closed physical
  file set. Future audits open only a copy outside a sealed namespace.
- P3: the preregistered phrase “six-tool wire” is a stale count. The immutable
  exact hash/names and every request correctly bind six memory tools plus the
  commit tool, seven total. Completion already fails independently.
- Phone judged labels: equivalent fact PASS `1/1` for
  `phone-user-has-portable-power-bank`; materially used PASS `1/1` for evidence
  `dialogue_5cfaaa3c5d64c1ca388b37699c83f227652b14b628eb13e9dd7105935cd48e32`.
  They remain tracked judgments, not canonical or sealed truth.
