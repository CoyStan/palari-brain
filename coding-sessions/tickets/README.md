# Tickets

Ticket files are executable scope contracts, not a backlog wish list. Active
tickets stay in `open/`; only accepted tickets belong in `closed/`.

The schema and lifecycle are documented in
[`docs/TICKET-WORKFLOW.md`](../../docs/TICKET-WORKFLOW.md). Validate them with:

```bash
npm run ticket -- ticket-lint
npm run ticket -- ticket-lint-all
```
