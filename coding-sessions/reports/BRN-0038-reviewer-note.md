# BRN-0038 Reviewer Note

Reviewer: fresh independent Codex reviewer
Reviewed commit(s): `2cc4c9b59e3dc21270031ee692f841d24f62dbf0`
Target branch: `main` at `e97bf7be84cf95134ad04ecf9898581b899f6296`

## Review Result

PASS at committed head `2cc4c9b59e3dc21270031ee692f841d24f62dbf0`.
Fresh independent read-only review found no P0-P3 correctness, security,
isolation, scope, or regression issue.

## Findings

- None.

Confirmation v8 exposes consecutive page-local `candidateNumber` values only
after the host has established the displayed direct-user-first page. The host
retains the ordered canonical evidence-ID mapping and resolves each explicit
number through that mapping, so reordered findings remain correctly bound and
do not depend on output position. The schema and host validation accept an
empty `findings` array, require a bounded reason for every listed material
finding, reject missing, fractional, zero, negative, out-of-range, duplicate,
extra-field, legacy, and repeated/stale review payloads, and leave malformed
reviews fail closed.

A successful review marks the entire displayed page assessed. Listed evidence
remains material, keeps confirmation open, forces another unseen search, and
is required in the final commitment; unlisted evidence is recorded separately
as implicitly ignored and is excluded, together with its provenance-aware
information identity, from later confirmation retrieval. Empty findings close
only a character-complete page. Character-truncated pages continue to a
disjoint unseen page, while a complete top-K page can close despite an ordinary
lower-ranked tail.

Compact excerpts remain exact substrings of complete host-side canonical
messages used for quote validation. Direct user evidence still precedes
derivative Palari navigation anchors, duplicate information remains excluded,
confirmation remains bounded and ephemeral with zero durable writes, and the
unchanged scoped retrieval path preserves workspace/user isolation. Telemetry
keeps all candidate evidence, material findings, implicitly ignored evidence,
page completeness, and lower-ranked-tail availability distinct. The change is
confined to the six allowed paths, touches no forbidden path, retains R2 scope,
and the specialist did not accept, merge, or push the ticket.

## Verification Reviewed

- Exact committed diff from target
  `e97bf7be84cf95134ad04ecf9898581b899f6296` to head
  `2cc4c9b59e3dc21270031ee692f841d24f62dbf0`: independently inspected.
- `git diff --check main...HEAD`: PASS.
- `node --test tests/answer-confirmation.contract.test.mjs`: PASS, 10/10.
- `npm test`: PASS, 86/86.
- `npm run quickstart`: PASS, 6/6.
- `npm run test:legacy`: PASS, 917 passed / 15 optional skips / 0 failed
  across 932 tests.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0038`:
  PASS for the six committed allowed paths before this allowed reviewer note.
- Initial `npm run ticket -- check BRN-0038`: expected report-lint failure only
  because this reviewer note did not yet exist. After recording the note,
  `npm run ticket -- report-lint BRN-0038` and
  `npm run ticket -- check BRN-0038`: PASS.
- Final committed-plus-dirty scope check: PASS for all six committed allowed
  paths plus this allowed reviewer note.
- Ticket, technical report, human report, schema/instructions, relevant host
  implementation, and focused contracts were independently inspected. No
  provider, credential, private artifact, dataset, sealed U8 question, or live
  diagnostic was accessed or run.

## Required Changes

- None.

## Recommendation

Recommend `accept` at exact head
`2cc4c9b59e3dc21270031ee692f841d24f62dbf0`. This recommendation does not
accept, merge, commit, or push the ticket.
