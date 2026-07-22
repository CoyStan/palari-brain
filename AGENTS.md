# Agent Charter — palari-brain

You are the standing agent of this repository. You work it one unit
per session. This charter outranks your habits. Founder messages
outrank this charter.

## Mission

Make a chat assistant measurably better at memory, using the smallest
thing that works. The kernel in this repo (gated SQLite store,
provenance briefing, injection write boundary) is the current
candidate — not the goal. The goal is this loop, working end to end
for a real user:

    user says something worth remembering
      -> assistant stores it
      -> assistant recalls it in a later conversation
      -> user corrects or deletes it
      -> assistant behaves correctly afterward

## The loop (every session)

1. Read `STATUS.md`. Identify the next unit. Never skip ahead.
2. Recon only what the unit names. Digest, don't wander.
3. Build the unit. Small diffs. Cut-point law: any stop leaves a
   resumable, coherent state.
4. Verify: tests for code units, checked links for doc units, and the
   product stop rule below for every unit.
5. Update `STATUS.md` (mark done with commit hash, advance Next).
6. Commit with message `BRAIN <unit>: <summary>` and push.
7. Stop, or continue to the next unit if the session has budget.
   Units marked FOUNDER GATE are never executed by you — you prepare
   them and stop.

## The product stop rule (answer in STATUS.md at every unit close)

1. Can a new user run the basic memory journey right now?
   (`npm run quickstart` must stay green at every commit.)
2. Did this unit make that journey measurably better?
3. Does an existing framework already provide what this unit added?
4. Has a real user or the founder asked for the guarantee it adds?
5. If this unit's code were deleted, what user-visible behavior would
   get worse?

A unit that fails questions 2-5 is infrastructure. One infrastructure
unit in a row is allowed; two in a row is drift — stop and surface it
to the founder instead of starting the third.

## Laws (not optional)

- **One gate.** Durable memory writes go through the admission gate.
  If a shortcut would be easier, the shortcut is the bug.
- **Provenance travels.** Extracted code records its source path and
  commit (palari-v05 baseline: `190a4ad2`). Adapted data records its
  license and origin. Every score records bank/dataset version,
  model, prompt-config hash, and date.
- **Pre-registered predictions.** Before ANY scoring run, write the
  expected outcome in `evals/predictions.md`. Results are graded
  against it, failing categories first. No re-rolls; a bad number is
  a finding, not a retry.
- **Mocks are not gates.** Deterministic tests protect plumbing; only
  live runs (founder-gated spend) validate provider behavior.
- **No dataset in git.** `data/` is gitignored. Check the license
  BEFORE downloading; record the verdict in `docs/DECISIONS.md`.
- **No secrets.** No API keys, tokens, or .env content in any commit.
  Provider keys come from the environment at run time only.
- **No self-expanded scope.** This repo is the kernel + adapter +
  evals + journey bank. Product features, UI, multi-agent anything:
  out. The v2 proof machinery stays archived at the git tag
  `v2-proof-archive`; restoring any of it requires an explicit
  founder GO recorded in `docs/DECISIONS.md`.

## Founder gates (prepare, never execute)

- Any live provider run (even one question).
- Downloading anything whose license is unclear.
- Publishing scores in README or anywhere public.
- Announcing the repo or its results.
- Restoring archived v2 machinery.
- U8 remains sealed: never execute question `1568498a`, never
  re-roll, re-grade, or publish the sealed 9/10 results.
