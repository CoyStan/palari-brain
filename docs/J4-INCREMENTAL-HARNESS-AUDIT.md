# J4 incremental harness audit

Date: 2026-07-26

Status: **historical audit complete; successor safety contract prepared
offline; no live identity is open**

No provider request was made during this audit. The failed
`j4-active-brain-incremental-longmemeval-q1-v1` identity, its tracked
preparation cut, and its private evidence were not changed or rerun.

Later on the same date, the founder said “do it” after being offered the first
option below: move to a model with documented thinking-off support and repair
the cap proof offline. `docs/J4-INCREMENTAL-HARD-CAP-CONTRACT.md` and the
successor-only implementation now close the technical blockers identified
here. The component table below is retained as the finding at commit
`c69e30f`, not as the current successor verdict.

## Bottom line

The previous failure was narrower than STATUS first reported. The real meter
received a valid model, but its answer-generation and reducer-generation
arguments were `undefined`. Both constants existed in the arm module; the
runner tried to read them through a configuration-module namespace that did
not export them. A mocked meter factory ignored those arguments, so all 322
tests passed without exercising the production constructor.

That composition defect is now repaired for a future successor through
`evals/incremental-longmemeval-runtime.mjs`. The seam imports the three frozen
provider bindings directly, constructs the real meter, and always denies a
second physical dispatch. Its integration test uses fake HTTP while exercising
the real writer request, answer request, ledger, transcripts, arm, and
one-shot judge.

The audit also found and repaired a second evaluator defect. A schema-valid
reducer may honestly retain no memory. The product then correctly returns a
local “no stored memories” answer without calling Gemini, but the v1 arm
classified that result as infrastructure failure instead of allowing the
official judge to mark it wrong. The historical export retains that behavior;
the new opt-in scoring export treats only a complete, ready, empty digest as a
gradable answer.

At commit `c69e30f`, one blocker remained: the stated `$7.10` fresh limit was
not proved to be a mathematical hard cap. Gemini thinking could exceed the
candidate reservation, and both provider input reservations used an
engineering estimate rather than a provider-guaranteed token count. The
successor resolution below closes that offline design blocker without
creating live-run authority.

## Component-by-component result

| Component | Verdict | Evidence and action |
| --- | --- | --- |
| Terminal run gate | PASS | The v1 ID refuses before dependencies, files, result paths, credentials, or network. It remains sealed. |
| Frozen config, authority, predictions | PASS as historical evidence | Their recorded hashes still identify the pushed preparation cut. They were not edited. |
| Reusable arm and judge provenance | SUCCESSOR-ONLY EVOLUTION | The current arm and judge intentionally add opt-in scoring and corrected accounting. Exact v1 bytes remain at commit `09dedad`; the frozen v1 artifact audit now rejects the changed working-tree bytes. |
| v1 runner-to-meter composition | FAIL, preserved | Two generation arguments were absent. The model argument was valid. The failure remains in the sealed historical runner. |
| Successor composition seam | FIXED | Direct named imports own model, reducer generation, and answer generation. Missing-binding mutation tests fail closed, and the returned surface cannot dispatch the meter's OpenAI path. |
| Real Gemini constructor | PASS offline | Real constructor + fake HTTP completed one writer and one answer, then verified two ledger attempts and two transcripts. |
| Retry cardinality | FIXED | The successor seam owns the no-retry guard. A fake 429 produces exactly one physical dispatch, one verified ledger/transcript attempt, and retained uncertainty. |
| Incremental replay | PASS | Chronological add and correction retain exact evidence lineage and produce one bounded ready digest. |
| Empty-memory scoring | FIXED for successor | The legacy export still rejects it. The opt-in scoring export sends complete honest absence through the real judge meter after two writer calls and zero answer calls. |
| Cross-component path | PASS offline | Both included-memory and honest-empty paths complete through the real arm → Gemini meter → one-shot judge meter using fake HTTP and verified evidence, with no network. |
| Interaction checkpoint semantics | PARTIAL | Per-interaction ordering, hashes, and first-failure stop are tested. A future executable runner still needs failure injection after interaction N and during atomic checkpoint writing. |
| Gemini endpoint and authentication | PASS | Fixed `v1beta/...:generateContent`, POST, JSON, key-free URL, and `x-goog-api-key` header match the current reference. |
| Gemini structured output | PASS | `responseFormat.text`, `APPLICATION_JSON`, the used schema keywords, `MINIMAL`, `store:false`, `STOP`, model version, and exact usage consistency are checked. |
| Gemini service tier | OPEN | Standard is the documented default and prior real responses reported it. The raw response is retained in the transcript, but the historical meter neither enforces nor normalizes the tier, and its safe-header allowlist omits the tier header. A successor-specific policy must close that gap without rewriting sealed evidence. |
| Gemini cached-input accounting | CONSERVATIVE | The meter captures cached token count but charges all prompt tokens at the uncached rate. This is cap-safe over-accounting, not exact billed USD, and must be labelled that way or refined in the successor. |
| Gemini output hard cap | BLOCKED | `maxOutputTokens` limits a response candidate; Google bills thought tokens separately, and `MINIMAL` does not guarantee thinking is off. The current reservation assumes more than the docs guarantee. |
| Gemini input hard cap | BLOCKED | `UTF-8 request bytes + 512` is conservative engineering, not a provider-guaranteed token upper bound. Google’s documented exact mechanism is `countTokens`, which would be an additional founder-gated provider call. |
| OpenAI judge wire | PASS | One stateless Chat Completions request, `store:false`, default tier, pinned model, fixed sampling, exact response parsing, and one physical dispatch are tested. |
| OpenAI judge cap plumbing | PASS | Fresh and cumulative refusal both occur before transcript, meter, or fake fetch. Transport uncertainty retains the full priority-tier reservation. |
| OpenAI judge input hard cap | BLOCKED | Like the Gemini path, the judge reserves `UTF-8 request bytes + 512`. Tests prove enforcement of that reservation, but official documentation does not make it an exact input-token ceiling. |
| OpenAI cached-input accounting | FIXED | `prompt_tokens_details.cached_tokens` now uses GPT-4o’s published `$1.25/M` cached-input rate. |
| Secrets | PASS | Credential files are mode `0600`; no secret value was printed or added to tracked files. Fake credentials are used in every offline integration test. |
| Dataset and U8 boundary | PASS | The local S-60 SHA-256 remains `d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`; only ordinal 1 is selected and the sealed U8 ID is excluded. |
| Private failure bundle | PASS | The ignored artifact manifest verifies recursively. No provider call or score exists for the failed identity. |
| Question 2 boundary | PASS | The sealed runner has no executable second-question path. |
| Prediction oracle | PARTIAL | FINAL bytes are preserved, but some mechanical claims rely on caller-supplied booleans or weak hash-presence checks. A successor must strengthen these before freezing predictions. |
| Historical smoke identity | HISTORICAL DEFECT | The earlier incremental smoke’s checkpoint omitted `identity.model` because of another import-without-export namespace read. Its evidence remains immutable; a successor must build identity from verified runtime/config data. |

## Provider-contract findings

The request format itself is not why the last run failed. Current official
documentation supports the model, endpoint, authentication header, structured
output, thinking level, no-store field, and response fields used here:

- [Gemini generateContent reference](https://ai.google.dev/api/generate-content)
- [Gemini 3 thinking controls](https://ai.google.dev/gemini-api/docs/generate-content/thinking)
- [Gemini token accounting](https://ai.google.dev/gemini-api/docs/generate-content/tokens)
- [Gemini 3.5 Flash-Lite pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini service-tier monitoring](https://ai.google.dev/gemini-api/docs/generate-content/priority-inference)
- [GPT-4o model and pricing](https://developers.openai.com/api/docs/models/gpt-4o)

Three qualifications matter:

1. Google documents thought tokens separately from candidate tokens and says
   `minimal` does not guarantee thinking is off. The current code can reject an
   unexpectedly expensive response after it arrives, but rejection cannot
   undo provider billing.
2. The OpenAI judge has no hidden reasoning-token issue, but its input
   reservation is still a byte-count heuristic. The refusal logic is correct
   for the number it receives; that number is not a documented mathematical
   token ceiling.
3. The pinned `gpt-4o-2024-08-06` judge snapshot is labelled deprecated in
   the current OpenAI model documentation. It remains the frozen
   LongMemEval-compatible judge, but availability must be rechecked before a
   successor is authorized.

`store:false` limits provider storage behavior but is not a promise of zero
provider retention. It must not be described as such.

## Required decision before any live successor

The next unit is not “run again.” It is a founder choice among materially
different evaluation contracts:

1. Use a model with documented thinking-off support, then freeze new model,
   price, prompt, predictions, and exact token accounting.
2. Keep Gemini 3.5 Flash-Lite and explicitly accept that the application cap is
   an engineering safeguard with acknowledged overrun risk, not an absolute
   billing cap.
3. Keep Gemini 3.5 Flash-Lite and reserve a documented provider maximum large
   enough to cover thought tokens, which would require a much larger cap and
   may still need exact input-token preflights.

Until that choice is explicit, there is no live identity, no permitted
provider call, and no benchmark result to report.

## Successor resolution

The founder selected option 1 for offline preparation, not execution. The
successor now:

- uses stable `gemini-2.5-flash-lite`, exact
  `thinkingBudget: 0`, provider-enforced JSON, one candidate, text-only
  inputs, and `store: false`;
- reserves the full 1,048,576-token input and 65,536-token output limits at
  Priority prices before each dispatch, then reconciles only a response whose
  tier header and usage metadata both contain the lowercase wire value
  `standard`;
- accepts unavoidable Gemini 2.5 implicit-cache hits and prices their reported
  tokens at the documented Standard cached-input rate;
- reserves the OpenAI judge's full 128,000-token context plus its separately
  bounded ten-token output at Priority prices;
- derives Gemini's one meter cap as no greater than both the cumulative cap
  and opening spend plus the fresh cap, and requires the runtime's
  accidental-network guard before any dispatch;
- streams at most eight MiB under one request-and-body deadline, treats only
  exact HTTP 200 as success, and replays every prior success or failure before
  another attempt can start;
- keeps one immutable, hash-linked interaction receipt before replacing the
  aggregate checkpoint, safely adopts only its exact interrupted-publication
  hard link after a crash, and permanently stops the invocation after a write
  failure;
- replays provider accounting from exact private transcript bytes, pins the
  exact private instance, reconstructs reducer and answer requests from that
  instance, classifies the complete allowed evidence-path set, and grades
  predictions from validated evidence rather than caller-supplied success
  booleans.

Private directories and files are checked with non-following metadata:
symlinks, extra hard links, unsafe modes, orphan attempts, and substituted
judge response metadata all fail closed. The global-fetch guard is an
accidental-call detector, not an operating-system network sandbox; a future
runner must still capture and pass both metered provider transports
explicitly.

The generic historical exports remain bound to the original Gemini 3.5
contract. Explicit successor-only constants and request builders carry the
Gemini 2.5 contract, so historical config hashes continue to describe the
sealed run instead of being reinterpreted by current code.

This is still not authority to call either provider. No replacement run ID,
benchmark scope, fresh cap, cumulative cap, configuration, or FINAL
predictions have been frozen. The sealed v1 identity remains untouched and
cannot be resumed. A live successor therefore remains at a founder gate even
though the offline hard-cap design is no longer the blocker.

## Offline verification

- Focused provider/composition/scoring contracts: 131/131 pass.
- Full repository suite: 399/399 pass.
- `npm run quickstart`: exit 0, `QUICKSTART COMPLETE`.
- `npm run bakeoff`: exit 0, `BAKEOFF DRY RUN COMPLETE`.
- `npm pack --dry-run`: exit 0, 28 package files.
