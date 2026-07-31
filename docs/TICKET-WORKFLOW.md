# Ticket Workflow

Palari Brain uses a focused adaptation of the proven ticket workflow in
`/home/quetza/palari-v05`. It applies to governed work: changes that span
multiple sessions or owners, require independent review, carry R2-R4 risk, or
are explicitly requested as a ticket. Small, reversible R0-R1 work may still
use the fast lane in `AGENTS.md`.

Adaptation provenance: `/home/quetza/palari-v05` commit `764cafbb`, primarily
`scripts/process/process.sh`, `coding-sessions/tickets/ticket-schema.md`,
`coding-sessions/templates/agent-mission-packet.md`, and
`coding-sessions/templates/worktree-per-ticket-protocol.md`. The implementation
is rewritten in dependency-free Node for this repository and deliberately
omits v05's Company OS, deployment, archive, and workstream-board machinery.

## The Guarantees

- The ticket is the bounded contract: goal, risk, editable paths, forbidden
  paths, verification, and stop conditions are explicit before work starts.
- One governed ticket owns one branch and one sibling worktree. Review is
  against a committed diff, not loose changes in canonical `main`.
- Specialist and reviewer packets carry the ticket's exact scope. Reviewers
  start fresh, inspect read-only, and recommend `accept`, `reopen`, or
  `needs-human`; they do not quietly implement their own fixes.
- An implementation agent may move work to `in-review`, but the tooling cannot
  mark it `accepted`. Only the founder or an explicitly authorized reviewer
  may accept it, move its file to `tickets/closed/`, merge, or push.
- Scope enforcement checks dirty changes or the complete committed-plus-dirty
  diff, including both sides of a rename.
- Nothing automatically merges, pushes, deletes branches/worktrees, invokes a
  provider, accesses secrets, or widens a ticket.

## Files

```text
coding-sessions/
  tickets/open/       active tickets, including in-review
  tickets/closed/     accepted tickets only
  reports/            technical reports and reviewer notes
  human-report/       founder-readable closeout/confirmation records
  handoffs/           blocked and needs-human packets
  templates/          reusable ticket and report shapes
```

Ticket IDs are `BRN-0001`, optionally with direct child suffixes such as
`BRN-0001-A` and `BRN-0001-A-A`. Only three levels are supported.

## Normal Ritual

Run commands from the canonical checkout unless the command explicitly checks
the ticket worktree.

```bash
npm run ticket -- worktree-clean

npm run ticket -- ticket-create \
  --id BRN-0001 \
  --title "Bound one behavior" \
  --stream memory \
  --risk R2 \
  --priority P1 \
  --allowed-path 'src/example.mjs' \
  --allowed-path 'tests/example.contract.test.mjs' \
  --verification 'node --test tests/example.contract.test.mjs' \
  --verification 'npm run quickstart'

# Complete the TODOs, commit the ticket contract on main, and push it.
npm run ticket -- ticket-lint BRN-0001
npm run ticket -- ticket-worktree BRN-0001
npm run ticket -- agent-packet BRN-0001 specialist

# Work only in the printed worktree.
npm run ticket -- claim BRN-0001
npm run ticket -- scope-check BRN-0001
npm run ticket -- scope-check --committed-plus-dirty --target main BRN-0001
npm run ticket -- transition BRN-0001 in-review

# After implementation and evidence are committed:
npm run ticket -- agent-packet BRN-0001 reviewer
npm run ticket -- review-queue
npm run ticket -- ticket-review-packet BRN-0001
```

`ticket-create` automatically adds the ticket's own open/closed, report,
human-report, and handoff paths to `allowed_paths`. It also adds Palari Brain's
secret, private-data, probe, and live-result danger zones to
`forbidden_paths`. Add narrower ticket-specific forbidden paths as needed.

`agent-packet` deliberately fails unless canonical `main` is clean and equal
to `origin/main`, and the declared ticket worktree exists on the correct clean
branch. This prevents a packet from accidentally directing a specialist or
reviewer into the caller's unrelated checkout.

## Lifecycle

```text
open -> claimed
claimed -> blocked | needs-human | in-review
blocked | needs-human -> open
in-review -> reopened
reopened -> claimed
in-review -> accepted      founder/authorized reviewer only; manual
accepted -> reopened       explicit founder direction only
```

Active statuses stay under `tickets/open/`, including `in-review`. An accepted
ticket must have `status: accepted` and live under `tickets/closed/`. The CLI's
`transition` command intentionally refuses `accepted`.

If a required path is outside scope, transition to `needs-human` when a human
choice can resolve it, or `blocked` when a factual dependency is missing. Do
not edit the ticket's scope after implementation merely to make an existing
diff pass.

## Risk And Evidence

Risk describes possible damage, not effort.

| Risk | Typical work | Human confirmation | Independent review | Closeout evidence |
| --- | --- | --- | --- | --- |
| R0 | typo, tiny local docs/process | usually no | usually no | ticket note |
| R1 | isolated implementation | when ambiguous | optional | Level 1 human report |
| R2 | cross-file or behavior change | when broad/product-changing | required unless founder waives | Level 1 human report + verification |
| R3 | security, data, integration, deploy | required before risky work | required | technical report + reviewer note + human report |
| R4 | production, secrets, customer data, destructive | exact fresh confirmation required | required | R3 evidence + explicit run/not-run record |

The repository's existing founder gates still outrank tickets. A ticket cannot
authorize a live provider run, publication, dataset download, destructive
operation, or any other action that `AGENTS.md` reserves to the founder.

## Reviewer Contract

A reviewer reads the ticket, committed diff against `target_branch`, technical
evidence, and only the source/tests needed to validate the change. The review
must check:

1. acceptance criteria and verification evidence;
2. every changed path against both path lists;
3. actual risk against declared risk;
4. correctness, regressions, security, and missing tests;
5. whether the specialist expanded scope or accepted its own work.

The reviewer records findings in
`coding-sessions/reports/<ID>-reviewer-note.md` using the template. A clean
review is only an acceptance recommendation; it is not an automatic merge or
founder decision.

## Useful Commands

```bash
npm run ticket -- status
npm run ticket -- tickets
npm run ticket -- ticket-lint
npm run ticket -- ticket-lint-all
npm run ticket -- stale-claims
npm run ticket -- report-lint BRN-0001
npm run ticket -- check BRN-0001
```

`check` combines ticket lint, dirty scope checking, and report lint for one
explicit ticket. Use committed-plus-dirty scope checking separately before
review so committed ticket-branch work is not omitted.
