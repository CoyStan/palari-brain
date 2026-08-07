# BRN-0025 Technical Report

## Files Changed

- `evals/generated-runtime-verifier.mjs` validates required final-runtime
  definitions/calls and executes one bounded provider-free child mode.
- `tests/generated-runtime-verifier.contract.test.mjs` permanently reproduces
  the BRN-0024 helper deletion and all fail-closed output/telemetry cases.
- `evals/predictions.md` registers FINAL P-set 36 without changing P-set 35.
- `docs/EVALUATION-HARNESS.md` and `docs/DECISIONS.md` record the new boundary.
- Ticket reports, handoff, and `STATUS.md` record the offline freeze.

New private, gitignored mode-0600 artifacts:

- `/home/quetza/palari-brain-private/luna-ettin-unexecuted11to20-v2-live-launcher.mjs`
  — SHA-256 `122de407ad22fd8ee720023b0bbf7aad03dd716a865d6b283968688e30560373`.
- `/home/quetza/palari-brain-private/luna-ettin-unexecuted11to20-v2-live.runtime.mjs`
  — SHA-256 `8b1846493ca9835e21a91464a4885794a0b756ccaf33063ea3478fa197129dc6`.

The successor result namespace now exists, is consumed, and is unsealed after
the one authorized invocation. The semantic-review namespace remains absent.
The launcher derives and rehashes the complete transitive static import and
reexport closure from one exact clean ticket root: 48 files, 732,601 bytes,
SHA-256 `021cf118dec74f5611f5578488dbf86c5b11f996c0cec1a25ba6a680a8e2960d`.
The generated runtime imports those same ticket-root bytes. Sealed U8 is
explicitly excluded from the fixed population.

## Defect Reproduction And Repair

The permanent regression inserts `runLocalSmoke`, then replaces the
overlapping region from `measuredSpend` through `sourceSession`. The call
remains while the definition disappears. `node --check` passes; the new
verifier's ephemeral same-directory instrumented module fails before producing
the nonce-bound structural proof. Comments, strings, duplicate definitions,
and a hard-coded successful telemetry report are permanent failing cases.

The successor composer starts from the exact consumed runtime bytes, changes
only the identity/imports/mode boundary needed by this ticket, restores the
local-smoke helpers after every inherited transformation, and writes a new
runtime exclusively. Its offline mode creates a temporary synthetic Palari
brain, loads the exact cached Ettin runtime with remote models disabled and a
throwing fetch, ingests four synthetic mug statements, and executes one real
rank. The titanium memory ranks first, the answer is `It is titanium.`, all
four scores are finite, and the temporary workspace is removed.

The successor launch protocol writes and syncs `reserved`, then atomically
replaces it with `launched` before spawn. The generated runtime owns one actual
durable `consumeLaunchedAttempt(path)` function. Live `run()` calls it before
preflight. Offline verification invokes the same binding against a temporary
reserved/launched attempt, reopens its durable consumed bytes, calls it again
to prove reuse rejection, and removes the temporary state. No lexical source
claim or launcher-side simulation remains.

Review authority is satisfiable without a tracked self-hash. The note carries
exact identity, launcher hash, runtime hash, and PENDING/ACCEPT disposition;
it never claims its own HEAD. After implementation acceptance, a marker-only
attestation commit changes PENDING to ACCEPT, and a final out-of-band exact-head
rereview must validate that commit. The launcher separately requires current
clean pushed HEAD to equal founder-supplied `reviewedHead`, so exact-head
authority remains mandatory.

The tracked verifier executed those final private runtime bytes with a
180-second timeout and 64-KiB output bound. Accepted telemetry was exactly:

```json
{
  "credentialReads": 0,
  "datasetReads": 0,
  "providerCalls": 0,
  "resultWrites": 0
}
```

At the offline-freeze cut point, no `.env`, credential, dataset content,
selected session/question/answer, provider, result namespace, semantic
judgment, or spend was accessed. The later terminal invocation is recorded
separately below.

## Immutable BRN-0024 Evidence

Before and after implementation/verification, the exact SHA-256 values are:

- launcher: `2ffb3d7a414008a74b9c61eaa1aca1db0240ef33fd155a6adb060863b2488459`
- runtime: `b49c6f8c38d08271933daa415f19037fd7055ede3711bb5d27371c42aaadca81`
- artifact manifest: `9287d3a235b390b63133482366d1aa5db84a80b8903f41c41be7b1e90e86c768`
- launcher attempt: `e2cc9907b3d5ee61879c64a51e229c624432fe32aff66374d12d7ef15bbcc7de`
- launcher result: `a32b3293e20bb196121fcc428e78dffc438356db85affb6b0808d1035ff2884f`
- meter: `14db06670a77a177f173b58ac7b3758aee1ee9ef4030b8a5b834471e83429496`
- started marker: `54250027459b7c4ef01cfcaf5a1c9d8c62235f8e0ab4119081c658df8b2f8ef0`

Every listed BRN-0024 private file remains exact mode 0600. P-set 35 terminal
grading, historical `6/10`, and sealed U8 are unchanged.

## Terminal Invocation

The founder authorized identity `j4-luna-ettin-unexecuted11to20-v2` once under
the `$5.00` fresh / `$12.80502179` cumulative caps at exact reviewed head
`782dc2212a7bc0b64c416dafeceebafefc41236f`, launcher SHA-256
`122de407ad22fd8ee720023b0bbf7aad03dd716a865d6b283968688e30560373`,
runtime SHA-256
`8b1846493ca9835e21a91464a4885794a0b756ccaf33063ea3478fa197129dc6`,
and review `ACCEPT`. The attempt was reserved at
`2026-08-07T03:18:45.492Z`, launched at `.497Z`, and consumed at `.627Z`.
That identity cannot be reused.

The real cached-Ettin smoke passed: titanium ranked first, four scores were
finite, and provider telemetry was zero. The credential environment loaded.
The Gemini writer smoke then passed one HTTP 200
`gemini-3.5-flash-lite` request using 525 input and 128 output tokens, for
measured spend `$0.0004775`. The first Luna answer-smoke input-count request was
made once and returned HTTP 400 before generation:
`Unknown parameter: 'include'.` The provider identified parameter `include`
and code `unknown_parameter`. The runtime exited 1. No generation, successful
answer smoke, question, judge, score, semantic label, or retry followed. The
terminal report is `failed`, with `questions: []` and `compatibility: null`.

The meter records `$0.0004775` measured plus `$0.05` uncertain count-attempt
spend. Fresh accounted is `$0.0504775`; cumulative accounted advances from
`$7.80502179` to exactly `$7.85549929`. Both caps held.

After the runtime failure, the launcher failed terminal artifact enumeration:
it treated the expected top-level `transcripts/` directory as a candidate file
and rejected it for not having file mode 0600. No manifest was produced. The
terminal namespace is therefore **UNSEALED** and must not be sealed after the
fact. The immutable snapshot has 12 files at mode 0600 and 8 directories at
mode 0700. File-list SHA-256 is
`1785c7876fad8b3c01092e4c6649ac34371364a5b0365f511aa47c681cbc8b87` and
directory-list SHA-256 is
`0667cf1f4354d7f3f618b2605e851591996a9043711da22807e13f4259fe878f`.

Key immutable hashes supplied for terminal reconciliation are:

- meter:
  `deffd6c921c973f9c5cbdf5569bbc380789f8385fb5e913134607a1300c9d4e6`
- report:
  `a0328794a29d3c1a8cc3576fee7ad190301c3b2f5fbd870ea859a540ef4c1214`
- attempt:
  `59fef1f5fe5a92b6ffa9c5b23f11b642b89ce03ccd548ef80f5fa5be22945a39`
- launcher result:
  `fcda16576b70948533191a122672881319be8edec4ac0a5d5509f663617591cb`
- OpenAI transcript:
  `1aa4e36c8cfb15713fd41724c084d7403fc47de10987a813216647507cf9b24e`
- Gemini transcript:
  `2979a07c685d6ce311a3213e00e6f21a59ecc2a88ec22d3366748baaf140e286`

P-set 36 grades all numeric and question-level behavioral categories NOT
REACHED / FAIL. Execution/accounting passes the first-failure stop and cap-hold
branches but fails its seal requirement. Writer compatibility alone passed.
Zero rows mean materially-used and equivalent-fact judgments are inapplicable;
no overlay is created. Historical `6/10` and U8 remain unchanged.

## Verification

- `node --test tests/generated-runtime-verifier.contract.test.mjs`: PASS,
  13/13.
- private successor launcher `--verify`: PASS; real synthetic cached-Ettin
  smoke, finite 4/4 scores, expected ordering/answer, temporary cleanup, exact
  zero external-activity telemetry.
- `npm test`: PASS, 788 passed / 15 skipped / 0 failed across 803 tests.
- `npm run quickstart`: PASS, 6/6.
- `node --check` for launcher/runtime/verifier: PASS.
- ticket, report, committed-plus-dirty scope, and diff checks: PASS at handoff.
- post-terminal tracked-record verification: focused contracts 13/13; full
  tests 788 pass / 15 skip / 0 fail across 803; quickstart 6/6; ticket, report,
  governed scope, and diff checks PASS. No provider or private-runtime command
  was executed during this verification.

## Risks / Follow-Ups

Independent terminal review remains PENDING. It must treat the unsealed state
as terminal truth, reconcile the exact snapshot and accounting, and must not
inspect benchmark content, mutate private bytes, add semantic labels, or seal
the namespace after the fact. The answer-count compatibility failure and the
directory-walk sealing defect require a new governed ticket and a separately
identified successor; this consumed invocation cannot be retried or repaired.
