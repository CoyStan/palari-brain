# BRN-0004 Technical Report

## Files Changed

- `src/openai.mjs` — inert OpenAI Responses API boundary for the documented
  `gpt-5.6-luna` model: fixed official endpoint, header-only credential,
  bounded one-shot transport, retrieval function loop, strict structured
  reducer with one host-guided repair, and exact-quote graph extractor.
- `tests/openai.contract.test.mjs` — provider-free contracts for request wire,
  secret placement, bounded transport, reasoning/tool continuation, rejection
  paths, reducer repair, and real brain composition for answer, reducer, and
  graph surfaces.
- `package.json` — additive `palari-brain/openai` export and package file.
- `docs/BRAIN-API.md`, `docs/CONSUMER-SEAM.md`, `docs/DECISIONS.md` — public
  wiring, provider/host authority boundary, separate embedding requirement,
  and the no-live-proof limitation.
- `STATUS.md` — unit closeout, product stop rule, and next founder gate.
- `coding-sessions/tickets/open/BRN-0004-*.md` — governed contract and
  lifecycle state.
- `coding-sessions/human-report/BRN-0004-human-report.md` — founder-readable
  implementation summary.

## Verification

- `node --test tests/openai.contract.test.mjs`: PASS — 13/13.
- `npm test`: PASS — 663 pass, 0 fail, 15 skipped across 678 tests.
- `npm run quickstart`: PASS — six-step product journey complete.
- `npm run trust-bench`: PASS — 5/5.
- `npm pack --dry-run`: PASS — `src/openai.mjs` included in the package.
- Official OpenAI OpenAPI read for `POST /v1/responses`: PASS — request and
  response shapes matched the implemented function and structured-output
  wire; documentation read only, not a provider inference request.
- `git diff --check`: PASS.
- `npm run ticket -- scope-check BRN-0004`: PASS before commit.
- Provider calls: 0. Credential reads: 0. Spend: $0.00.

## Risks / Follow-Ups

- Live account access and provider acceptance are intentionally unproven. A
  separate R3 successor must preregister one tiny writer/reducer compatibility
  call, one answer/tool call, and optionally one graph call, set a hard cap,
  receive fresh founder GO, and record whatever happens.
- `gpt-5.6-luna` is a generation model, not an embedder. Existing semantic
  vectors remain tied to their current embedding model; an OpenAI embedding
  adapter, if wanted, is a separate ticket and requires a derived-index
  rebuild plan.
- Retrieval tool schemas use explicit provider `strict: false` because the
  existing provider-neutral schemas contain optional fields and a
  root-property `anyOf`. Palari's host validation remains strict. Reducer and
  graph outputs use OpenAI strict structured output and then unchanged host
  validation/admission.
