# BRN-0005 Human Report

## Why This Mattered

Gemini scored 5/10 on the first-ten diagnostic. Four failures happened after
the correct memory sessions reached the answer model, making answer evidence
use—not retrieval—the measured weakness. This comparison asks whether Luna
changes those outcomes while keeping embeddings, retrieval, questions, and
grading fixed.

## What Changed

The one private identity ran exactly once. The real compatibility smoke
passed: Luna used Gemini semantic retrieval and returned the planted answer.
The unchanged judge scored the first four questions `PASS, FAIL, PASS, PASS`
(3/4), the same labels Gemini received. On question 5, Luna kept asking for
memory seven times and never answered, so the frozen dispatch ceiling stopped
the run. Questions 5-10 were not graded.

## What To Check

Do not present this as 3/10: only four questions have labels. The main 7/10
and provider-delta predictions cannot be assessed. Compatibility passed and
all four completed questions used semantic search, but the all-ten answer
boundary prediction failed on question 5.

## What I Should Know

This is not a reroll of the Gemini identity and not a public benchmark. The
questions are already known. No prompt or answer was tuned from their labels.
The launcher and result are private, one-shot, metered, and independently
reviewed before execution. Fresh accounting is `$0.3785834`: `$0.0116498`
measured and `$0.3669336` conservatively uncertain because Gemini did not
report embedding usage. All 35 terminal artifacts rehash and the credential
scan found zero matches.

## Recommended Next Move

Preserve this as the terminal finding and obtain independent post-run review.
The useful next engineering question is how to prevent repeated retrieval
loops while preserving model independence, but this ticket does not authorize
that repair, a larger ceiling, another identity, rerun, regrade, publication,
or automatic production provider switch.
