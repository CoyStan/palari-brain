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
- Independent pre-dispatch review and a new exact founder authorization are
  required before `--run`.
