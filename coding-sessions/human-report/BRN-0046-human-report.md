# BRN-0046 Human Report

## Why This Mattered

The model had to explain both used and unused evidence in free text. That made
answers more expensive and created avoidable format failures. One malformed
candidate review also ended an answer even when the model could correct the
format without another search.

## What Changed

The model now lists used memories with one short contribution. It lists only
material exclusions, using one fixed reason code. It can omit unrelated rows.
The host still supplies the real evidence ID and exact excerpt and still
checks every material item.

One malformed candidate review can receive one review-only correction. The
correction uses the same pending page and the existing model-call budget. It
cannot search or commit an answer.

## What I Should Know

This change removes unnecessary model writing. It does not reduce evidence
validation. Unknown or duplicate memory numbers fail. A non-abstaining answer
still needs used evidence. A second bad review, refusal, empty response,
forbidden tool, or exhausted budget is terminal.

No paid provider was called. The full provider-free legacy suite passes.

## Review And Acceptance

- The first independent review found one P2 gap. Malformed JSON or non-object
  review arguments did not enter the repair path. The gap is fixed, with
  direct tests for both forms and a terminal second malformed response.
- The first rereview found one more P2 gap. A malformed review mixed with
  another function could enter answer-commit repair. Mixed review responses
  are now terminal before either repair path.
- Focused contracts pass 77/77, core passes 91/91, quickstart passes 6/6, and
  legacy passes 964 with 15 optional skips and zero failures.
- Fresh independent rereview is pending.
- The founder authorized execution of BRN-0045, BRN-0046, and BRN-0047 and
  directed merge after a clean independent review.

## What To Check

- Confirm that the independent reviewer finds no unresolved P0-P3 issue.
- In a later paid diagnostic, compare format-failure rate and answer quality
  with the previous detailed commitment wire.

## Recommended Next Move

Commit the provider-free candidate and request independent review. If the
review accepts it, record founder acceptance, merge it, and begin BRN-0047.
