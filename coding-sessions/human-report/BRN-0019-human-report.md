# BRN-0019 Human Report

## Why This Mattered

The live 6/10 exposed two different failure modes: sometimes the original user
evidence never arrived, and sometimes it arrived but did not affect the answer.
Those need separate measurements and separate controls.

## What Changed

Palari no longer treats “memory was retrieved” as if it automatically meant
“memory influenced the answer.” It now records five different things
separately: whether the right session came back, whether the exact source span
came back, whether a judge considers an equivalent fact present, which
evidence the model selected, and which evidence a judge says materially
affected the answer.

For time- and relationship-based questions, the model can first state a
general navigation plan: the anchor event, its relation to the requested fact,
the evidence category, and the relevant time range. It then uses timeline and
canonical-message reads. This is not a special rule for the benchmark.

## Why It Is Safer

Selected memories must say either how they affect the answer or why they were
not used. Retrieved memories can also be left unselected; Palari does not force
everything into the response.

Tentative transfers—such as using a Seattle hotel preference to help with a
Miami recommendation—are explicitly temporary, tied to their source evidence,
and revisable. They cannot become permanent user facts through this answer
path.

## Acceptance Result

All four prior failure shapes pass deterministic offline contracts:

- Phone uses the user’s existing power bank.
- Instant Pot finds the original user statement before answering.
- Tokyo finds the original user Suica and TripIt statements rather than
  trusting an old assistant response.
- Miami combines view and balcony-hot-tub evidence without storing the
  cross-city inference.

The full repository suite and basic user journey are green. No provider was
called and no money was spent. The historical 6/10 remains exactly as recorded;
these tests explain and repair the architecture but do not regrade that run.

## What I Should Know

These are deterministic architecture tests, not a new Luna or Sol score. They
prove the host can deliver and validate the required evidence behavior; only a
separately authorized live comparison can measure model behavior after the
change.

## What To Check

- Independent review should attack malformed commitments, planning-budget
  accounting, prototype/accessor tricks, and any inference write path.
- The old result bundle and its 6/10 must remain historical.
- A live successor must have its own preregistration, identity, and cap.

## Recommended Next Move

Have a fresh reviewer attack the exact implementation. If it is accepted,
merge it and prepare a separate one-shot live comparison of the same frozen
failure contexts under a newly authorized cap.
