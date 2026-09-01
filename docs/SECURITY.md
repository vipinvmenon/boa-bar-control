# BOA Bar Control — Security

Status: canonical.
Source: `references/design-source/spec.txt` §6, §13.

---

## Threat model

This system is the evidence in three adversarial conversations: an excise
inspection, a commercial settlement with STOK, and an internal question about
where stock went. Its integrity properties matter more than its confidentiality
properties — but both are real, because the ledger contains money and staff
names.

The realistic threats, in order:

1. **A defensible-looking but wrong number.** Not an attacker — a bug, a
   pre-filled count, a mutable balance, an unenforced constraint. This is the
   most likely and most damaging failure.
2. **A count biased by showing the expected figure.** The spec calls blind
   counting "non-negotiable" precisely because this is easy to get wrong.
3. **Stock walking**, with the ledger unable to distinguish "never delivered"
   from "disappeared after arrival".
4. **A staff member seeing what they should not** — rupee figures, another bar's
   position, settlement terms.
5. **A lost or borrowed phone** with a live session on a festival site.
6. **A leaked service-role key** turning a client bug into total compromise.

## Non-negotiables

| # | Rule |
| --- | --- |
| 1 | Authorisation is enforced **in the database**. Client-side role checks are a usability affordance and never a control. |
| 2 | The **service-role key never reaches this app**. Privileged work lives in database functions or server-side jobs. |
| 3 | The ledger is **append-only** — no UPDATE, no DELETE, no TRUNCATE, enforced by triggers declared `ENABLE ALWAYS`, with `FORCE ROW LEVEL SECURITY`. |
| 4 | Blind-count enforcement is **count-scoped** and lives in the database. |
| 5 | `sale` movements are writable **only** by the POS import path. |
| 6 | Every table needing writes has an **INSERT policy with `WITH CHECK`**. |
| 7 | No rupee figure is readable by crew, and no bar data is reachable from the artist portal. |
| 8 | Every RLS policy is proved by a **behavioural** test that connects as that role. |

## Roles

```
crew · warehouse · bar_lead · runner · manager · auditor · admin
```

| Capability | crew / warehouse / bar_lead | manager / admin | auditor |
| --- | --- | --- | --- |
| Read stock at own location | yes | yes (all) | yes (all) |
| Read stock at other locations | **no** | yes | yes |
| Read expected stock while counting that location | **no** | n/a | n/a |
| Post receipt / issue / transfer / return / waste / comp | yes, own scope | yes | no |
| Post `sale` | **no** | **no** | no |
| Post `adjustment` | **no** | yes, reason required | no |
| Submit a count | yes | yes | no |
| Review variance and reveal expected | no | yes | yes |
| Read ₹ / settlement / serve map | **no** | yes | yes |
| Import POS | no | yes | no |
| Manage memberships | no | admin only | no |

### Location scoping is real

`membership.location_id` must be **used** in authorisation, not merely stored.
Crew are scoped to their own bar for both reads and writes. In the first
implementation this column existed and was never referenced, so any crew member
could post movements at any bar and read every bar's position.

## Blind counting — the enforcement that matters

The spec's requirement:

> The counter does not see the expected figure. If the app shows "expected 47"
> next to the input box, you will get 47 every time and the count is worthless.
> The expected figure appears only after submit, on the variance screen, to a
> different person.

### Why role-based gating cannot express this

Crew are *allowed* to see stock in general — that is in the access tier. What
they must not see is the expected quantity for **the location they are actively
counting**. That is a count-scoped rule, not a role-scoped one.

The first implementation authorised `boa_bar_inventory_snapshot` with
`enum_range(null::public.boa_bar_role)` — every role — so a counter could read
their bar's expected position, or sum the raw ledger, before submitting. The word
"blind" appeared nowhere in the SQL.

### The required enforcement

While an open (`draft`) count session exists for location L assigned to user U:

1. `boa_bar_inventory_snapshot` must not return position rows for L to U.
2. Raw ledger reads must not let U reconstruct L's position — either exclude L's
   movement lines for U, or drop direct ledger `SELECT` for non-manager roles and
   serve crew reads through purpose-built RPCs.
3. `boa_bar_count_line` must never carry an expected quantity column. The count
   row holds observed values only.
4. The theoretical position is frozen into `count_session.sealed_position` **at
   submission**, server-side, so variance is reproducible and the reveal happens
   after the fact.
5. Two-person integrity: `counted_by` and `witnessed_by`, and the reveal is
   available to a manager, not to the counter.

This must be proved by a test that connects as a crew user with an open count
session and asserts the snapshot omits that location.

## Docket tokens

- The QR token is opaque and random — never a docket number or a guessable ID.
- Stored as `token_hash` (SHA-256). The raw token is returned once, at creation,
  and never persisted. *(The existing migration does this correctly.)*
- Expiring (`token_expires_at`).
- Presenting a token authorises **viewing** the docket for acceptance. It does
  not authorise acceptance itself — that requires an authenticated user with the
  right role at the destination location.
- Acceptance records a named person and a server timestamp. Two named people,
  one timestamp, is the entire point of the docket.
- The deep link the QR encodes must exist as a route. In the first
  implementation it pointed at `/d/{token}`, which was never a route.

## Adjustments

The audit report read first the next morning.

- Manager or admin only.
- Reason mandatory, free text retained.
- Actor and device recorded.
- A reversal must reference exactly one original (`reverses_movement_id`
  unique) and must mirror its lines.
- A bar with many adjustments is a bar with a problem — so adjustments must be
  filterable and countable per location.

## Sessions and devices

- Invited-staff email authentication, on whatever address the person already
  has — there is no staff mail domain and most of the crew are temporary. What is
  invited is the *person*, by a manager, against a named membership; the address
  is only how the code reaches them. No self-registration.
- Sessions are long enough to survive a shift without re-authentication, and
  short enough that a lost phone is not a permanent credential.
- A token expiring mid-shift must **hold** the outbox, not drain it into failures.
- Sign-out must clear the local cache of anything scoped to that user, while
  retaining unsent outbox entries for that user's next sign-in.
- Assume a shared phone. Nothing in the UI should expose another user's data
  after sign-out.

## Data handling

| Concern | Rule |
| --- | --- |
| POS source files | Retained in Storage, manager-readable only, never public |
| Count evidence (photos, weights) | Storage, scoped to the count's location |
| Staff names | Shown in the ledger to authorised roles; not exported to the artist portal |
| Money | Integer paise; manager/auditor only |
| Secrets | Only `VITE_SUPABASE_URL` and the publishable key reach the client. Nothing else. |
| Backups | Point-in-time recovery enabled before show day, verified by a restore test |

The ledger is the audit record for a licenced premises. Retention follows the
excise licence conditions — which is an open decision, see
[DECISIONS.md](DECISIONS.md).

## Testing requirements

Existence assertions prove nothing about security. Required behavioural tests:

- `UPDATE`, `DELETE` and `TRUNCATE` on the ledger all fail.
- Connect as `authenticated` with a crew claim: cannot read another bar's
  position, cannot read any ₹ column, cannot post an adjustment, cannot post a
  `sale`.
- Connect as crew with an open count session: the snapshot omits that location.
- Connect as manager: can reveal variance, can post an adjustment with a reason,
  cannot post one without.
- `GRANT USAGE ON SCHEMA private TO authenticated` exists — every policy calls
  `private.boa_bar_has_role`, so without it every policy errors at runtime. This
  was missing and untested in the first implementation.
- A movement cannot post lines against another venue's locations or SKUs.
- An unmapped POS SKU rejects the whole batch.

## Reporting a security issue

Security findings block the milestone they touch. Record them in
[CURRENT-STATE.md](CURRENT-STATE.md) under the owning task and raise them
directly — do not defer them to a later phase.

---

See also: [DATA-MODEL.md](DATA-MODEL.md) · [ARCHITECTURE.md](ARCHITECTURE.md) ·
[OFFLINE-SYNC.md](OFFLINE-SYNC.md)
