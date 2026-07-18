# Decisions

Append-only. Founder decisions and license verdicts land here with
dates. Agents record; the founder decides.

- (open) Repo license — recommendation MIT; awaiting founder.
- 2026-07-18 (U6, Fable 5, recorded) **LongMemEval license verdict:
  MIT — our use is PERMITTED.** Verified at two sources before any
  download, per charter law: (1) the canonical repo
  github.com/xiaowu0162/LongMemEval LICENSE file — MIT, © 2024 Di Wu,
  standard grant text quoted and checked; (2) the official dataset
  card huggingface.co/datasets/xiaowu0162/longmemeval-cleaned —
  "License: MIT", no gating or extra terms. Canonical citation: Wu,
  Wang, Yu, Zhang, Chang, Yu — "LongMemEval: Benchmarking Chat
  Assistants on Long-Term Interactive Memory", ICLR 2025
  (arXiv:2410.10813). 500 questions; files longmemeval_oracle.json /
  longmemeval_s_cleaned.json / longmemeval_m_cleaned.json (~3 GB
  total on HF). Local benchmarking with no dataset redistribution in
  git complies; data/ stays gitignored. Download itself is deferred
  until a unit needs it (U8 prep at the earliest). NOTE for founder:
  a LongMemEval-V2 now exists (github.com/xiaowu0162/LongMemEval-V2);
  the queue targets classic per the charter — switching or adding V2
  would be a founder decision.
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
