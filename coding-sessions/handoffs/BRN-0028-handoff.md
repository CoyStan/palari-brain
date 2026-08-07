# BRN-0028 Handoff

## Current State

The shared settlement implementation and FINAL P-set 38 are written. Private
v4 generation, cumulative verification, and independent review remain.

## Evidence

The exact sanitized v3 usage now settles offline through public `short` to
`$0.0004764`, while both legacy internal labels fail closed. The helper uses
the pinned policy rates and validates cache-write/cached/input/output/reasoning/
total relationships without mutating caller input.

## Recommendation

Finish the clean pushed private freeze, rerun all offline verification, then
move to fresh read-only review. Do not invoke the provider.

## Authority Needed

The specialist may move this ticket to in-review but may not accept or merge
it. Any live v4 use requires a separate exact founder authorization naming the
identity, both caps, reviewed head, launcher/runtime hashes, and ACCEPT.
