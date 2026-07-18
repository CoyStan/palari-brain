# Decisions

Append-only. Founder decisions and license verdicts land here with
dates. Agents record; the founder decides.

- (open) Repo license — recommendation MIT; awaiting founder.
- (open) LongMemEval dataset license verdict — to be researched in U6.
- 2026-07-18 (U3, Fable 5, recorded) Test runner is node:test +
  node:assert, zero dependencies — "the kernel is the code" wants a
  minimal proof surface (`git clone && npm test`, nothing but Node).
  Cost accepted: v05's vitest memory tests are re-homed by rewriting
  (U1 showed 2 of 6 needed rewriting anyway). Binds U4/U5/U7.
- 2026-07-18 (U3, Fable 5, recorded) Engine floor Node >=22.5 for
  node:sqlite + FTS5 unicode61; verified on v22.22.2 (works unflagged,
  one ExperimentalWarning — a known, self-probed risk: the baseline
  driver probe throws early on tokenizer mismatch). Do not swap to
  better-sqlite3 silently; that would be the repo's only non-builtin
  dependency and needs its own recorded decision.
