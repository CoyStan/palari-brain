# BRN-0006 Human Report

## Why This Mattered

Luna's first-ten comparison stopped on question 5 after seven consecutive
memory-tool calls without an answer. The retrieval itself worked; the missing
guarantee was a small, explicit end to searching and a safe transition back to
answering.

## What Changed

One answer turn may now execute at most four memory-tool calls across all
retrieval surfaces. The host refuses a fifth call before it reaches memory.
After Luna's fourth successful call, the OpenAI adapter performs exactly one
tool-disabled finalization request using all evidence already returned. It
preserves normal early answers after zero to three calls.

## What I Should Know

Four is Palari's founder-selected product policy, not a universal benchmark
optimum. Other memory systems generally bound the number of results returned
by one search, while agent runtimes separately bound tool use and route to a
terminal response. Palari now follows that shape. Finalization does not invent
a negative answer: if consulted canonical evidence is insufficient, the model
must say so, and missing evidence is not treated as proof that an event never
happened.

This ticket used no provider, credential, benchmark identity, private dataset,
or spend. It does not rerun or regrade BRN-0005.

## What To Check

The independent reviewer should confirm that calls 1-4 can execute, call 5
cannot, the final request has no tools and uses `tool_choice: "none"`, complete
reasoning/tool-output continuation reaches finalization, and malformed or
tool-calling finalization fails closed. The full suite and quickstart must stay
green.

## Recommended Next Move

Accept BRN-0006 if independent review is clean. Any live validation should be
a separate governed ticket with a fresh preregistration, identity, spend cap,
and founder authorization; this ticket itself authorizes no live call.
