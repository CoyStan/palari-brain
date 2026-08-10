# BRN-0045 Human Report

## Why This Mattered

Several S60 requests reached the provider too close together and received
HTTP 429. The old error said only that the request failed. It did not give the
caller safe timing or request-limit information.

## What Changed

A caller can now create one rate pacer and share it across OpenAI transports
in the same process. The pacer waits before a request when that request would
cross the caller's explicit rolling limit. The transport still sends each
request once and does not retry.

When the provider returns HTTP 429, the typed error can include the status,
request ID, retry-after value, and rate-limit headers. It does not read the
failure response body.

## What I Should Know

Palari does not guess your provider tier. You must set the limit. This pacer is
local to one shared instance; it does not coordinate separate servers. Its
units are conservative scheduling units, not exact provider billing tokens.

## Review And Acceptance

- Provider-free focused, core, quickstart, and legacy tests pass.
- The first review found one P3 ticket-metadata whitespace defect. It was
  fixed without changing product behavior.
- A fresh independent rereviewer accepted exact commit `242b05c` with no
  unresolved P0-P3 findings.
- The founder authorized execution of these three tickets and merge after a
  clean independent review. That direction records acceptance of this clean
  candidate.

## What To Check

- Configure a ceiling that matches the deployed provider account.
- Share one pacer instance across all OpenAI transports in one process.
- Use the safe 429 metadata for operations, but do not treat it as an automatic
  retry instruction.

## Recommended Next Move

Merge and push the accepted ticket. Then start BRN-0046 from the updated
`main` branch.
