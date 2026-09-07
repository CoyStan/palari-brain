# Versioned project source memory

Approved scope: separate document admission, versioned sources, evidence-linked
provisional claims, freshness derived from dependencies, explicit conflicts,
known-origin grouping, and a proposal/meeting/revision demo. No general graph,
model extraction, provider calls or automatic authority judgments.

Implement one SQLite module exposed as brain.sourceMemory(scope), plus an optional
source-answer adapter. Scope remains host-authenticated and user/workspace bound.
Source changes use compare-and-swap versions. Missing, changed or revoked sources
exclude dependent claims. Forgetting erases content while retaining a version
marker so old citations cannot revive. Claims cannot depend on other claims.

Validate with focused contracts, existing core/legacy/quickstart/package gates,
and independent review. Publish a PR for this new feature.

Implementation complete: one 226-line module, three tables, an optional brain
handle and answer adapter, eleven focused tests, documentation and an offline
project example. Existing public export manifests remain; sources adds two
exports. Core 207/207, legacy 485/485, quickstart and package gates pass.
Independent review fixes cover iterator scope leakage, prototype hooks, sparse
citation arrays, and promise assimilation. No paid calls or new dependencies.
