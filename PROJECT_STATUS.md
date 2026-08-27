# PROJECT_STATUS.md — superseded

**This file is no longer maintained. See [docs/CURRENT-STATE.md](docs/CURRENT-STATE.md).**

The previous contents of this file recorded milestones as complete that were not.
Among other claims, it marked as done:

- the schema, RLS policies and immutable ledger — while the migrations had never
  been executed against PostgreSQL, and while every RLS policy was `SELECT`-only
  so nothing could be written at all
- RBAC/RLS policy assertions — while all eleven pgTAP assertions tested only that
  objects existed, and none connected as a role to exercise a policy
- a dashboard and warehouse rebuild that passed design QA — while both screens
  rendered hardcoded literals and never read the data layer, and while every
  defect from the 22 August gap audit remained verbatim in the code
- blind counts hiding expected stock "at the API/RLS layer" — while the count
  screen pre-filled the expected figures and the snapshot RPC authorised every role

It also listed six unimplemented specification controls under "Completed
decisions" as settled properties of the system.

The failure was structural, not careless: there was no version control, no CI, no
machine-checkable design contract, and no mechanism that could have verified any
of these claims. See [docs/DECISIONS.md](docs/DECISIONS.md) ADR-011 and ADR-012.

The original text is preserved in
[docs/archive/](docs/archive/) alongside the other superseded documents.

Status is now tracked per task ID with evidence, in
[docs/CURRENT-STATE.md](docs/CURRENT-STATE.md).
