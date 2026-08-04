# BRN-0014 Reviewer Note

Reviewer: independent agent `/root/brn0014_review`
Reviewed commit(s): `75e03cf4dc2d02cf36b3fbdacacacf4451cd77d9`
Target branch: `main`

## Review Result

Fail / reopen with one P1 finding.

## Findings

- P1: `answerWithRetrieval()` read
  `provider.requiresEvidenceCommitment` only after awaiting provider code. A
  custom provider that declared the capability through an ordinary writable
  property could retrieve canonical evidence, flip its flag to false, and
  return raw prose with `answerCommitted: false`. The reviewer reproduced the
  bypass against a real temporary brain. Luna's declaration is non-writable,
  but the provider-neutral acceptance contract was violated.

## Verification Reviewed

- Focused contracts: 45/45 pass at the reviewed commit.
- Full suite: 701 pass, 0 fail, 15 skipped.
- Quickstart: 6/6.
- Package dry-run: 32 files / 132,056-byte archive.
- Ticket lint, scope, diff, branch-clean, and origin synchronization checks:
  pass.
- Official OpenAI Responses documentation agrees with the strict function,
  forced function-choice, and reasoning/tool-output continuation wire.
- No provider, model, credential, private-result, or dataset access occurred.

## Required Changes

- Snapshot the required-commit capability before invoking provider code.
- Add an adversarial real-brain contract whose provider weakens its writable
  declaration during execution and prove that raw output still fails closed.

## Recommendation

Recommend `reopen`. After the bounded fix and verification, submit a new exact
commit to fresh read-only rereview. This recommendation does not itself accept,
merge, or push the ticket.
