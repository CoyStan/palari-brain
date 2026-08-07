# BRN-0029 Reviewer Note

## Review Boundary

Fresh read-only review was performed at exact clean pushed head
`0ad49792587be0b955fdf06a991430fa22508f81`.

No credential was read, no provider or network call was made, no selected
benchmark dialogue was inspected, and no private artifact was mutated. This
review grants no acceptance, repair, retry, successor, or live-run authority.

## Evidence Verified

- The immutable namespace re-verifies successfully against manifest SHA-256
  `d4fc3f39006df122d4439ab42358a8852fbcb2e249ef463f66bd1c4e6c7df472`.
- Manifest metadata is terminal `failed`.
- Report and meter SHA-256 values match
  `5213df85d4bdc3bf3ef9fc98907c163454988cc897a5c304a47acdaad7d530c4`
  and
  `991b0a21d2c81eaaff4d1bce0cc4a34194d69f1a3c5f494790ecac97ee7f8b05`.
- The report records `questions: []`; the semantic-review namespace is absent.
- Cached Ettin, Gemini writer, two projected OpenAI counts, two Luna
  generations with canonical settlement, semantic embedding, native reranking,
  and committed answer smoke passed before first-question ingestion failed.
- The seven-call ledger reconciles exactly: `$0.00126188` measured +
  `$0.10001215` uncertain = `$0.10127403` fresh accounted; opening
  `$7.90712669` advances to `$8.00840072`, within both authorized caps.
- The sanitized diagnosis is corroborated: ingestion derives source identity
  as `${session.sessionId}:${turnIndex}`, while the dialogue gate binds
  `(palariId, userId, sourceMessageId)` to one immutable snapshot. A repeated
  session occurrence can alias the same key and correctly raise
  `SOURCE_MESSAGE_CONFLICT`.
- P-set 38 preserves distinct metrics, grades the zero-row result failing-first,
  creates no overlay, and leaves historical `6/10` and U8 unchanged.

## Finding

### [P2] Correct the manifest entry-type accounting

`STATUS.md:60-61` and
`coding-sessions/reports/BRN-0029-technical-report.md:66` misstate the tree as
17 manifested files and 11 directories. The manifest actually tracks 16
non-manifest mode-0600 files and 12 mode-0700 directories including root. The
physical tree additionally contains the mode-0600 manifest itself, making 17
physical files total. All hashes, modes, totals, and integrity conclusions
remain valid.

## Verification

- `npm test`: 802 passed, 15 skipped, 0 failed across 817.
- `npm run quickstart`: 6/6.
- Scope and `git diff --check`: pass.

## Severity Summary

- P0: none
- P1: none
- P2: one
- P3: none

## Disposition

**REOPEN**. Correct only the two inaccurate composition statements and
resubmit for read-only review.
