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

## Risks / Follow-Ups

- The live provider behavior and official ten-question outcome remain unknown.
  Prior authority is consumed. Dispatch requires a new exact founder
  authorization for identity `j4-luna-ettin-cited-first10-v2` under the frozen
  fresh and cumulative caps.
- The ten inspected cases are a causal integration diagnostic, not an estimate
  of unseen-user accuracy. Any terminal stop remains the result and receives no
  retry, reroll, or regrade.

## Review Repair

- Independent review at `ecc8add85d25c0c8055ab975a8be5a520f68e835`
  found no P0-P2 issue and one P3: lifecycle transition had emitted trailing
  spaces in the cleared `claimed_by` and `claimed_at` fields, so the committed
  target-aware diff check failed while the pre-transition dirty check had
  passed. The metadata whitespace is removed before resubmission. The report's
  verification statement now refers to the complete committed-plus-dirty
  target range, not only the earlier dirty patch.
