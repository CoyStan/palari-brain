# BRN-0048 Human Report

## Why This Mattered

The instrument answer was factually correct, but the host rejected it because
the model omitted some memories that it had earlier marked material. The old
repair said that something was missing but did not say which memory numbers.

## What Changed

The existing repair now names each missing answer-local memory number once.
The model must mark every named memory as used or excluded. The host does not
make that choice and does not weaken evidence validation.

## What I Should Know

The repair contains no canonical evidence ID, quote, or source text. It adds
no model call. A second invalid commitment still fails.

## What To Check

Focused 81/81, core 93/93, quickstart 6/6, and legacy 970 pass with 15
optional skips and zero failures. Independent review is pending.

## Recommended Next Move

Request independent review. If accepted, merge before BRN-0049 begins.
