# BRN-0004 Reviewer Note

Reviewer: Codex, fresh-context independent reviewer
Reviewed commit(s): `efb3322`, `98ba9a8` (assigned HEAD `98ba9a85cb10c2345d3939c1a393531969949e41`)
Target branch: `main` at `69ec37d6e3fa03e74d1a8a74ab9b39ba541aec66`

## Review Result

Fail. The additive package seam, header-only key placement, fixed endpoint,
host-owned retrieval execution, reducer normalization/admission, and graph
admission are directionally correct and the existing suites pass. The branch
does not yet satisfy its R3 contract because stateless reasoning continuation
is incomplete, public options can raise declared safety ceilings, and required
verification/test evidence is inaccurate or absent.

## Findings

- **High — `store: false` tool continuation does not request stateless
  reasoning content.** `src/openai.mjs:443-453` sends reasoning requests with
  `store: false` but no `include: ['reasoning.encrypted_content']`. The next
  request manually replays the output at `src/openai.mjs:475-488`; the focused
  fixture at `tests/openai.contract.test.mjs:47-58` supplies only a synthetic
  reasoning `id` and empty `summary`. In the official Responses stateless
  pattern, encrypted reasoning content must be requested and replayed when
  stored response state is unavailable. Replaying an unstored ID/summary alone
  does not establish that Luna can continue the reasoning/function-call turn.
  This defeats acceptance criterion 3's core wire guarantee even though the
  array-cloning code correctly preserves any fields that happen to be present.

- **High — the advertised hard bounds are caller-raiseable.** The reducer
  accepts any non-negative `maxRepairs` at `src/openai.mjs:680-696`; an offline
  adversarial check with `maxRepairs: 2` made three model invocations. That
  directly violates the ticket's absolute "no more than one" repair rule.
  Likewise, `maxModelDispatches` accepts values above seven at
  `src/openai.mjs:407-440`; `maxModelDispatches: 8` made eight invocations even
  though `docs/BRAIN-API.md` and `STATUS.md` promise at most seven. The
  `OPENAI_MAX_RESPONSE_BYTES` value is also only a default: lines 219-230
  accept a higher `maxResponseBytes`, contrary to `STATUS.md`'s 4 MiB ceiling
  claim. These options may safely lower a ceiling, but an R3 boundary must not
  let them raise the contracted maximum.

- **Medium — the required provider-free rejection/cap contracts are
  incomplete.** The focused suite covers a one-dispatch cap, an unknown tool,
  refusal, one normal reducer repair, a transport exception, and a fabricated
  graph quote. It does not exercise the 4 MiB/stream response cap, malformed
  function arguments, incomplete Responses output, empty Responses output, or
  rejection of repair/dispatch/response settings above the contractual maxima.
  The ticket explicitly requires fake-transport contracts for response
  normalization, caps, repair bounds, and malformed/incomplete/empty rejection
  paths. The current 13/13 result therefore does not prove the coverage claimed
  by the technical report.

- **Low — committed verification evidence is inaccurate.** Independent
  `git diff --check main...HEAD` fails on trailing whitespace in
  `coding-sessions/tickets/open/BRN-0004-add-openai-luna-provider-adapter.md:13-14`,
  while `coding-sessions/reports/BRN-0004-technical-report.md` records the check
  as passing. The same report says an official OpenAPI read occurred, while
  the ticket's stop condition says to stop before any network call; clarify
  whether that was a local/cached artifact or correct the process record.

- **No additional security/admission finding.** The committed diff stays
  within `allowed_paths`; no forbidden or secret-bearing path changed. The key
  is accepted explicitly, placed only in the Authorization header by adapter
  code, omitted from URLs/bodies/errors, and never loaded on import. Unknown
  tools fail before retrieval. Reducer proposals still cross the canonical
  normalizer and active-memory transaction, and graph proposals cross exact
  quote checks plus the unchanged graph gate. Declared R3 risk is appropriate.

## Verification Reviewed

- `node --test tests/openai.contract.test.mjs` — PASS, 13/13.
- `npm test` — PASS, 663 pass, 0 fail, 15 skipped across 678 tests.
- `npm run quickstart` — PASS, six-step journey complete.
- `npm run trust-bench` — PASS, 5/5.
- `npm pack --dry-run` — PASS; `src/openai.mjs` is included.
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0004`
  — PASS for ten committed paths and zero dirty paths before this note.
- `git diff --check main...HEAD` — FAIL on the two ticket-metadata lines cited
  above.
- `node scripts/ticket-system.mjs check BRN-0004` — expected pre-note failure:
  reviewer note was missing; scope checks passed.
- Provider-free adversarial scripts — confirmed three reducer calls with
  `maxRepairs: 2`, eight answer dispatches with `maxModelDispatches: 8`,
  acceptance of `maxResponseBytes` above 4 MiB, absence of
  `reasoning.encrypted_content` from a `store: false` tool request, and correct
  rejection of an oversized body at a lower configured byte cap.
- Provider calls: 0. Credential reads: 0. Network calls: 0. Spend: $0.00.

## Required Changes

- Add the official stateless reasoning include to answer requests and test
  that encrypted reasoning content plus every other output item/phase is
  replayed unchanged with the host function output.
- Make one repair, seven answer dispatches, and 4 MiB response size absolute
  maxima; optional constructor values may only lower those caps. Add
  adversarial contracts for all three upper bounds.
- Add provider-free contracts for malformed arguments and malformed,
  incomplete, refused, empty, and oversized Responses results across the
  applicable answer/reducer/graph surfaces.
- Remove the committed whitespace and correct the technical report's
  verification and network-source provenance statements so they match the
  rerun evidence.
- Rerun every ticket verification command and submit a new committed HEAD for
  fresh review. Do not perform a live/provider call to resolve the wire issue.

## Recommendation

Recommend `reopen`. This recommendation does not itself accept, merge, push,
transition, or authorize a provider call for the ticket.
