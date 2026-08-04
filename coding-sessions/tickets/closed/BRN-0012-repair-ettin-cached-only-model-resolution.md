---
id: BRN-0012
title: "Repair Ettin cached-only model resolution"
stream: memory
level: 1
parent_id: 
root_id: BRN-0012
children: []
status: accepted
risk: R2
priority: P0
agents_allowed: 1
claimed_by:
claimed_at:
target_branch: "main"
branch: "ticket/BRN-0012-repair-ettin-cached-only-model-resolution"
worktree: "/home/quetza/palari-brain-worktrees/BRN-0012-repair-ettin-cached-only-model-resolution"
allowed_paths:
  - "src/reranker-ettin.mjs"
  - "tests/reranker-ettin.contract.test.mjs"
  - "docs/BRAIN-API.md"
  - "docs/DECISIONS.md"
  - "STATUS.md"
  - "coding-sessions/tickets/open/BRN-0012-*.md"
  - "coding-sessions/tickets/closed/BRN-0012-*.md"
  - "coding-sessions/reports/BRN-0012-*.md"
  - "coding-sessions/human-report/BRN-0012-*.md"
  - "coding-sessions/handoffs/BRN-0012-*.md"
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
requires_review: true
verification:
  - "node --test tests/reranker-ettin.contract.test.mjs"
  - "npm test"
  - "npm run quickstart"
created: 2026-08-04
updated: 2026-08-04
---

# BRN-0012 Repair Ettin cached-only model resolution

## Goal

Make the accepted native Ettin reranker resolve its already cached tokenizer
and base transformer through a supported absolute local-directory path when
remote model access is disabled. Repair only the pre-inference loader boundary
identified by BRN-0011; retain the exact pinned model, tokenizer behavior,
native head, candidate bounds, security checks, and BRN-0009 measurements.

## Context And Authority

On 2026-08-04 Quetzali accepted BRN-0011 and directed autonomous governed
implementation, review, and validation until Ettin and Luna work without known
bugs, with only CEO-level blockers surfaced. BRN-0011 proved that
Transformers.js 4.2.0 tokenizer discovery drops the caller's `cache_dir`,
revision, and local-only options before its metadata probe. A model ID can then
miss a populated custom cache when `env.allowRemoteModels=false`; an absolute
local directory bypasses that defect.

This ticket is provider-free implementation only. A real runtime/model load,
model inference, Luna/Gemini/judge call, question execution, score, or spend
belongs to a separately frozen successor after this code passes independent
review. Terminal BRN-0010 remains an honest failed identity and is neither
rerun nor regraded here.

## Scope

- Add a deterministic resolver for the exact revision directory produced by
  Transformers.js's filesystem-cache key:
  `<cacheDir>/<model-id>/<revision>/`.
- Permit an explicit absolute `modelDir` only when it is canonically contained
  by the application-owned absolute `cacheDir`; reject relative paths, root
  equality, traversal, missing/non-directory components, symlinks, and
  canonical escapes before calling a runtime factory.
- Pass the validated absolute directory, rather than the Hub model ID, to both
  `AutoTokenizer.from_pretrained` and `AutoModel.from_pretrained`, with
  `local_files_only: true`. Retain fp32 for the model and do not rely on remote
  metadata, a mutable Hub branch, or `env.localModelPath`.
- Keep the separate exact head-artifact loader and its pinned hashes unchanged.
  Do not duplicate, copy, materialize, or transform cached model bytes.
- Add import-inert provider-free contracts proving default resolution,
  explicit-directory behavior, option shapes, network independence, symlink /
  containment rejection, missing-directory failure, lazy single loading,
  retry semantics after a failed load, and unchanged scoring/bounds behavior.
- Document the local directory contract and record the product stop rule,
  verification evidence, and fresh independent review.

## Out Of Scope

- No model/cache/dataset download, package install or upgrade, artifact copy,
  ONNX export, quantization, Python/Rust sidecar, dependency change, runtime
  migration, or cache cleanup.
- No change to the exact Ettin model/revision/dtype, tokenization call,
  transformer inference, CLS/Dense/GELU/LayerNorm/Dense math, head weights,
  ranking seam, candidate/input bounds, or BRN-0009 metrics.
- No real Transformers.js import or model/tokenizer load, local inference,
  provider/credential access, Luna/Gemini/judge request, LongMemEval question,
  prediction/grade/result mutation, sealed U8 access, benchmark rerun,
  publication, or spend.
- No BRN-0010 acceptance, merge, retry, reroll, regrade, or reinterpretation.
- No success criterion that depends on a 10/10 benchmark result; scored quality
  is evaluated once under a fresh preregistered successor and reported as-is.

## Acceptance Criteria

1. The default revision directory is derived exactly from the frozen model ID
   and revision below `cacheDir`; callers may inject a different absolute path
   only within that same root.
2. Every existing component from cache root through model directory is a
   non-symlink directory and the canonical model directory stays strictly
   below the canonical cache root. Failure precedes runtime/head/network use.
3. Both runtime factories receive the validated absolute directory and
   `local_files_only: true`; only the base model receives `dtype: "fp32"`.
   Neither receives the model ID, cache directory, or revision as a remote
   discovery request.
4. The adapter remains lazy, import-inert, deterministic, bounded, immutable,
   and fail-closed. Concurrent/successive calls share one successful load;
   failed initialization remains a stable failure and cannot partly load.
5. Direct contracts reproduce the BRN-0010 configuration with fakes and prove
   that remote metadata is unnecessary, while rejecting relative, escaped,
   missing, non-directory, and symlinked model paths.
6. Focused tests, full suite, quickstart, package dry-run, ticket/report/scope/
   diff checks are green with zero model/provider/credential/spend activity.
7. A fresh independent reviewer inspects the committed diff and recommends
   accept with no P0-P3 finding before delegated acceptance or merge.

## Verification

- `node --test tests/reranker-ettin.contract.test.mjs`
- `npm test`
- `npm run quickstart`
- `npm pack --dry-run`
- `npm run ticket -- ticket-lint-all`
- `npm run ticket -- report-lint BRN-0012`
- `npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0012`
- `git diff --check main...HEAD`

## Stop Conditions

- Stop if the work needs a path outside `allowed_paths` or touches `forbidden_paths`.
- Stop before any real model/tokenizer load, inference, download, install,
  credential/provider activity, scored question, result change, or spend.
- Stop rather than weaken canonical containment, symlink rejection, frozen
  identity, local-only operation, or fail-closed behavior.
- Stop for founder direction if a correct fix requires changing model math,
  adding a runtime/dependency/service, touching BRN-0010 private evidence, or
  widening beyond this loader boundary.
