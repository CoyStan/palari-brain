# BRN-0012 Human Report

## Why This Mattered

Palari's fast local Ettin scorer already worked, but the first Luna validation
stopped before inference because Transformers.js looked for tokenizer metadata
in the wrong cache location when networking was disabled.

## What Changed

Palari now points Transformers.js directly at the exact pinned local model
directory. It validates that directory is existing, contained inside the
application cache, canonical, and free of symlink components before loading
anything. Both tokenizer and model are explicitly local-only.

## What I Should Know

No ranking math, model, tokenizer behavior, evidence, or benchmark score was
changed. The repair does not download or copy a model. A consumer must already
have the exact pinned model directory. Provider spend was `$0.00` and no key or
real model runtime was touched.

## What To Check

Fresh independent review checked path containment and symlink handling,
validation before every loader, both factory argument shapes, stable failure
behavior, the broader suite, package contents, and ticket scope. It found no
P0-P3 issue and recommends acceptance.

## Recommended Next Move

Accept and merge BRN-0012 under the founder's delegated autonomy. Then open a
separate fresh validation ticket that freezes the exact runtime/cache/code
identity and predictions before one Luna+Ettin run.
