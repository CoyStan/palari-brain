# J4 incremental successor hard-cap contract

Date checked: 2026-07-26

Status: **offline contract selected; no live identity or provider authority**

This contract replaces the byte-count reservations that the component audit
found unproved. It applies only to a future incremental LongMemEval successor.
It does not reopen, repair, resume, or reroll
`j4-active-brain-incremental-longmemeval-q1-v1`.

## Provider choice

The successor uses stable `gemini-2.5-flash-lite` for reduction and answering.
Google documents:

- a 1,048,576-token input limit and a 65,536-token output limit;
- structured-output support;
- `thinkingConfig: { "thinkingBudget": 0 }` as the supported way to disable
  thinking on Gemini 2.5 Flash-Lite;
- Standard pricing of $0.10/M input tokens and $0.40/M output tokens;
- Priority pricing of $0.18/M input tokens and $0.72/M output tokens; and
- Standard as the default service tier when `service_tier` is omitted.

Sources:

- [Gemini 2.5 Flash-Lite model](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite)
- [Gemini thinking controls](https://ai.google.dev/gemini-api/docs/generate-content/thinking)
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini generateContent context caching](https://ai.google.dev/gemini-api/docs/generate-content/caching)
- [Gemini service tiers](https://ai.google.dev/gemini-api/docs/generate-content/priority-inference)
- [Gemini generateContent reference](https://ai.google.dev/api/generate-content)

Every successor request must:

1. omit `serviceTier`, selecting the documented Standard default;
2. set exactly one candidate;
3. set `thinkingBudget` to zero and omit `thinkingLevel`;
4. use at most 2,000 candidate tokens for reduction or 256 for answering;
5. use no tools, grounding, explicit `cachedContent`, or server-side
   conversation state (provider-controlled implicit caching may still occur);
6. set the documented `store` field to `false`, so the request overrides
   any project-level provider logging setting; and
7. use the fixed key-free `generateContent` URL and `x-goog-api-key` header.

## Gemini reservation

Before each physical Gemini dispatch, durably reserve the full documented
model limits at the higher Priority prices:

```text
1,048,576 input × $0.18/M = $0.18874368
   65,536 output × $0.72/M = $0.04718592
                                      -----------
one pending Gemini dispatch          = $0.23592960
```

The designated runtime derives the single Gemini meter ceiling
mechanically:

```text
gemini meter cap =
  min(cumulative cap, opening accounted spend + fresh subcap)
```

It cannot therefore spend beyond the fresh limit merely because the
cumulative limit is larger.

The reservation deliberately exceeds the request's 2,000/256 candidate
limit. It remains safe if a response or its accounting violates that smaller
request contract.

Only one operation may be in flight. The durable state transition is:

```text
measured + uncertain
        |
        | refuse unless accounted + $0.23592960 <= cap
        v
measured + uncertain + pending full-model reservation
        |
        +-- validated Standard success --> measured actual usage
        |
        `-- any uncertainty or mismatch --> uncertain $0.23592960; terminal
```

On a successful HTTP response, accept measured Standard pricing only if all
of these facts agree:

- the response header `x-gemini-service-tier` is exactly `standard`;
- `usageMetadata.serviceTier` is exactly the observed and documented
  lowercase wire value `standard`;
- the model version is the selected stable model;
- exactly one candidate finishes with `STOP`;
- thought tokens are zero or absent;
- any implicit cache-hit count is nonnegative and no larger than the total
  prompt count;
- candidate tokens do not exceed the request's `maxOutputTokens`;
- prompt tokens do not exceed 1,048,576;
- total tokens equal prompt plus candidate tokens; and
- the response and its transcript become durable.

Then replace the pending reservation with:

```text
(promptTokenCount - cachedContentTokenCount) × $0.10/M
  + cachedContentTokenCount × $0.01/M
  + candidatesTokenCount × $0.40/M
```

Gemini 2.5 implicit caching is enabled by the provider and cannot be disabled
per request. A cache hit is therefore valid evidence, not request drift. The
full Priority reservation remains conservative because its uncached input
rate is higher than both Standard input rates.

On timeout, transport ambiguity, non-200 response, malformed content,
malformed usage, model drift, tier drift, nonzero thought tokens, transcript
failure, or durable-meter failure after dispatch, retain the entire
`$0.23592960` as uncertain and stop permanently. No retry or resume is
allowed.

Only exact HTTP 200 releases a reservation. The response is streamed and
counted before aggregate buffering up to an eight-MiB ceiling, with the same
deadline covering both response headers and the complete body. Before a later
attempt can start, the runtime rechecks the exact transcript set and replays
prior success and failure accounting from the private bytes. Orphan,
relabelled, or tampered evidence therefore blocks before another physical
request.

## OpenAI judge reservation

The official-compatible judge remains one stateless
`gpt-4o-2024-08-06` Chat Completions request with `max_tokens: 10`.
OpenAI documents a 128,000-token context window. Reserve the full input field
and the independent output field at Priority prices:

```text
128,000 input × $4.25/M = $0.544000
     10 output × $17/M  = $0.000170
                                  -----------
one pending judge dispatch        = $0.544170
```

This removes the previous `request bytes + 512` assumption. A valid response
must additionally prove `prompt_tokens + completion_tokens <= 128,000`.
As before, validated default-tier usage replaces the reservation; any
dispatched uncertainty retains it and terminates the run.

Sources:

- [GPT-4o model limits](https://developers.openai.com/api/docs/models/gpt-4o)
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- [Chat Completions service tier](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)

## Why `countTokens` is not the cap

Google's `models.countTokens` is a useful planning measurement, but the
documentation does not promise that its result equals the later billable
`promptTokenCount`; Google's examples even show a preflight and generation
count differing by one token. Adding it would also introduce 244 additional
network operations, response parsers, checkpoints, and failure boundaries to
this one-question run.

The successor therefore does not need `countTokens` for safety. The documented
full model window is the pre-dispatch proof, and successful generation usage
is the post-dispatch measurement.

## What the cap does and does not promise

Reservations are sequential, not summed for the whole run. A cap need only
cover all already measured/uncertain spend plus the next pending reservation.
If successive calls consume unusually many tokens, the runner stops before
the next call whose full reservation would cross the cap.

The all-calls maximum for 244 Gemini operations plus one judge would be
`$58.1109924`. A smaller run cap therefore proves a billing boundary, not
guaranteed completion. It is honest for the run to stop partway through.

The proof assumes the documented model limits and public prices checked on
the date above, plus provider-conforming token accounting. It is not a promise
about taxes, invoice rounding, account-specific terms, rejected-request
billing, or a future price change. A live identity must freeze its own price
date, cumulative opening spend, fresh cap, cumulative cap, configuration,
hashes, and FINAL predictions before credential or network access.

The designated successor runtime also refuses dispatch until its global-fetch
guard has been installed. That guard catches accidental unmetered fetches; it
is not a network sandbox and cannot replace explicitly captured, metered
Gemini and OpenAI transports.

## Remaining founder gate

No live identity is created by this contract. Before any provider call, the
founder must authorize one exact successor run ID, one exact benchmark scope,
and explicit fresh and cumulative dollar caps. The offline successor path now:

- uses `createIncrementalLongMemEvalGeminiTransport`;
- uses `runIncrementalLongMemEvalQuestionForScoring`;
- proves an atomic checkpoint-write failure stops after interaction N;
- safely recovers the exact receipt-publication crash window while rejecting
  symlinks, unowned hard links, and unsafe private-file modes;
- derives prediction observations from exact instance, request, transcript,
  accounting, and checkpoint evidence instead of caller-supplied booleans;
  and
- has no authority to cross question 2, Mem0, S-490, score publication, or
  any reroll.

The first bullet is intentionally phrased as a future-run requirement: the
transport exists and is tested offline, but a future frozen runner must
instantiate that exact transport rather than an older meter.

The technical contract being complete does not make a smaller cap a
completion guarantee. A future run can still stop partway through when the
next full reservation would exceed its cap. That stop would be correct
behavior, not authority to relax the reservation after seeing results.

## Offline verification

- Focused successor safety contracts: 131/131 pass.
- Full repository suite: 399/399 pass.
- Quickstart and dry bake-off complete successfully.
- Package dry-run succeeds with 28 public files.
- No provider request, credential read, live identity, score, or spend was
  produced by this contract.
