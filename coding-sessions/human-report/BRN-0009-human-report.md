# BRN-0009 Human Report

## Why This Mattered

Ettin looked like the best small local reranker, but its official ONNX file
stops before the final scoring layers. BRN-0008 proved that honestly instead
of pretending hidden states were relevance scores. This ticket adds those
exact missing layers locally, without Python or an API.

## What Changed

Palari now has an explicit `createEttinReranker()` module. It verifies the
three small official head files by exact hash, reads only their expected
tensors, and computes the official CLS -> Dense/GELU -> LayerNorm -> Dense
score. It cannot alter memory evidence; it only supplies locating scores to
the existing canonical reranking boundary.

On the frozen ordering test, Ettin put the right memory first 14 of 15 times,
kept all 15 within the top five, and averaged about 26 ms per case after
loading. The previous fastest default, MiniLM-L6, achieved 13/15 at about
45 ms. Provider spend was `$0.00`.

## What I Should Know

The remaining miss asks which event was latest. That should stay a trusted
timestamp decision, not something we train a semantic scorer to guess.

The model is local after its first download, but Palari does not bundle its
68 MiB cache or the optional Node ONNX runtime. Applications enabling it own
that runtime and cache. Palari continues working with its existing RRF order
when reranking is omitted.

## What To Check

Independent review should verify the exact artifact hashes and tensor math,
that CLS rather than mean pooling is used, malformed/corrupt data fails before
scoring, only one smoke and one bank pass occurred, all external bytes stayed
outside git, and Ettin truly dominates the prior measured models.

## Recommended Next Move

Accept BRN-0009 if review is clean and use `createEttinReranker()` as the
recommended optional local reranker. Keep chronology deterministic. A future
end-to-end answer evaluation remains a separate founder-gated unit.
