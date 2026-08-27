# How to validate the work so far

24 August 2026. Written for a human doing a hands-on review, not for an agent.

The work splits into two layers that must be validated in different ways:

- **The app** — visible in a browser. Covers the three integrity fixes and the
  token pass.
- **The database** — not visible in the app at all yet, because no staff are
  enrolled and there is no data. Validated with SQL and the REST API.

There is no overlap yet. The app still runs on fixtures; the schema work
underneath it has no UI. That is expected at this point in the roadmap and is
worth knowing before you go looking for it.

---

## 1. The app

```bash
cd "/Users/USER/My Works/boa-bar-control"
corepack pnpm dev
```

Open http://localhost:5173.

### 1.1 Demo mode announces itself (BAR-139)

**Look for:** a red bar across the top of every screen reading
`DEMO DATA · NOT LIVE · NOTHING IS RECORDED`, and `DEMO DATA / NOT LIVE` in red
in the header.

**Why it matters:** before this, demo mode rendered `LIVE · 19:44 IST` and live
mode rendered `SYNCED` — exactly backwards. One missing environment variable
would have given twenty staff a full night against fixtures under a label saying
live, discovered the next morning.

**To confirm it is on every screen, not just home:** click all five bottom-nav
tabs. The red bar must persist. The header only renders on home, which is why the
banner sits outside it.

### 1.2 The blind count starts empty (BAR-151)

**Where:** More → Blind counts.

**Look for:** all three steppers reading `0`.

**Why it matters:** they were seeded `{ kf: 11, bud: 36, corona: 19 }` — two of
the three exact expected figures from the store, the third one below — with a
hardcoded matching −1/0/0 reveal. Specification §6: "If the app shows 'expected
47' next to the input box, you will get 47 every time and the count is
worthless."

**Fails if:** any input shows a non-zero starting value.

### 1.3 No invented figures (BAR-152)

**Where:** More → Variance & reports.

**Look for:** an explicit "Not yet available" panel.

**Should be gone:** `−2.1%` overall, `₹18.4K` at risk, `94% Mapped POS`, and four
category variances. None appeared anywhere in the approved design and no code
computed them.

**Note what was deliberately kept:** the home alerts still show `RUN-OUT ~20:10`,
`OLDEST 18 MIN`, `12 LEFT`. Those are in the design source verbatim — they are
sample data, not invented. Their defect is being hardcoded rather than derived,
which is BAR-045/BAR-102.

### 1.4 The token pass (BAR-034 to BAR-037)

Compare any screen against its reference capture in `references/ui/`.

| Check | Expect |
| --- | --- |
| Filter chips (Activity, Warehouse) | Fully rounded pills, not soft rectangles |
| Flow screens (Issue, Waste, Count) | Rounded panels — 12–18px, not 3–7px |
| Any red | `#FF4A3D`, not the old `#ff5d5d` |
| Greys | None. Every muted tone is sage-green at low alpha |
| Cards | Translucent, background showing through |
| Bar-status dots | Slow pulse, ~2.4s |

**Why the radii were wrong:** the previous agent applied the Ritual brand tokens,
which declare `2px / 4px / 8px` and say "mostly sharp — this brand is spiky, not
soft". Correct tokens, wrong surface. ADR-009 settled it in favour of the app
design.

### 1.5 Gates

```bash
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build
```

All four must pass. 12 tests.

### 1.6 The anti-hardcoding gate (BAR-008)

With `pnpm dev` running, in a second terminal:

```bash
corepack pnpm test:visual
```

Expect:

```
22 screens in the design · 22 reference captures · 9 implemented routes
5 reading the data layer · 2 legitimately static · 2 hardcoded · 13 missing
```

**The two hardcoded are `home` and `warehouse`** — exactly the two the old
`design-qa.md` declared "passed". It renders each screen against two different
fixture sets and fails any whose output is byte-identical, because that proves
the screen ignores its data. A screenshot comparison cannot catch this; that is
why the old gate certified broken screens.

**This is expected to fail right now.** Those two screens are rewritten in
BAR-045/BAR-102. The gate is telling the truth.

---

## 2. The database

### 2.1 Migrations are applied

```bash
corepack pnpm exec supabase migration list
```

Four migrations, each with a matching remote timestamp:

| Migration | What |
| --- | --- |
| `202608220001` | Core schema — 13 tables, RLS, immutability triggers |
| `202608220002` | Docket token hashing, snapshot RPC |
| `202608270001` | BAR-012 + BAR-122 privilege lockdown |
| `202608270002` | BAR-155 docket command RPCs |

### 2.2 anon cannot read anything — the important one

Get the anon key from the dashboard (Settings → API → anon public), then:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://reehdtkcpgoilrpzmfai.supabase.co/rest/v1/boa_bar_sku?select=*&limit=1' \
  -H "apikey: YOUR_ANON_KEY" -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expect `401`.** Repeat for `boa_bar_movement`, `boa_bar_docket`,
`boa_bar_pos_row` — all `401`.

**Why it matters:** `TRUNCATE` is not restricted by row level security, and
Supabase grants broad privileges on public tables to `anon` by default. Migration
1 revoked them on 2 of 13 tables. The anon key ships in the browser bundle, so
anyone holding it could have truncated the SKU catalogue, every docket, every
count and every POS row. Widest hole in the schema.

### 2.3 The privilege test suite

```bash
read -s "SUPABASE_DB_PASSWORD?Database password: " && export SUPABASE_DB_PASSWORD
corepack pnpm test:db
```

`read -s` does not echo, so the password stays out of your scrollback and out of
any screenshot.

**Expect 48 assertions passing:** 11 existence + 37 privilege.

The 37 assert that `anon` holds nothing on all 13 tables, `authenticated` holds
`SELECT` and nothing else, the serve map and POS tables are unreachable from the
client, `private.boa_bar_balance` is unreachable by anyone, and only
`authenticated` may execute the three write RPCs.

### 2.4 What passing does NOT prove

Read this before taking 48/48 as reassurance.

The 11 original assertions check only that objects **exist**. They passed while
`TRUNCATE` was reachable by `anon` on 11 tables and while every RLS policy would
have errored at query time. A suite that goes green in that state manufactures
confidence.

Still unproven, all BAR-030:

- That the immutability triggers actually reject an `UPDATE` or `DELETE`. Needs a
  committed movement row, so needs a fixture harness.
- That RLS yields correct per-role row visibility. Needs a session with a real
  JWT claim, not a privilege check.
- That the docket RPCs actually reject self-acceptance, double acceptance,
  over-receipt and an unexplained shortfall. The code contains those checks;
  nothing yet demonstrates they fire. Needs fixtures and two distinct users.

Privileges are necessary, not sufficient: these tests prove a role cannot reach a
table, not that it sees the correct rows inside one it can.

---

## 3. Documentation

Worth ten minutes, because it is what the next agent obeys.

| File | Check |
| --- | --- |
| `docs/CURRENT-STATE.md` | Screen inventory, the "would stop the event dead" table, per-task status with commit SHAs |
| `docs/DECISIONS.md` | 13 ADRs. Each carries a **Provenance** line saying whether it came from your files or is the assistant's inference. Five are still `PROPOSED` |
| `docs/ROADMAP.md` | 160 tasks. Read the severity note first — it explains why the plan does not follow the audit's own ratings |
| `references/ui/` | 22 reference captures, one per design screen |

### Five ADRs still awaiting your decision

006, 008, 010, 011, 012. Each needs only yes or no. ADR-005 is deferred to
~15 September by your choice; 009 and 013 you have accepted.

---

## 4. What is deliberately NOT done

So you can tell a gap from a defect.

- 11 of 22 screens do not exist. 11 more need rewriting.
- The app cannot write to the database. The RPCs exist; nothing calls them.
- No staff are enrolled, so live mode cannot be exercised end to end.
- There is no way to enter opening stock, so the system cannot yet be started for
  a real event (BAR-140). This is the single largest functional gap.
- POS ingest, the control board and run-out alerts do not exist. Specification
  §15 lists these as the first three things to cut, so they are last by design.
