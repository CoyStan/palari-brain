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

## Risks / Follow-Ups

- Sol may choose not to plan, may fail the stricter commitment, or may miss the
  required spans. Those are measured findings; this identity permits no tuning
  or reroll.
- `$0.50` is a hard accounted cap, not a promise of completion. Any uncertain
  request retains its reservation and stops if the next call cannot fit.
- Material use and equivalent fact remain judged diagnostics. Structural
  commitment fields do not prove semantic use and cannot regrade BRN-0017.
- Independent pre-dispatch review and a new exact founder authorization are
  required before `--run`.
