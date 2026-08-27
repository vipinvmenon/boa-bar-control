# Supabase development workflow

The schema is migration-first. `seed.sql` contains only non-sensitive BOA 2026 reference data; user accounts and memberships are created separately.

## Local stack

Prerequisites: Node 20+ and a running Docker-compatible container runtime.

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:test
pnpm supabase:status
```

Copy the local API URL and publishable/anon key reported by `supabase:status` into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

Create a staff account in local Studio, then insert its membership:

```sql
insert into public.boa_bar_membership (venue_id, user_id, role, location_id)
values (
  '00000000-0000-4000-8000-000000000001',
  '<auth.users.id>',
  'manager',
  null
);
```

## Hosted development project

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <development-project-ref>
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

Never run a linked reset against staging or production. Never expose a service-role key through `VITE_*`.
