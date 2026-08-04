---
id: BRN-0011
title: "Research supported Ettin local integration"
stream: research
level: 1
parent_id: 
root_id: BRN-0011
children: []
status: claimed
risk: R1
priority: P0
agents_allowed: 1
claimed_by: "quetza"
claimed_at: 2026-08-04T02:54:46Z
target_branch: "main"
branch: "ticket/BRN-0011-research-supported-ettin-local-integration"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0011-research-supported-ettin-local-integration"
allowed_paths:
  - "docs/ETTIN-INTEGRATION-RESEARCH.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0011-*.md"
  - "coding-sessions/tickets/closed/BRN-0011-*.md"
  - "coding-sessions/reports/BRN-0011-*.md"
  - "coding-sessions/human-report/BRN-0011-*.md"
  - "coding-sessions/handoffs/BRN-0011-*.md"
forbidden_paths:
  - ".env"
  - ".env.*"
  - "*.key"
  - "**/*.key"
  - "secrets/**"
  - "**/secrets/**"
  - "*secret*"
  - "**/*secret*"
  - "*token*"
  - "**/*token*"
  - "infra/prod/**"
  - "prod/**"
  - "runtime-data/**"
  - ".palari-probe/**"
  - ".palari-regression/**"
  - "data/**"
  - "evals/results/**"
requires_human_confirmation: false
requires_review: false
verification:
  - "All cited URLs resolve to primary upstream sources"
  - "npm run quickstart"
  - "npm run ticket -- ticket-lint-all"
created: 2026-08-04
updated: 2026-08-04
---

# BRN-0011 Research supported Ettin local integration

## Goal

Determine the upstream-supported, lowest-complexity way to run the exact
Ettin-17M cross-encoder locally and offline in Palari, before writing another
adapter or authorizing another model inference. Explain why BRN-0010's cached
Transformers.js tokenizer load failed and recommend reuse, export, or a minimal
boundary based on primary evidence rather than a new bespoke implementation.

## Context And Authority

On 2026-08-04 Quetzali proposed searching online for how others use Ettin more
effectively and explicitly suggested a research ticket. BRN-0010 is a terminal
private compatibility failure pending founder acceptance; this ticket may read
its tracked/private diagnosis but cannot change, rerun, merge, accept, or
regrade it. Research authority includes public web/repository reads only.

## Scope

- Read at least eight primary upstream artifacts across the Ettin model repo,
  Sentence Transformers CrossEncoder implementation/docs, its ONNX export and
  local-files behavior, Hugging Face Transformers/Optimum, and Transformers.js
  model/cache resolution.
- Find real Ettin usage in public repositories when available; distinguish
  copied snippets from maintained integration code and count unique projects,
  not search hits.
- Reconstruct the official runtime graph: tokenizer, base transformer, pooling,
  modular scoring head, expected model API, revision, backend, cache layout,
  and offline flags.
- Compare three implementation choices: official Python Sentence Transformers
  sidecar/process, one-time officially supported export to a self-contained
  ONNX/logits artifact, and Palari's current native-JavaScript modular head.
- Evaluate quality fidelity, cold/warm latency, installation size, license,
  dependency/audit risk, offline determinism, failure modes, maintenance, and
  packaging for a low-latency Palari deployment.
- Trace BRN-0010's `tokenizer_class` exception against upstream source and state
  whether cached-only mode, cache layout, missing config, API misuse, or a
  version defect is proved, likely, or unresolved.
- Produce `docs/ETTIN-INTEGRATION-RESEARCH.md` with linked primary evidence, a
  decision table, explicit unknowns, and the smallest recommended next ticket.

## Out Of Scope

- No code, dependency, model/cache, dataset, ticket-result, or private launcher
  change.
- No model download, Python/package install, inference, smoke, benchmark,
  provider call, credential read, spend, or network write.
- No BRN-0010 acceptance/merge/rerun and no successor live identity.
- No recommendation based mainly on blogs, generated summaries, benchmark
  leaderboards without implementation detail, or one unverified code snippet.

## Acceptance Criteria

1. Every material technical claim links to primary upstream documentation,
   source, issue, release, commit, or maintained repository code.
2. The report explains the exact supported Ettin execution path and the exact
   mismatch behind BRN-0008/0009/0010 without claiming more causality than the
   evidence supports.
3. At least eight upstream artifacts and every discoverable substantive public
   Ettin integration are classified; empty/duplicate search results are not
   presented as adoption.
4. The option matrix makes a single recommendation for Palari and names the
   rejection reason for each alternative, including whether Python is actually
   necessary and whether an official self-contained ONNX export is possible.
5. The recommended next step is offline, generic-data-only, reversible, and
   explicitly requires a separate founder decision before implementation or
   any inference.

## Verification

- Check every cited URL directly.
- `npm run quickstart`
- `npm run ticket -- ticket-lint-all`
- `npm run ticket -- report-lint BRN-0011`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0011`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any download, install, inference, provider/credential activity,
  private result mutation, or implementation.
- Stop and report uncertainty if primary sources do not establish a supported
  JavaScript/offline path; do not fill the gap by inventing one.
