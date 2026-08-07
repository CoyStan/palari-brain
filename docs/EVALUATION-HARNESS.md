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

BRN-0024 is the first benchmark composition of the accepted counted boundary.
For every Luna answer dispatch its private one-shot runtime durably reserves a
distinct `$0.05` unknown-billing count attempt, sends the exact structured body
once to `/v1/responses/input_tokens`, reserves Luna Standard generation from
that validated count, then sends the byte-equivalent body once to Responses.
The same operation ID cannot retry or fall back to bytes. Count uncertainty
and measured generation remain separate ledger entries.

The population is S60 ordinals 11-20. It has never been executed, but tracked
P-set 20 previously assigned content-derived difficulty classes, so BRN-0024
calls it execution-held-out rather than pristine blind. Sealed U8 is excluded;
no new content inspection or row-specific route is permitted. Writer and
answer compatibility smokes precede the ten. The result reports session,
exact-span, selected, judged-equivalent, and judged-material-use surfaces
separately; the last two begin pending and can be labeled once in a separate
append-only, provenance-bearing seal that binds the original terminal manifest
without changing official scoring or canonical memory. Exact live authority
binds both caps, reviewed pushed head, launcher/runtime hashes, and ACCEPT
state before result namespace creation. Standard Luna settlement uses
short/long measured rates selected from the exact-count context band.
Runtime `--verify` is synthetic-only and never opens the dataset; selected
question/session parsing is confined to authorized `--run` after the launcher
consumes the attempt. The launcher treats an environment ACCEPT as insufficient
unless the exact pushed reviewed note also contains the machine-readable
BRN-0024 ACCEPT disposition and identity.

BRN-0023 composes that proven wire with generation reservation without adding
a network client. `createExactCountedOpenAIResponsesEvaluator(...)` requires
four injected functions: durable count-attempt reservation, one count
transport, durable generation reservation, and one generation transport. For
each unique operation it freezes and hashes one exact Responses body, records
the caller's explicit unknown-billing count allowance before counting, parses
the provider count, records the exact generation ceiling, and only then allows
generation. An operation is consumed before the first callback; no failure can
retry or fall back to byte estimation after count dispatch.

The count-attempt allowance and generation reservation are deliberately
separate. The former remains uncertain because the count response has no usage
or billing field. The latter uses explicit 2026-08-06 Standard/default policy:
Luna highest-safe input/cache-write is `$0.25/M` short and `$0.50/M` long,
with `$1.20/M` and `$1.80/M` output; Sol remains `$6.25/M` and `$12.50/M`
input with `$30/M` and `$45/M` output. Long context begins above 272,000 exact
input tokens. Fast, Flex, Batch, regional, aliases, and cache discounts are not
accepted by this boundary.

BRN-0026 corrects the endpoint boundary exposed by BRN-0025. The official
[token-counting guide](https://developers.openai.com/api/docs/guides/token-counting)
describes the same structured input format, while the official
[Count input tokens reference](https://developers.openai.com/api/reference/python/resources/responses/subresources/input_tokens/methods/count)
and OpenAPI operation `POST /v1/responses/input_tokens` define the count
endpoint's accepted top-level parameters. BRN-0025's real HTTP 400 confirms
that the broader Responses `include` control is rejected there.

`projectOpenAIResponsesInputCountBody(...)` therefore snapshots the full
generation body, retains the documented token-affecting fields used by this
evaluation (`input`, `instructions`, `model`, `parallel_tool_calls`,
`reasoning`, `tool_choice`, and `tools`), and omits only explicitly classified
generation-only controls (`include`, `max_output_tokens`, `service_tier`, and
`store`). Any other top-level field fails closed. Nested values and ordering
survive the JSON snapshot exactly. The generation body is never mutated and
keeps its own SHA-256; the count body receives a distinct SHA-256. Count plan,
generation plan, both transports, and final audit carry the pair. This is an
explicit projection contract, not a claim of byte identity between two
endpoint-specific schemas.

## Recursive terminal evidence sealing

`sealTerminalArtifactDirectory(...)` walks a terminal evidence tree in sorted
order. The root and every nested directory must be physical mode 0700; every
file must be a no-follow mode-0600 regular file. Symlinks, special entries,
physical escapes, invalid manifest paths, and wrong modes are terminal. The
manifest records directory custody plus every file's path, size, mode, and
SHA-256, while excluding only the manifest itself.

Sealing uses a synced mode-0600 temporary file and an atomic no-overwrite hard
link, removes the temporary name, then syncs the containing directory. An
existing manifest refuses reseal or overwrite. Verification repeats the
recursive walk and requires exact entry equality. The BRN-0026 permanent
fixture reproduces BRN-0025's nested `transcripts/` and `workspace/` shape and
also covers deterministic ordering, symlinks, special entries, path escapes,
mode failures, content drift, self-exclusion, and reseal refusal.

Successor identity `j4-luna-ettin-unexecuted11to20-v3` uses both boundaries.
Its provider-free final-runtime verification performs a real cached-Ettin
synthetic rank, the exact 11,593-byte hash-bound BRN-0025 compatibility-body
reconstruction through its 11,488-byte projected count followed by one
untouched full generation, a durable one-shot custody sequence, and a real
nested seal and verification before deleting all temporary state. It opens no credential or
dataset, sends no provider request, creates no successor namespace, and spends
nothing. P-set 37 preserves the P-set 36 population and treatment; live use
still requires an independently reviewed clean pushed head and fresh exact
founder authorization.

The founder-authorized v3 invocation is now consumed. Both repaired provider
wires were accepted: the projected input-count request returned HTTP 200 and
2,142 input tokens, then the unchanged full Responses body returned HTTP 200
with completed usage metadata. The next local step failed before successful
answer smoke because two internal context-band vocabularies were composed
without normalization. `reserveOpenAIResponseFromExactCount(...)` exposes
`short` or `long`; the generated runtime forwarded that value to
`measuredOpenAISpend(...)`, which accepts only `shortContext` or `longContext`.

This is a harness response-boundary failure, not a provider rejection. The
meter's `invalid_response` label is the generic terminal state produced after
the local helper threw; it must not be used to characterize Luna. Because
settlement did not complete, the full `$0.0011499` generation reservation stays
uncertain rather than being reconstructed from the transcript. Together with
the `$0.05` count allowance and `$0.0004775` measured Gemini writer call, fresh
accounted spend is `$0.0516274` and cumulative accounted is `$7.90712669`.

The terminal report has zero question rows. No retrieval, official grade,
session recall, exact-span recall, selected evidence, equivalent-fact label,
or materially-used label exists, and no semantic overlay is created. Recursive
verification binds 23 entries (13 files and 10 directories including the
root), terminal status `failed`, and manifest SHA-256
`df649931886a50341e03be62161f83ba50abe5ba7b832009840866808cd73b4b`.

BRN-0028 normalizes the post-response boundary without changing the consumed
record. `settleOpenAIStandardUsage(...)` accepts only the reservation surface's
public `short`/`long` context bands and sources measured Standard/default rates
from the same pinned Luna/Sol policies used for reservation. It validates the
plain raw input, cache-write, cached-input, output, reasoning, and total token
fields and their relationships before returning exact picodollars and a
decimal USD string. Unknown models/bands, legacy `shortContext`/`longContext`,
accessors, proxies, extra fields, coercion, and impossible counts fail closed.

The sanitized successful v3 response shape (2,142 input, 2,139 cache-write,
zero cached, 40 output, 8 reasoning, 2,182 total) settles through Luna `short`
to exactly `$0.0004764`. Cache-write is validated as a subset of input; the
frozen Luna measured policy bills non-cached input at the ordinary Standard
input rate, so it does not add a second charge. This offline reproduction does
not retroactively settle v3: its full generation reservation remains uncertain
and cumulative accounted spend remains `$7.90712669`.
The identity cannot be retried or resumed.

## Canonical source identity and repeated session IDs

The live journey runtime currently derives each ingestion identity as
`session.sessionId:turnIndex`. LongMemEval intake preserves aligned source
session IDs but does not assert uniqueness within one instance. The dialogue
gate then correctly binds `(palariId, userId, sourceMessageId)` to one immutable
turn snapshot, including event time, role presence, content hashes, and user
author identity. Replaying identical bytes is idempotent; differing metadata or
bytes under that key raises `SOURCE_MESSAGE_CONFLICT` before the writer.

BRN-0028 reached this boundary on the first benchmark cell after all
compatibility surfaces passed. A repeated source session identifier at the same
turn index mapped two different snapshots to `sharegpt_vyHqfrX_0:0`; question
identity and session occurrence were not part of the key. The sealed failure
therefore diagnoses generic source-key aliasing, not provider, reranker,
retrieval, or answer behavior. Repair must preserve stable replay identity and
the gate's fail-closed semantics; this terminal-record ticket does not choose
or implement that repair.

BRN-0030 implements that repair without changing the immutable gate. The J4
adapter wraps the UTF-8 source session ID in a versioned reversible base64url
envelope, then appends the original instance occurrence ordinal and exchange
turn index. The product dialogue boundary continues to append `user` or
`assistant` to its canonical rows. This is provenance encoding, not a content
fingerprint: question text, answer text, message text, and their hashes never
participate.

Replay sorts occurrences by event time and uses the original occurrence
ordinal only as a deterministic tie-breaker, so chronology does not renumber
identity. Metric attribution accepts only the complete governed envelope
(plus the product role suffix), decodes it canonically, and recovers the exact
original source session ID. A second occurrence with the same source session
therefore receives a distinct key; exact replay preserves the same keys and
rows; mutation within one occurrence still reaches the unchanged dialogue
manifest and fails `SOURCE_MESSAGE_CONFLICT` before writer work.

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

## Generated runtime execution verification

`verifyGeneratedRuntime(...)` protects a final generated Node byte sequence,
not merely its composer or syntax. It writes one mode-0600 ephemeral copy in
the runtime's own directory, wraps each required module-scope function with a
nonce-named call counter, then executes the caller's provider-free child mode.
The original report and nonce-bound structural record must prove every binding
exists and actually ran. The copy is removed in `finally`. Comments, strings,
duplicate declarations, and a hard-coded pass report therefore cannot satisfy
the boundary. Signals, nonzero exits, timeouts, oversized output, stderr,
invalid JSON, and nonzero provider/credential/dataset/result telemetry fail
closed.

`hashStaticModuleClosure(...)` asks Node's module parser for every static
import/reexport and walks relative dependencies under one canonical root. It
rejects symlinks and escapes and freezes sorted per-file hashes plus external
`node:` specifiers. BRN-0025's reviewed runtime imports from the same clean
ticket-root bytes that this closure hashes: 48 files, 732,601 bytes, SHA-256
`021cf118dec74f5611f5578488dbf86c5b11f996c0cec1a25ba6a680a8e2960d`.

Live one-shot custody has exactly three durable transitions: absent to
reserved, reserved to launched before spawn, then launched to consumed
atomically inside the runtime before preflight. One runtime function owns the
last transition. Both live `run()` and provider-free offline verification call
that function; offline verification proves the durable consumed bytes and
rejects a second call before cleaning temporary state. No other transition is
valid; any live failure leaves the new identity used and terminal rather than
reusable.

Review attestation deliberately does not contain its own final Git HEAD. A
specialist submits PENDING identity/private-hash/disposition markers. After a
clean implementation review, one marker-only commit changes disposition to
ACCEPT. A final out-of-band rereview validates that exact marker head. At live
dispatch, the launcher requires those exact ACCEPT/identity/private-hash
markers and separately requires the current clean pushed head to equal the
founder-supplied reviewed head. This removes the self-hash cycle without
weakening exact-head authority.

BRN-0025 uses this boundary for successor identity
`j4-luna-ettin-unexecuted11to20-v2`. Its final mode-0600 runtime executes the
real cached Ettin ranker through a temporary synthetic Palari brain and proves
the expected travel-mug ordering, answer, and finite score telemetry. The
temporary workspace is removed. Verification does not open the benchmark,
load `.env`, inspect a credential, create a result/semantic-review namespace,
or predict a benchmark score. P-set 36 and the successor freeze preserve the
P-set 35 population/treatment/accounting but form a new evaluation. Any live
invocation requires fresh exact founder authority after independent review.
