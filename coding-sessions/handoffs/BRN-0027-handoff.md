# BRN-0027 Handoff

## Current State

The terminal record is ready for independent read-only review. Identity
`j4-luna-ettin-unexecuted11to20-v3` is consumed and cannot be retried. No live
action is authorized.

## Evidence

- cached Ettin: PASS, expected first item, four finite scores;
- Gemini writer: HTTP 200, 525 input / 128 output tokens;
- projected count: HTTP 200, 2,142 input tokens;
- exact Luna generation: HTTP 200, completed, 2,142 input / 40 output tokens;
- terminal local error: `OpenAI context band is invalid.`;
- report: `failed`, `compatibility: null`, `questions: []`;
- measured / uncertain / fresh accounted: `$0.0004775` / `$0.0511499` /
  `$0.0516274`;
- cumulative accounted: `$7.90712669`;
- recursive manifest: 23 entries, terminal `failed`, SHA-256
  `df649931886a50341e03be62161f83ba50abe5ba7b832009840866808cd73b4b`;
- semantic-review namespace: absent;
- credential-shaped artifact matches: zero;
- historical `6/10` and U8: unchanged.

## Diagnosis

The count reservation uses `short`/`long`. The generated spend helper accepts
`shortContext`/`longContext`. The runtime forwards the unnormalized reservation
label after the HTTP-200 generation response, so local settlement throws and
the full `$0.0011499` generation reservation remains uncertain. Do not infer a
measured Luna charge or call this a provider rejection.

## Review Instructions

Rehash the private namespace without mutation; reconcile report, meter,
transcript shapes, and caps; confirm zero rows and absent semantic overlay; and
replay the source-level generic mismatch without inspecting selected benchmark
content. Review the complete pushed diff and rerun offline verification. The
reviewer must not implement a fix or accept a successor.

## Options

- Reviewer ACCEPT: close and merge this honest terminal record under founder
  or standing delegated authority.
- Reviewer REOPEN: correct tracked record inaccuracies only. Never change the
  private namespace or consumed identity.
- Reviewer NEEDS-HUMAN: stop if any requested action would read credentials,
  inspect selected benchmark content, mutate private evidence, publish, spend,
  or authorize a successor.

## Recommended Next Action

Accept after a clean independent terminal review. Then create a separate
offline repair ticket for context-band normalization and an exact regression.
Any future live evaluation needs a new identity, predictions, review, and exact
founder authorization.
