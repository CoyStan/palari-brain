# BRN-0017 Technical Report

## Files Changed

- `evals/predictions.md`: preregisters P-set 28 failing-first for the fresh,
  non-rerunnable successor identity.
- `STATUS.md`: records the offline freeze, exact opening ledger, proposed but
  unauthorized cap, and next independent-review gate.
- `coding-sessions/tickets/open/BRN-0017-validate-hardened-cited-luna-meter-on-first-ten.md`:
  records scope and offline evidence.
- Private git-excluded launcher/runtime: bind the accepted product and all
  evaluation inputs, import the BRN-0016 validator, meter every physical call,
  and reserve the one-shot identity before credential access.
- Private sealed result: preserves the single founder-authorized invocation,
  exact answer/judge labels, meter ledger, transcripts, and terminal manifest.

## Verification

- `node /home/quetza/palari-brain-private/luna-ettin-cited-first10-v2-live-launcher.mjs --verify`:
  PASS. Rehashed twelve terminal manifests / 328 artifacts, eleven
  product/eval files, seven Ettin files, the 3,208-file runtime closure,
  dataset/order, and absent result. Product-generated normal, plain-terminal,
  and forced-commit bodies validated before one fake reservation/dispatch each.
- `node --check /home/quetza/palari-brain-private/luna-ettin-cited-first10-v2-live.runtime.mjs`:
  PASS through launcher verification.
- Credential reads / provider calls / inference / spend: `0 / 0 / 0 / $0.00`.
- `npm test`: PASS, 710 passed / 0 failed / 15 skipped across 725 tests.
- `npm run quickstart`: PASS, 6/6 journey stages.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0017`:
  PASS, four scoped paths.
- `git diff --check`: PASS.
- Founder-authorized launcher `--run`: PASS once, exit 0. Both smokes and all
  ten cells completed at official 6/10 with 12/13 required-session coverage.
- Terminal manifest rehash: PASS, 74/74 artifacts / 89,786,836 bytes, no extra
  or missing artifact, every artifact mode 0600, zero credential matches, and
  zero sealing errors. Manifest SHA-256 is
  `850ca10026e7800dcaaa69eab482561d4eb0fe5db17e1a05b6fdb361a5959ebe`.
- Meter reconciliation: PASS, 139 successful physical calls and fresh
  `$0.76368433` = `$0.02779288` measured + `$0.73589145` uncertain. Cumulative
  accounted spend is `$7.17192994`, below `$7.90824561`.

## Risks / Follow-Ups

- The official 6/10 result fails P-set 28's at-least-8/10 accuracy floor. None
  of BRN-0013's three genuine answer-use failures reversed, and one prior PASS
  regressed. This is evidence against another measurement-only successor.
- The ten inspected cases are a causal integration diagnostic, not an estimate
  of unseen-user accuracy. This terminal identity is consumed and receives no
  retry, reroll, or regrade.

## Review Repair

- Independent review at `ecc8add85d25c0c8055ab975a8be5a520f68e835`
  found no P0-P2 issue and one P3: lifecycle transition had emitted trailing
  spaces in the cleared `claimed_by` and `claimed_at` fields, so the committed
  target-aware diff check failed while the pre-transition dirty check had
  passed. The metadata whitespace is removed before resubmission. The report's
  verification statement now refers to the complete committed-plus-dirty
  target range, not only the earlier dirty patch.
