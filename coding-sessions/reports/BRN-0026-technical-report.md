# BRN-0026 Technical Report

## Files Changed

- `evals/openai-counted-responses.mjs` projects the immutable generation body
  into the documented input-count schema and binds separate count/generation
  hashes across reservations, transports, and audit.
- `tests/openai-counted-responses.contract.test.mjs` reproduces BRN-0025's
  full frozen body and observed `include` HTTP-400 shape; it proves nested
  preservation, omission, unknown-field refusal, immutability, ordering, and
  one count plus one exact generation.
- `evals/terminal-artifact-manifest.mjs` recursively collects and durably seals
  mode-0600 files and mode-0700 directories without following links.
- `tests/terminal-artifact-manifest.contract.test.mjs` seals a BRN-0025-shaped
  nested fixture and exercises ordering, drift, modes, symlinks, special
  entries, path escapes, self-exclusion, and reseal refusal.
- P-set 37, harness/decision documentation, governed reports, handoff, ticket,
  and `STATUS.md` freeze the offline successor and founder gate.

New gitignored private artifacts, both exact mode 0600:

- `/home/quetza/palari-brain-private/luna-ettin-unexecuted11to20-v3-live-launcher.mjs`
  — SHA-256
  `e8bf8d79f7b13cbaf28ee8e9e580638b04214590a2d47bf20c42cb2202d0543e`.
- `/home/quetza/palari-brain-private/luna-ettin-unexecuted11to20-v3-live.runtime.mjs`
  — SHA-256
  `a1c2e9f006065534f7283eed54720137119a0cfb8e1e313e92a222314368d81e`.

The v3 result and semantic-review namespaces are absent. U8 is excluded. No
credential environment, credential value, selected dataset, provider,
generation, result namespace, or spend was reached.

## Count Projection

Official provenance is the OpenAI token-counting guide, Count input tokens
reference, and OpenAPI `POST /v1/responses/input_tokens` operation. The full
BRN-0025 generation shape has `include`, `input`, `instructions`,
`max_output_tokens`, `model`, `parallel_tool_calls`, `reasoning`,
`service_tier`, `store`, `tool_choice`, and `tools`. The provider rejected
`include` as `unknown_parameter`.

The repair retains the seven documented count fields used by the body:
`input`, `instructions`, `model`, `parallel_tool_calls`, `reasoning`,
`tool_choice`, and `tools`. It explicitly classifies and omits only `include`,
`max_output_tokens`, `service_tier`, and `store`; all other top-level fields
fail closed. The generation snapshot is not mutated. The provider-free final
runtime's synthetic generation SHA-256 is
`50acb6893603bb0fb0927aadf4ec6b2037e7b131b47a5fce3469fd76d353cf70`;
its distinct projected-count SHA-256 is
`69909ba29b4bf7973075e86e509cd06a35f00737754e41349adcdf4b6a0a5271`.
The event sequence was exactly reserve count, count once, reserve generation,
generation once.

## Recursive Terminal Seal

The sealer requires a physical mode-0700 root and recursively sorted physical
mode-0700 directories. Files are opened no-follow and must be mode-0600 regular
files. Symlinks, special entries, physical escapes, invalid manifest names,
wrong modes, and later drift fail closed. The manifest records `.` plus nested
directories and file byte length/mode/SHA-256, excluding only itself.

The write-once seal syncs a mode-0600 temporary file, atomically hard-links it
to the absent manifest name, removes the temporary link, and syncs the root
directory. A present manifest refuses overwrite. The final-runtime nested
fixture sealed and verified 8 entries; reseal was rejected. Its time-varying
fixture manifest hash is evidence only, not a successor identity input.

## Frozen Runtime Evidence

Provider-free verification executed these actual final-runtime bindings:

- cached Ettin through a real synthetic Palari brain: titanium ranked first,
  `It is titanium.`, four finite scores, zero provider calls;
- projected fake count and untouched fake generation, each exactly once;
- durable `reserved -> launched -> consumed` attempt and reuse refusal;
- recursive nested fixture seal, verification, and reseal refusal;
- complete temporary cleanup.

Reported telemetry is exactly zero credential reads, dataset reads, provider
calls, and result writes. The clean pushed runtime closure has 49 files,
742,374 bytes, eight external `node:` specifiers, and SHA-256
`1c0a634ef908059abe68f8626656b54b1cc1e33e4ec0f0257e8afcd07f132776`.
The generated runtime imports the same ticket-root bytes measured by that
closure.

## Immutable Predecessor Evidence

Before and after final-runtime verification, consumed BRN-0025 retained:

- launcher
  `122de407ad22fd8ee720023b0bbf7aad03dd716a865d6b283968688e30560373`;
- runtime
  `8b1846493ca9835e21a91464a4885794a0b756ccaf33063ea3478fa197129dc6`;
- the exact 12 mode-0600 file hashes and 9 mode-0700 directory entries
  (root plus 8 nested directories) frozen in the v3 launcher;
- honest `sealed: false` state, with no added manifest or changed byte.

P-set 36 grading, `$7.85549929` cumulative accounting, historical `6/10`, and
sealed U8 are unchanged. BRN-0024 bytes were not touched.

## Verification

- Focused contracts: PASS, 21/21.
- `npm test`: PASS, 796 passed / 15 skipped / 0 failed across 811 tests.
- Private v3 launcher `--verify`: PASS with actual Ettin, fake paired wires,
  nested seal, one-shot custody, cleanup, zero telemetry, absent namespaces,
  and unchanged predecessor snapshots.
- Private launcher/runtime syntax and mode checks: PASS.
- `npm run quickstart`: PASS, 6/6.
- Ticket, report, committed-plus-dirty scope, private syntax/modes/hashes, and
  diff checks: PASS. Final clean/pushed-head verification follows closeout
  commit.

## Risks / Follow-Ups

Mocks and provider-free exercises establish plumbing, not live provider
acceptance or memory quality. Identity `j4-luna-ettin-unexecuted11to20-v3`
has not run and has no authority. P-set 37 opens at `$7.85549929` with proposed
`$5.00` fresh / `$12.85549929` cumulative caps. Independent review must bind
the exact clean pushed head and private hashes. Only a later exact founder
authorization may permit one live invocation.
