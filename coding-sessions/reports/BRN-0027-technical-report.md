# BRN-0027 Technical Report

## Files Changed

- `STATUS.md`, `evals/predictions.md`, `docs/DECISIONS.md`, and
  `docs/EVALUATION-HARNESS.md` record the consumed terminal result, accounting,
  P-set 37 grade, and generic harness diagnosis.
- This technical report, the Level 1 human report, the handoff, and the ticket
  closeout make the record reviewable.
- No product/runtime code or private artifact changed.

## Scope And Authority

This documentation-only ticket records the immutable outcome of the single
founder-authorized BRN-0026 invocation. It made no provider call, read no
credential, inspected no selected benchmark content, changed no private byte,
and creates no successor authority. Historical `6/10` and sealed U8
`1568498a` remain unchanged.

Authorized identity and bindings:

- identity: `j4-luna-ettin-unexecuted11to20-v3`;
- reviewed head: `6403d629d28ff7bd2552b9c14d6332cfcf2e32b6`;
- launcher SHA-256:
  `13700b4edb0a8a95e00c86bdfa45186410818ad0cbf740c9550d3667be57ea5e`;
- runtime SHA-256:
  `9a821916e16dd1c731e34fe2882b1364303e14da21475aca588097aa40903189`;
- fresh/cumulative caps: `$5.00` / `$12.85549929`.

The attempt was reserved at `2026-08-07T04:36:58.720Z`, launched at
`.724Z`, and consumed at `.834Z`. It cannot be retried or resumed.

## Terminal Sequence

1. The real cached-Ettin smoke passed provider-free with titanium ranked first,
   four finite scores, and answer `It is titanium.`
2. The Gemini writer compatibility smoke passed one HTTP 200
   `gemini-3.5-flash-lite` call. Usage was 525 input and 128 output tokens;
   measured spend was `$0.0004775`.
3. The endpoint-specific OpenAI count projection passed HTTP 200 and returned
   2,142 input tokens. Its request contained the seven frozen count fields and
   matched count SHA-256
   `d77ba2aaa9521a0c3445ca73e1112955e7bc26fd5eb61a1dd5dd7ce76561838d`.
4. The unchanged generation body passed Luna HTTP 200. The response was
   `completed`, model `gpt-5.6-luna`, service tier `default`, with one reasoning
   item, one function call, and usage of 2,142 input / 40 output / 8 reasoning
   tokens. The generation-body SHA-256 remained
   `978a57073547d04b61d5b0813e5db2faef797cc33b6a477b047d1eded41850d8`.
5. Local settlement threw `OpenAI context band is invalid.` before successful
   answer smoke. First-failure handling stopped the invocation. No question,
   judge, official grade, retry, or semantic label followed.

The terminal report is status `failed`, `compatibility: null`, and
`questions: []`. The writer pass remains recorded in `writerCompatibility` and
the three physical calls remain recorded in the meter.

## Generic Context-Band Mismatch

This failure occurs after the provider response boundary. The counted-response
plan copies `reservation.contextBand`; the pricing reservation emits `short`
or `long`. The generated runtime stores that label on the generation call and
passes `request.reservation.contextBand` into `measuredOpenAISpend(...)`.
That helper accepts only `shortContext` or `longContext`, otherwise raising the
observed error.

The exact sequence is therefore:

```text
reservation.contextBand = "short"
  -> generation plan / meter call contextBand = "short"
  -> measuredOpenAISpend(usage, "short")
  -> neither "shortContext" nor "longContext"
  -> terminal local error
```

The meter's `invalid_response` status is its generic failure classification;
the HTTP response itself was 200 and structurally reached completed usage.
This defect does not characterize Luna, Ettin, retrieval, ranking, or answer
quality. No measured Luna charge is inferred after the failed settlement.

## Accounting

- measured: `$0.0004775` (Gemini writer only);
- uncertain: `$0.0511499` (`$0.05` count allowance plus `$0.0011499` full
  unsettled Luna generation reservation);
- fresh accounted: `$0.0516274`;
- opening cumulative accounted: `$7.85549929`;
- closing cumulative accounted: `$7.90712669`.

Both authorized caps held. Count uncertainty and generation uncertainty remain
distinct meter calls. The generation transcript includes usage, but the frozen
settlement failed; this record does not reconstruct a lower measured amount.

## Immutable Recursive Seal

Read-only `verifyTerminalArtifactDirectory(...)` rehashed the complete result
namespace against its write-once manifest:

- manifest SHA-256:
  `df649931886a50341e03be62161f83ba50abe5ba7b832009840866808cd73b4b`;
- manifest status: `sealed`;
- metadata terminal status: `failed`;
- entries: 23 total = 13 manifested files + 10 directories including root;
- every file: mode 0600; every directory: mode 0700;
- meter SHA-256:
  `490f915b62cffbca737c799a5dc7a89615d724544173858a47b41b011872d7e6`;
- report SHA-256:
  `3ad05fe5016024a67d0bc5b16f7ec27b7540ebf51ed35a45991cf5fd7919465f`;
- launcher-attempt SHA-256:
  `99155e1033b672cd29efd81e959c1c17fe43f388d4e81e0bc2643911da23fca0`;
- launcher-result SHA-256:
  `b592ef5ac0ee1a941306969277ecbbaa74cd1d3fc221fa5ac39623ab9e4ddcb4`;
- count transcript SHA-256:
  `aaa94d298635fb35d9cc429c774746318363c2ab814d00dfa8c1cf02e1cc9b03`;
- generation transcript SHA-256:
  `2baee8eb5d9a857326f01bd0e495d9d5347a8500a8b894b24b58c53040c68ec9`;
- Gemini transcript SHA-256:
  `d171d9954fe94ccb0ca4a4c6201933a3192fa38461aeadfc66e4483c5ebaf764`.

A value-free scan found zero credential-shaped strings in the sealed tree.
The semantic-review namespace is absent. No overlay is applicable with zero
question rows.

## P-set 37 Grade

OFFICIAL ACCURACY, SESSION RECALL, EXACT-SPAN RECALL, SELECTED EVIDENCE,
MATERIALLY USED EVIDENCE, EQUIVALENT-FACT RECALL, and ARCHITECTURE are all
**NOT REACHED / FAIL**. RERANK/BOUNDARY is partial pass / overall fail: Ettin,
writer order, count wire, and generation wire passed, but end-to-end answer
smoke did not. EXECUTION/ACCOUNTING is partial pass / overall fail: one-shot
stop, cap hold, uncertainty retention, and recursive seal passed; exact Standard
settlement did not. No judged overlay was created and the historical result was
not regraded.

## Verification

- private recursive manifest verification: PASS, 23/23 entries;
- private modes, hashes, report/meter reconciliation: PASS;
- generic credential-shaped artifact scan: PASS, zero matches;
- semantic-review namespace absence: PASS;
- source-level context-band diagnosis: PASS;
- `npm test`: PASS, 797 passed / 15 optional skipped / 0 failed across
  812 tests;
- `npm run quickstart`: PASS, 6/6;
- ticket/report lint, committed-plus-dirty governed scope, and `git diff
  --check`: PASS before transition to review.

## Risks / Follow-Ups

Fresh independent read-only terminal review should validate this pushed record
and the unchanged sealed evidence. BRN-0027 may then be accepted under the
governed workflow. A normalization repair and any successor identity belong to
a new ticket; neither is authorized here.
