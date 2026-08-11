# STATUS — Palari alpha

## 2026-08-11 current handoff

Release `v0.1.0-alpha.1` remains an annotated, immutable recovery tag. The
active branch has been reduced to the product kernel, useful local diagnostics,
and current documentation without rewriting Git history.

The cleanup:

- fixes the installed `palari-brain/openai` subpath by packaging its required
  `src/retrieval-plan.mjs` module;
- preserves all 140 declared public export names across six package entry
  points;
- stops shipping an unreferenced master raster and historical kernel docs;
- removes the superseded ticket/report archive, spent process contracts,
  v0.5 comparison arms, J3/J4 live-run machinery, and their dedicated tests;
- retains the reusable alpha runner, answer regression, stage audit, scale
  probe, embedding cache, request pacer, retrieval metrics, and reranker
  verification;
- leaves private datasets, result artifacts, credentials, local diagnostics,
  dependency installs, and generated native build output untouched.

The tracked checkout fell from 580 files / 7,644,715 bytes to 97 files /
2,568,292 bytes. The release tarball fell from 38 files / 1,305,932 packed
bytes to 35 files / 981,986 packed bytes. The remaining large tracked files
are current product/tests or deliberate raster brand sources; the unused
master mark is repository-only and excluded from the release package.

Post-cleanup validation passes: core 106/106, quickstart 6/6, broader
compatibility 390/390, and a clean offline tarball install imports all six
public entry points with their original export-name hashes. Static import and
local-link checks report no missing target. No provider, credential, dataset,
private result, local diagnostic, or sealed U8 item was accessed.

## Product state

The basic journey remains:

```text
say something worth remembering -> store -> recall later -> correct/delete
-> behave correctly afterward
```

The active product uses canonical role- and time-labelled dialogue, a bounded
digest, exact/semantic/temporal retrieval, canonical evidence read-back, and
host-validated answer commitments. Durable memory admission and user/workspace
isolation remain hard boundaries.

## Commands

```bash
npm test
npm run quickstart
npm run test:legacy
npm run alpha:debug -- --adapter <module> --max-dollar <cap>
npm run answer-interpretation-regression
npm run memory-stage-audit -- --input <local.json>
npm run scale-probe
```

## Next

Take the next smallest product-memory behavior unit from real user feedback.
Future paid diagnostics require a new explicit aggregate cap. Do not replay
sealed or already-successful benchmark cases merely to tune them.
