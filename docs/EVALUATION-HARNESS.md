# Evaluation Harness Boundaries

## Structured OpenAI input reservation

OpenAI's Responses input-count endpoint is the exact counting surface for a
structured Responses request. The endpoint accepts the same structured input
shape as the Responses API and returns `response.input_tokens`. OpenAI's guide
also explains why local text tokenizers cannot exactly account for tools,
schemas, images, and model-specific formatting:
<https://developers.openai.com/api/docs/guides/token-counting>.

`evals/openai-input-reservation.mjs` deliberately separates three operations:

1. `snapshotOpenAIResponseBody(body)` makes one immutable JSON snapshot and
   its exact serialized text.
2. `createOpenAIInputCounter({ invoke })` passes an independent immutable copy
   of that structured body to a caller-owned input-count transport and strictly
   validates the response. The caller owns endpoint selection, credentials,
   metering, durable pre-dispatch reservation, and the no-retry rule.
3. `reserveOpenAIResponseFromExactCount(...)` accepts only the branded record
   returned by the strict parser, then reserves that validated count at pinned
   Sol Standard/default rates and the full output ceiling. The exact
   `reservedPicodollars` integer and `reservedUsdDecimal` string are the
   authoritative monetary values; there is no lossy floating-point total.

The pinned policy reflects the accepted BRN-0020 Sol Standard boundary:
short-context highest-safe input is `$6.25/M` (including the cache-write
maximum) and output is `$30/M`; above 272,000 input tokens, highest-safe input
is `$12.50/M` and output is `$45/M`. Pricing must be reverified against the
official OpenAI pricing page before a later live identity is frozen:
<https://developers.openai.com/api/docs/pricing>.

`reserveOpenAIResponseFromUtf8Bytes(...)` preserves the old conservative
fallback: every serialized UTF-8 byte is charged as one input token at the
highest long-context rates, plus the same full output ceiling. Use it only
when no count request is dispatched. A count transport or parse failure is
terminal; silently falling back after dispatch could hide the cost and
uncertain outcome of the physical count request.

BRN-0021 does not call `/v1/responses/input_tokens`, inspect a credential, or
assert that input counting is free. Wire compatibility and billing treatment
require a separate preregistered, founder-gated, metered probe before live
integration.

BRN-0022 is that bounded compatibility probe. Its frozen body follows the
official count examples: model, instructions, structured message input, and a
strict function-tool schema only. It deliberately omits generation-only
controls and makes no `/v1/responses` generation request. One one-shot identity
may make one physical count request after an exact founder gate. It durably
reserves `$0.05` before credential access and retains the whole amount as
uncertain/accounted because the public response contract has no usage or
billing field. Success proves the structured Sol wire; it does not establish
that the endpoint is free or authorize benchmark integration.

The founder-authorized BRN-0022 identity completed once: HTTP 200, 77 exact
input tokens, 1,277 ms, and one physical count request. No generation occurred.
The identity is consumed and the full `$0.05` remains uncertain/accounted;
this compatibility pass does not establish billing treatment.

## Sealed SQLite inspection

Opening a copied SQLite database in place is not read-only at the physical
bundle level: SQLite can touch SHM metadata or create WAL/SHM sidecars even
when the connection is configured `readOnly`. This happened during the
post-seal BRN-0020 inspection and remains preserved as disclosed evidence.

`auditSealedSqliteCopy(...)` enforces the safe boundary:

1. Require an absolute, non-symlink regular database path.
2. Snapshot the main database and any existing `-wal` and `-shm` files through
   no-follow file handles, recording the exact physical set, SHA-256, and mode.
3. Create one owned scratch directory outside the source namespace and copy
   those captured bytes there.
4. Give the audit callback only the copied database path. SQLite must be opened
   inside that callback, never against the sealed source path.
5. Re-snapshot the source, require an identical physical set/hashes/modes, and
   remove only the exact owned scratch directory on success or failure.

The source check also pins device/inode identity, the complete permission mode
including special bits, and the source's resolved physical path. Parent-symlink
retargeting therefore fails even when the replacement has identical bytes.
Scratch cleanup holds an open directory descriptor, follows `/proc/self/fd` to
the same device/inode after a rename, removes that owned physical directory,
and treats pathname substitution as terminal without deleting the replacement.
This rename-safe cleanup currently requires Linux `/proc` support; failure to
resolve the owned descriptor is terminal rather than permission to delete by
an unverified path.

The utility cannot capability-sandbox arbitrary same-process code or prevent a
malicious callback from independently reaching a source path it already knows.
Governed callers must therefore keep the source path out of the callback
closure and treat any custody or cleanup error as a terminal audit failure.

## Measurement meaning

P-set 31's `>=3x` reservation reduction is a deterministic synthetic harness
oracle. It is not a measured provider count, live spend result, or replay of a
private request. Its SQLite cases are synthetic temporary fixtures, not reads
of BRN-0020. Historical BRN-0017 remains 6/10 and BRN-0020 remains consumed and
incomplete.
