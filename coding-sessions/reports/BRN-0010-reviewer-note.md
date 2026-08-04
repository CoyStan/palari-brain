# BRN-0010 Pre-Dispatch Reviewer Note

## Review Result

REOPEN. Exact reviewed HEAD `4c1ae1f` must not dispatch. The independent
read-only review found two P1 integrity defects and two P2 terminalization
defects in the private launcher/runtime boundary. No model inference,
credential read, provider call, result identity, or spend occurred.

## Findings

1. P1 — credential-read state can be recorded falsely. The runtime loads
   `.env` before creating `report.json`, while the launcher used report absence
   to claim credentials were never read and skip scanning. A missing-key
   failure could therefore produce false terminal evidence.
2. P1 — the claimed complete tracked execution closure was not pinned. Ten
   entry files were hashed, but runtime and pinned modules execute additional
   tracked imports. Those bytes could drift while inert verification passed.
3. P2 — child preflight or spawn failure before `runDir` creation did not
   durably consume the first invocation, contrary to the one-shot contract.
4. P2 — secret-detection, report-parse, or filesystem errors during sealing
   could throw before any terminal manifest was written.

## Verification Reviewed

- Exact HEAD `4c1ae1f6cd89510e57456cbcf888143130d09c95`.
- Inert launcher verification: pass; fresh result absent.
- Exact ten-question order and U8 exclusion: pass.
- Nine predecessor bundles, seven Ettin artifacts, and the complete external
  3,208-file runtime closure: pass.
- Focused Ettin contracts: 9/9.
- Full suite: 694 pass / 0 fail / 15 skipped.
- Quickstart: 6/6.
- Ticket lint, scope, and diff: pass; report lint lacked only this note.
- Provider paths are metered and retry-free; cap arithmetic is correct.
- Ettin is the intended treatment and known answers/labels do not enter answer
  retrieval logic.

## Required Changes

- Add an independent durable credential-stage marker and drive exact-value
  scanning and claims from it.
- Pin the exact clean canonical tracked checkout or complete recursive tracked
  execution closure before dispatch.
- Reserve and consume the attempt identity before child preflight, and
  terminalize spawn/early failures.
- Write a sanitized honest failure manifest for scan/seal failures without
  copying credential content.
- Re-freeze changed private hashes and obtain a fresh independent review.

## Recommendation

Reopen BRN-0010. Do not dispatch until all four findings are repaired,
offline checks are green, the replacement hashes are committed/pushed, and a
fresh independent reviewer recommends GO.
