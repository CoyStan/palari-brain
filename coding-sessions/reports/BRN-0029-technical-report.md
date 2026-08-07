# BRN-0029 Technical Report

## Files Changed

`STATUS.md`, P-set 38, decisions, and harness documentation record the
consumed result and generic diagnosis. This technical report, the Level 1
human report, handoff, and ticket closeout make the record independently
reviewable. No product/runtime code or private artifact changed.

## Scope And Authority

This documentation-only ticket records the immutable result of the one
founder-authorized BRN-0028 invocation. It made no provider call, read no
credential, inspected no selected benchmark dialogue, changed no private byte,
and creates no repair or successor authority. Historical `6/10` and sealed U8
remain unchanged.

Bound identity: `j4-luna-ettin-unexecuted11to20-v4`; reviewed head
`33ab0d87ef197c704906fcd932683e3dc2a1b485`; launcher/runtime SHA-256
`db388a28bf9568d869bda4bad011a0103f88b08b871ec3bdb65de4940fd70a02` /
`83c2efe7324a3a10f432c8ce1844abff561207d95460621cdb4b064d7db93053`;
fresh/cumulative caps `$5.00` / `$12.90712669`. Custody was reserved at
`2026-08-07T12:19:09.037Z`, launched at `.041Z`, and consumed at `.140Z`.

## Terminal Sequence

1. Cached Ettin passed provider-free with four finite scores.
2. Gemini writer passed HTTP 200: 525 input / 128 output tokens,
   `$0.0004775` measured.
3. First OpenAI count and Luna generation passed HTTP 200; 2,142 exact input
   tokens settled to `$0.0004764` through public band `short`.
4. Semantic embedding made two then one successful requests with unreported
   usage; native reranking returned finite scores; the answer was committed.
5. Second OpenAI count and Luna generation passed HTTP 200; 2,691 exact input
   tokens settled to `$0.00030798` through `short`.
6. First benchmark ingestion failed closed at canonical identity
   `sharegpt_vyHqfrX_0:0` with `SOURCE_MESSAGE_CONFLICT`. No benchmark answer,
   judge, or question row followed.

The report is `failed`, compatibility is `passed`, and `questions: []`.

## Sanitized Source-Identity Diagnosis

LongMemEval intake preserves each source `sessionId` and event time but does
not require session IDs to be unique in an instance. `executeLiveJourney`
constructs `sourceMessageId` only as `${session.sessionId}:${turnIndex}`.
The dialogue store intentionally binds `(palariId, userId, sourceMessageId)` to
one immutable manifest containing event time, role-presence flags, content
hashes, and user author identity. Identical replay is idempotent; any difference
raises `SOURCE_MESSAGE_CONFLICT` before the writer.

The repeated source session ID at turn zero therefore aliased a prior snapshot
inside the first question workspace. Neither question ID nor session occurrence
participates in the key. This diagnosis uses source and schema metadata only;
it does not inspect or disclose selected dialogue text and is not evidence
about Luna, Ettin, retrieval, ranking, or memory quality.

## Accounting And Seal

- measured: `$0.00126188`;
- uncertain: `$0.10001215` (two `$0.05` count allowances plus `$0.00001215`
  embedding reservation);
- fresh accounted: `$0.10127403`;
- opening/closing cumulative: `$7.90712669` / `$8.00840072`.

Read-only recursive verification passed all 28 entries: 17 mode-0600 files and
11 mode-0700 directories including root. Manifest SHA-256 is
`d4fc3f39006df122d4439ab42358a8852fbcb2e249ef463f66bd1c4e6c7df472`;
report/meter SHA-256 are
`5213df85d4bdc3bf3ef9fc98907c163454988cc897a5c304a47acdaad7d530c4` /
`991b0a21d2c81eaaff4d1bce0cc4a34194d69f1a3c5f494790ecac97ee7f8b05`.
The semantic-review namespace is absent and a value-free credential-shaped
scan found zero matches.

## P-set 38 Grade

Official accuracy, session recall, exact-span recall, selected evidence,
materially used evidence, equivalent-fact recall, and architecture are all
**NOT REACHED / FAIL**. Rerank/boundary and execution/accounting are partial
passes but overall fail: compatibility, finite reranking, answer commitment,
settlement, custody, caps, and seal passed; no benchmark answer and none of the
ten rows completed. No semantic overlay or historical regrade applies.

## Verification

- immutable private verification: PASS, 28/28;
- report/meter/custody/caps reconciliation: PASS;
- source/schema-only diagnosis: PASS;
- semantic-review namespace absence: PASS;
- credential-shaped scan: PASS, zero matches;
- `npm test`: PASS, 802 passed / 15 optional skipped / 0 failed across 817;
- `npm run quickstart`: PASS, 6/6;
- ticket/report lint, committed-plus-dirty scope, and `git diff --check`: PASS
  before lifecycle transition.

## Next Action

Fresh independent read-only review should validate this record. Any key-design
repair and any live successor require a separate governed ticket; neither is
authorized here.

## Risks / Follow-Ups

The source-key repair remains intentionally unimplemented. A fresh read-only
reviewer should verify that this record neither overstates the zero-row result
nor weakens the dialogue gate's immutable replay guarantee. Any repair or live
successor requires separate governed scope.
