# BRN-0004 Human Report

## Why This Mattered

Palari was already architecturally provider-neutral, but Gemini was the only
generation provider with a ready product adapter. The founder asked to make
the cheaper, low-latency GPT-5.6 Luna tier usable without turning OpenAI into a
second memory system or weakening Palari's trust boundaries.

## What Changed

The package now has a `palari-brain/openai` entry point. It supplies the exact
documented `gpt-5.6-luna` model ID, one-shot Responses API transport, bounded
memory-tool answer loop, active-memory reducer, and optional temporal-graph
extractor. The OpenAI key is passed explicitly and appears only in the
Authorization header. The module never reads `.env`, calls a provider on
import, retries, or stores a response at OpenAI (`store: false`).

OpenAI only proposes. Palari still executes every retrieval, verifies every
quote, assigns scope/speaker/time/provenance, admits reducer actions, and
admits graph edges. The answer continuation preserves the complete Responses
output—including GPT-5 reasoning items—before adding host-owned tool results.
For `store: false`, it explicitly requests and replays encrypted reasoning
content rather than relying on an unstored response ID.
The reducer can make one distinct correction after a host rejection; it cannot
lower the admission bar or retry an identical request.

## What I Should Know

No live Luna call happened in this ticket. The existing ignored key was not
read or rewritten, and spend is exactly $0.00. The 14 focused tests use fake
transports and the real Palari host. They prove composition and failure
behavior, not that this account can call Luna or that the provider accepts
every wire live.

Luna does not create embeddings. Palari can keep its existing Gemini embedder
for semantic search while using Luna for writing, answers, and graph
extraction. Changing embedding models later means rebuilding the derived
vector index, not the canonical dialogue.

The first independent review caught four problems before merge: stateless
reasoning content was not requested, callers could raise three hard ceilings,
several rejection paths lacked tests, and the evidence report overstated one
check. All four were repaired. The official docs lookup did use external
documentation network access despite an overbroad ticket stop phrase; that
process deviation is recorded explicitly. It was not a provider API call and
used no key or spend.

## What To Check

Focused contracts are 14/14. The full repository is 664 pass, 0 fail, 15
skipped across 679 tests. Quickstart completes all six steps, trust remains
5/5, package dry-run includes the OpenAI module, and the entire change stays
inside BRN-0004's declared paths. A fresh reviewer should concentrate on key
placement, fixed endpoint, reasoning-item continuation, dispatch/response
caps, and the unchanged host admission gates.

## Recommended Next Move

After independent review and founder acceptance, merge this offline adapter.
Then open a small founder-gated successor that preregisters and runs only the
minimum live compatibility ritual under a hard cap. Do not rerun LongMemEval
or claim a Luna quality/cost win from this offline unit.
