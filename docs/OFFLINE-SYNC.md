# BOA Bar Control — Offline and Sync

Status: canonical.
Source: `references/design-source/spec.txt` §10.

---

## The premise

> The venue is at Hennur, it will be 3,000 people deep, and mobile data will be
> unusable at peak. Assume the app is unreachable for some part of the night.
>
> A system that only works online is a system that does not work.

Offline is not a degraded mode. It is the expected mode for several hours on
10 October.

## The three failures this document exists to prevent

The first implementation had a write outbox and no read path. That produced three
distinct show-day catastrophes, and each one is a rule below.

1. **Silent fixture fallback.** When the live snapshot load failed — which is
   every offline reload — the store kept its hardcoded demo fixtures and rendered
   them as live festival stock. Staff would have been reading Kingfisher figures
   that came from a source file, believing they were counting real inventory.
2. **Cold-start lockout.** Membership loading required a network round-trip, so
   a staff member opening the app with no signal was locked out entirely.
3. **Silent write loss.** Ledger writes were discarded on a location-lookup
   failure and on a validation throw inside an unawaited promise, while the UI
   toasted success.

## Read path

### The reference cache

Populated on every successful sync, and it is the read path when the network is
gone. It is not optional and it is not a nice-to-have.

| Cached | Refreshed |
| --- | --- |
| SKUs (with `ml_per_container`, `units_per_case`, `tare_weight_g`) | On sync |
| Locations | On sync |
| The user's memberships and role | On sign-in and on sync |
| The user's own location's ledger | On sync |
| Derived position for the user's scope | On sync, and recomputed locally after each queued write |
| Open dockets addressed to the user's location | On sync |
| Tolerance bands | On sync |

### Rules

1. **A failed live load never falls back to fixture data.** If the cache is
   empty and the network is gone, the screen shows an explicit empty state that
   says so. It never shows a number it cannot source.
2. **Fixture data cannot be reached in live mode.** The fixture repository is
   selected at construction time by configuration, not as an error fallback.
   These are two implementations of one interface; a live session must never
   silently become a fixture session.
3. **Cold start offline works.** Session and membership are cached durably. A
   staff member with no signal reaches their bar screen with the last known
   position.
4. **Every screen stamps "as of HH:MM"** from the timestamp of the data it is
   actually showing. Never a literal. The stamp is how staff know whether to
   trust the number, and a hardcoded `19:43` is a lie told at 22:10.
5. **Local position is recomputed after every queued write**, so the UI reflects
   what the user just did without waiting for the server.

## Write path

### Every write goes to the outbox

Online or offline. There is no direct-to-network path for writes. This is what
makes the offline case ordinary rather than exceptional.

```
user action
   │
   ▼
validate (zod) ──▶ reject visibly on failure
   │
   ▼
mint idempotency key ONCE, store it with the action
   │
   ▼
append to outbox (Dexie, durable)  +  apply to local position
   │
   ▼
sync engine drains in order
   │
   ▼
boa_bar_submit_movement RPC
```

### Rules

1. **Idempotency keys are minted once per user action**, persisted with the
   outbox entry, and reused on every retry. A key regenerated per network call
   protects against nothing: a double tap creates two ledger movements, and the
   outbox dedupe check becomes dead code.
2. **Replay is strictly ordered.** A failed entry blocks the entries behind it.
   Without this, an acceptance can post before its issue, and the ledger's
   causal history is wrong.
3. **No write fails silently.** No `void promise` that can swallow a throw. A
   write that cannot be constructed or queued surfaces an error to the user and
   is retained for retry. The UI never reports success before the entry is
   durable in the outbox.
4. **Nothing mutable lives only in React memory.** Dockets, counts, and
   optimistic deltas are persisted. A reload mid-count must not lose the count.
5. **Client-generated IDs must be collision-free.** UUIDs, not array indices.
   Two devices minting `D-0005` from local array length is a real bug that
   produced duplicate docket numbers.
6. **The outbox is visible.** The user can see how many changes are pending and
   whether the last sync succeeded — the design specifies exactly this
   (`OFFLINE · 4 CHANGES PENDING`, `LAST SYNC 19:42`).

## Retry and backoff

| Failure | Behaviour |
| --- | --- |
| Network unreachable | Retry with backoff, capped. Keep queueing. |
| 5xx | Retry with backoff. |
| 409 / duplicate idempotency key | Treat as success — the server already has it. Mark the entry done. |
| 422 validation | **Stop.** Do not retry a payload the server will always reject. Surface it for human resolution. |
| 401 / 403 auth | **Stop the drain.** Do not spin. Prompt re-authentication and hold the queue intact. |

The auth stop condition matters operationally: a token expiring mid-shift must
not drain the queue into failures or discard it.

## Connectivity detection

Real detection, from `navigator.onLine` plus sync outcomes. **Not a hand-operated
toggle.** The design's `offline` prop models a real state the app must derive;
shipping it as a user-facing switch in a settings panel is a defect.

There must be one source of truth for pending count and one for online state.
Two competing sources produce a UI that contradicts itself.

## Service worker

- Precache the app shell, fonts and icons so a cold offline start renders.
- Navigation fallback to the shell so a deep link works offline.
- API reads: stale-while-revalidate for reference data, so the app opens fast
  and updates when it can.
- The service worker is **typechecked and linted** like any other source file.
  Excluding `sw.ts` from `tsc` and eslint means the one file that must work when
  everything else fails is the one file nobody checks.
- Version skew: a deployed update must not leave two devices on incompatible
  outbox schemas mid-event. Version the outbox and migrate on open.

## Clock skew

Offline devices have wrong clocks. `occurred_at` is captured on the device but
**validated and clamped server-side**, and `business_date` is derived, not
client-supplied. Otherwise history can be backdated around a count, which
silently rewrites variance.

Store UTC. Display Asia/Kolkata.

## Conflict handling

The ledger is append-only, which removes most conflicts by construction — two
devices appending movements do not conflict. The cases that remain:

| Case | Resolution |
| --- | --- |
| Same docket accepted on two devices | First accepted wins; second returns the existing acceptance |
| Same action submitted twice | Idempotency key dedupes |
| Count submitted twice for one session | Session status guards it; second is rejected |
| Position disagreement after sync | The ledger is authoritative; local position is recomputed from it |

Local position is always a projection. When it disagrees with the server, the
server wins and the local projection is rebuilt — never the other way round.

## Paper fallback

Mandatory, and not a software feature. See [PRODUCT.md](PRODUCT.md).

- Pre-printed count sheets per bar, SKU list filled, blank columns, in a folder
  before load-in.
- Pre-printed docket books, triplicate, numbered.
- The app must **print** these: a print view for count sheets and docket books
  generated from real SKU and location data, so the paper and the app agree.
- A reconciliation path to key paper dockets and counts in afterwards, marked
  with their paper serial number and `source = 'paper'`.

The QR flow is the fast path. The book is the fallback. The numbers reconcile
later.

## Testing requirements

- Queue a write offline, reload the app, assert the write is still queued.
- Drain with an injected 401 and assert the queue is intact and the drain stopped.
- Submit the same action twice and assert one ledger row.
- Queue an issue then an acceptance, force the issue to fail, and assert the
  acceptance did not post.
- Load with an empty cache and no network, and assert an explicit empty state —
  **not** fixture data.
- Cold start offline with a cached session and assert the bar screen renders.
- Assert every "as of" stamp derives from data, by rendering with a fixed clock.

---

See also: [ARCHITECTURE.md](ARCHITECTURE.md) · [DATA-MODEL.md](DATA-MODEL.md) ·
[SECURITY.md](SECURITY.md)
