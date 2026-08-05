# BRN-0020 Terminal Reviewer Note

## Review Result

Independent terminal review began from exact clean pushed result-recording head
`723ec3e0f67a5f6fe34892868afdbdc3d580a35e`. The tracked custody disclosure
was rereviewed at exact clean pushed head
`3a8327228fa60205c8e713359924576a11063404`, and the final exactly-once
judgment closure was rereviewed at exact clean pushed head
`df5dd0aab6b67871a6567d8ec754a7cdfdadc0d0` against target `main` at
`b7fc4121dcb55d5e3384572941769d519228a2ea`.

The first pass reopened one P2 post-seal custody finding and one P3 stale
wire-count phrase. The tracked-only repairs disclose both without altering the
consumed result, preserve the exactly-once Phone judgments, and close the only
remaining future-judgment instruction. Final rereview found no P0, P1, P2, or
P3 issue and recommends **ACCEPT**. This recommendation does not accept, close,
merge, publish, rerun, regrade, or authorize cleanup of the ticket.

## Findings

None remain at final head `df5dd0aab6b67871a6567d8ec754a7cdfdadc0d0`.

The first-pass findings and their disposition are retained as terminal custody
evidence:

- P2, disclosed: after the terminal seal, a provider-free canonical comparison
  opened copied Phone and Instant Pot SQLite databases in place with
  `DatabaseSync({ readOnly: true })`. SQLite retouched the already-manifested
  Phone SHM timestamp and created unmanifested Instant Pot SHM/WAL sidecars.
  The added mode-0600 SHM has SHA-256
  `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb`;
  the added empty mode-0600 WAL has SHA-256
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  The SHM bytes equal an already sealed and credential-scanned SHM artifact,
  and the WAL is empty. All 16 manifested result artifacts and copied main
  database bytes remained exact. The tracked record no longer claims a closed
  physical artifact set, preserves the sidecars as evidence, and requires all
  future SQLite inspection to copy bytes outside the sealed namespace before
  opening them.
- P3, clarified: P-set 30's immutable phrase “six-tool wire” is a stale count.
  The frozen normal-tool hash and all seven completed OpenAI request bodies
  bind six memory tools—timeline, read, find, plan, search, and graph—plus
  `palari_answer_commit`, seven total. The stale preregistration wording was
  preserved and clarified in tracked terminal evidence; completion already
  failed independently.

## Exactly-Once Semantic Judgment

The first terminal review applied Phone's two preregistered semantic labels
exactly once from the sealed raw trace. Later rereviews reused these labels and
did not judge them again.

- Equivalent-fact recall: **PASS 1/1** for fact
  `phone-user-has-portable-power-bank`. The returned canonical record is the
  original user statement identifying “my new portable power bank,” so it
  directly establishes the equivalent fact that the user has that power bank.
- Materially-used evidence: **PASS 1/1** for evidence ID
  `dialogue_5cfaaa3c5d64c1ca388b37699c83f227652b14b628eb13e9dd7105935cd48e32`.
  The committed answer explicitly says, “Since you have a portable power bank,
  keep it charged as a short-term backup.” That personalized recommendation
  directly realizes the declared consequence and would not be present without
  the recalled memory.

These are tracked independent-review labels, not canonical memory truth and not
sealed-bundle fields. The sealed semantic records correctly remain
`pending`/null.

## Independent Reconciliation

- The private terminal manifest independently rehashed to
  `a039a12a580545c2a048abdad017d0cfd7a3c569f8ac593edc74a7ce67f8c6a6`.
  All 16 listed result artifacts rehashed exactly at mode 0600; terminal report
  and artifact hashes reconcile; credential matches and sealing errors are
  empty. The post-seal sidecars are disclosed separately above and are not
  misrepresented as sealed artifacts.
- All 74 BRN-0017 source artifacts rehashed exactly at mode 0600 under source
  manifest
  `850ca10026e7800dcaaa69eab482561d4eb0fe5db17e1a05b6fdb361a5959ebe`.
  Smoke, Phone, and Instant Pot copied main databases were byte-identical to
  their sealed sources. Phone's before/after canonical hashes remained equal;
  the inspection that confirmed canonical integrity caused the disclosed
  post-seal sidecar custody issue, not a live-run write.
- Authority commit `5c2713b35d5f5de4dd105233f3cc510f94ab8898` is an
  ancestor of the result head. The frozen mode-0600 launcher rehashes to
  `09d53ecb96da1902abae2de0ab1544f952e9ab894a4b44a10f0bc0b6d2c79391`,
  exactly matching FINAL P-set 30.
- The meter contains seven completed HTTP 200 OpenAI calls and three completed
  HTTP 200 Gemini embedding calls whose accepted wire reports no usage. Every
  OpenAI request and response uses `gpt-5.6-sol`, low reasoning, 512 maximum
  output tokens, `store: false`, serial tool calls, and Standard/default service
  tier. Request-body/transcript hashes, exact tool hashes, response status, raw
  typed usage, byte/output/reservation bounds, and per-call prices reconcile.
- OpenAI usage sums to 21,745 input, 715 output, 22,460 total, 12,915 cached,
  8,809 cache-write, and 70 reasoning tokens. Transport latency sums to
  22,614.3 ms. Measured spend is `$0.08306875`; three UTF-8-byte Gemini
  reservations contribute `$0.00002310` uncertain, for `$0.08309185` fresh
  accounted and `$7.75502179` cumulative accounted spend. Meter, report,
  terminal pointer, and caps agree exactly.
- Dispatch order is one smoke with two OpenAI turns and one Gemini embedding,
  Phone with two OpenAI turns and one Gemini embedding, then three Instant Pot
  OpenAI turns and one Gemini embedding. There is no retry, forced-call repair,
  extra dispatch, official judge, writer, Tokyo cell, or Miami cell. The next
  Instant Pot model reservation was refused by the pre-transport cap check; no
  later meter reservation or transcript exists.

## Terminal Outcome

- Compatibility smoke passed with the committed answer “The compatibility
  color is indigo.”
- Phone completed. It returned the exact original user power-bank statement,
  selected it, declared its consequence, and materially used it in the final
  answer. Structural session and exact-span recall and both independently
  judged semantic labels are `1/1`.
- Instant Pot registered the general `before` plan anchored on getting the Air
  Fryer, called `memory_timeline`, and requested `memory_search`. The embedding
  call completed, but the next model dispatch was refused before transport by
  the hard fresh cap. Instant Pot has no terminal answer.
- Tokyo and Miami were not reached. P-set 30 exact-source and completion goals
  are therefore incomplete/failed findings, not authority for a retry or
  replacement identity.
- This incomplete diagnostic creates no official benchmark score. Historical
  BRN-0017 remains exactly 6/10 and was not rerun, regraded, or changed.

## Verification Reviewed

- First-pass terminal audit: all result/source hashes, modes, transcripts,
  calls, usage, spend, caps, source copies, semantic labels, and terminal grades
  reconciled as described above.
- Final tracked-only rereview: the exact branch and upstream both equaled
  `df5dd0aab6b67871a6567d8ec754a7cdfdadc0d0`; ticket lint, report lint,
  committed-plus-dirty scope, and target-aware `git diff --check` passed.
  Full tests remained 727 passed, 0 failed, and 15 optional skips across 742;
  quickstart remained 6/6.
- The final rereview did not access the private result namespace, open any
  sealed SQLite database, read `.env` or credentials, use network/provider or
  local inference, mutate any result, or perform live activity or spend.

## Required Changes

None.

## Recommendation

Accept the tracked BRN-0020 terminal record through the founder-authorized
governed flow. The identity is consumed: do not delete or alter the disclosed
sidecars, repair or reseal the bundle, rerun or replace the identity, regrade
historical BRN-0017, or rejudge Phone's exactly-once semantic labels. This note
does not itself accept, close, merge, or authorize cleanup.
