begin;

create extension if not exists pgcrypto;

create type public.boa_bar_role as enum ('crew', 'warehouse', 'bar_lead', 'manager', 'auditor', 'admin');
create type public.boa_bar_location_kind as enum ('warehouse', 'bar', 'hospitality', 'lounge', 'in_transit');
create type public.boa_bar_movement_kind as enum ('receipt', 'issue', 'transfer', 'return', 'sale', 'comp', 'waste', 'adjustment');
create type public.boa_bar_docket_status as enum ('awaiting', 'accepted', 'accepted_short', 'cancelled');
create type public.boa_bar_count_status as enum ('draft', 'submitted', 'reviewed');

create schema if not exists private;
revoke all on schema private from public;

create table public.boa_bar_venue (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  event_date date not null,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

create table public.boa_bar_location (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id),
  code text not null,
  name text not null,
  kind public.boa_bar_location_kind not null,
  parent_id uuid references public.boa_bar_location(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (venue_id, code)
);

create table public.boa_bar_membership (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.boa_bar_role not null,
  location_id uuid references public.boa_bar_location(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (venue_id, user_id, role, location_id)
);

create table public.boa_bar_sku (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id),
  code text not null,
  name text not null,
  category_key text not null check (category_key in ('bottled_beer', 'draught_beer', 'spirits', 'mixers')),
  container_type text not null,
  ml_per_container integer not null check (ml_per_container > 0),
  units_per_case integer not null default 1 check (units_per_case > 0),
  tare_weight_g numeric(12,3),
  excise_category text,
  is_supplied boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (venue_id, code)
);

create table public.boa_bar_serve_map (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id),
  pos_item_code text not null,
  inventory_sku_id uuid not null references public.boa_bar_sku(id),
  ml_per_sale integer not null check (ml_per_sale > 0),
  active_from timestamptz not null default now(),
  active_to timestamptz,
  unique (venue_id, pos_item_code, active_from)
);

create table public.boa_bar_docket (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id),
  docket_no text not null,
  token uuid not null default gen_random_uuid() unique,
  from_location_id uuid not null references public.boa_bar_location(id),
  to_location_id uuid not null references public.boa_bar_location(id),
  status public.boa_bar_docket_status not null default 'awaiting',
  issued_by uuid not null references auth.users(id),
  issued_at timestamptz not null default now(),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  difference_reason text,
  created_at timestamptz not null default now(),
  unique (venue_id, docket_no),
  check (from_location_id <> to_location_id)
);

create table public.boa_bar_docket_line (
  id uuid primary key default gen_random_uuid(),
  docket_id uuid not null references public.boa_bar_docket(id) on delete restrict,
  sku_id uuid not null references public.boa_bar_sku(id),
  issued_containers integer not null check (issued_containers >= 0),
  issued_ml bigint not null check (issued_ml >= 0),
  accepted_containers integer,
  accepted_ml bigint,
  unique (docket_id, sku_id)
);

create table public.boa_bar_movement (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id),
  idempotency_key uuid not null,
  kind public.boa_bar_movement_kind not null,
  business_date date not null,
  occurred_at timestamptz not null,
  actor_id uuid not null references auth.users(id),
  source text not null default 'pwa',
  reason text,
  docket_id uuid references public.boa_bar_docket(id),
  reverses_movement_id uuid references public.boa_bar_movement(id),
  metadata jsonb not null default '{}'::jsonb,
  posted_at timestamptz not null default now(),
  unique (venue_id, idempotency_key),
  check ((kind = 'adjustment' and reason is not null) or kind <> 'adjustment'),
  check (reverses_movement_id is null or kind = 'adjustment')
);

create table public.boa_bar_movement_line (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.boa_bar_movement(id) on delete restrict,
  sku_id uuid not null references public.boa_bar_sku(id),
  location_id uuid not null references public.boa_bar_location(id),
  container_delta integer not null,
  ml_delta bigint not null,
  value_delta_minor bigint not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  check (container_delta <> 0 or ml_delta <> 0 or value_delta_minor <> 0)
);

create index boa_bar_movement_venue_date_idx on public.boa_bar_movement (venue_id, business_date, occurred_at);
create index boa_bar_movement_line_position_idx on public.boa_bar_movement_line (location_id, sku_id);

create table private.boa_bar_balance (
  venue_id uuid not null references public.boa_bar_venue(id),
  location_id uuid not null references public.boa_bar_location(id),
  sku_id uuid not null references public.boa_bar_sku(id),
  containers bigint not null default 0,
  ml bigint not null default 0,
  value_minor bigint not null default 0,
  last_movement_id uuid not null references public.boa_bar_movement(id),
  updated_at timestamptz not null default now(),
  primary key (venue_id, location_id, sku_id)
);

create table public.boa_bar_count_session (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id),
  location_id uuid not null references public.boa_bar_location(id),
  count_kind text not null check (count_kind in ('opening_warehouse', 'opening_bar', 'mid_event', 'close_out')),
  status public.boa_bar_count_status not null default 'draft',
  assigned_to uuid not null references auth.users(id),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.boa_bar_count_line (
  id uuid primary key default gen_random_uuid(),
  count_session_id uuid not null references public.boa_bar_count_session(id) on delete restrict,
  sku_id uuid not null references public.boa_bar_sku(id),
  full_containers integer not null default 0 check (full_containers >= 0),
  partial_ml integer not null default 0 check (partial_ml >= 0),
  gross_weight_g numeric(12,3),
  evidence jsonb not null default '{}'::jsonb,
  unique (count_session_id, sku_id)
);

create table public.boa_bar_pos_import (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id),
  source_name text not null,
  raw_object_path text not null,
  sha256 text not null,
  status text not null default 'pending' check (status in ('pending', 'validated', 'posted', 'rejected')),
  imported_by uuid not null references auth.users(id),
  imported_at timestamptz not null default now(),
  error_report jsonb not null default '[]'::jsonb,
  unique (venue_id, sha256)
);

create table public.boa_bar_pos_row (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.boa_bar_pos_import(id) on delete restrict,
  venue_id uuid not null references public.boa_bar_venue(id),
  stable_transaction_id text not null,
  pos_item_code text not null,
  quantity numeric(12,3) not null,
  sold_at timestamptz not null,
  hour_bucket timestamptz not null,
  raw_row jsonb not null,
  unique (venue_id, stable_transaction_id, pos_item_code)
);

create function private.boa_bar_has_role(p_venue_id uuid, p_roles public.boa_bar_role[])
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select exists (
    select 1 from public.boa_bar_membership m
    where m.venue_id = p_venue_id and m.user_id = auth.uid() and m.active and m.role = any(p_roles)
  );
$$;

create function private.boa_bar_reject_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'BOA bar ledger rows are immutable; post an adjustment instead' using errcode = '55000';
end;
$$;

create trigger boa_bar_movement_immutable before update or delete on public.boa_bar_movement
for each row execute function private.boa_bar_reject_mutation();
create trigger boa_bar_movement_line_immutable before update or delete on public.boa_bar_movement_line
for each row execute function private.boa_bar_reject_mutation();

create function public.boa_bar_submit_movement(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_id uuid := coalesce((p_payload->>'id')::uuid, gen_random_uuid());
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_key uuid := (p_payload->>'idempotency_key')::uuid;
  v_kind public.boa_bar_movement_kind := (p_payload->>'kind')::public.boa_bar_movement_kind;
  v_existing uuid;
  v_line jsonb;
  v_line_count integer := 0;
  v_container_sum bigint := 0;
  v_ml_sum bigint := 0;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not private.boa_bar_has_role(v_venue, array['crew','warehouse','bar_lead','manager','admin']::public.boa_bar_role[]) then
    raise exception 'not authorised for venue' using errcode = '42501';
  end if;

  select id into v_existing from public.boa_bar_movement where venue_id = v_venue and idempotency_key = v_key;
  if v_existing is not null then return v_existing; end if;
  if jsonb_typeof(p_payload->'lines') <> 'array' or jsonb_array_length(p_payload->'lines') = 0 then
    raise exception 'movement requires lines' using errcode = '22023';
  end if;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    v_line_count := v_line_count + 1;
    v_container_sum := v_container_sum + (v_line->>'container_delta')::bigint;
    v_ml_sum := v_ml_sum + (v_line->>'ml_delta')::bigint;
  end loop;
  if v_kind in ('issue','transfer','return') and (v_container_sum <> 0 or v_ml_sum <> 0) then
    raise exception 'custody movements must balance across locations' using errcode = '23514';
  end if;
  if v_kind = 'receipt' and v_ml_sum <= 0 then raise exception 'receipt must add stock' using errcode = '23514'; end if;
  if v_kind in ('sale','comp','waste') and v_ml_sum >= 0 then raise exception 'depletion must remove stock' using errcode = '23514'; end if;

  insert into public.boa_bar_movement (
    id, venue_id, idempotency_key, kind, business_date, occurred_at, actor_id, source,
    reason, docket_id, reverses_movement_id, metadata
  ) values (
    v_id, v_venue, v_key, v_kind, (p_payload->>'business_date')::date,
    (p_payload->>'occurred_at')::timestamptz, auth.uid(), coalesce(p_payload->>'source','pwa'),
    nullif(p_payload->>'reason',''), (p_payload->>'docket_id')::uuid,
    (p_payload->>'reverses_movement_id')::uuid, coalesce(p_payload->'metadata','{}'::jsonb)
  );

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    insert into public.boa_bar_movement_line (
      movement_id, sku_id, location_id, container_delta, ml_delta, value_delta_minor, evidence
    ) values (
      v_id, (v_line->>'sku_id')::uuid, (v_line->>'location_id')::uuid,
      (v_line->>'container_delta')::integer, (v_line->>'ml_delta')::bigint,
      coalesce((v_line->>'value_delta_minor')::bigint,0), coalesce(v_line->'evidence','{}'::jsonb)
    );
    insert into private.boa_bar_balance (venue_id, location_id, sku_id, containers, ml, value_minor, last_movement_id)
    values (v_venue, (v_line->>'location_id')::uuid, (v_line->>'sku_id')::uuid,
      (v_line->>'container_delta')::bigint, (v_line->>'ml_delta')::bigint,
      coalesce((v_line->>'value_delta_minor')::bigint,0), v_id)
    on conflict (venue_id, location_id, sku_id) do update set
      containers = boa_bar_balance.containers + excluded.containers,
      ml = boa_bar_balance.ml + excluded.ml,
      value_minor = boa_bar_balance.value_minor + excluded.value_minor,
      last_movement_id = excluded.last_movement_id,
      updated_at = now();
  end loop;
  return v_id;
exception when unique_violation then
  select id into v_existing from public.boa_bar_movement where venue_id = v_venue and idempotency_key = v_key;
  if v_existing is not null then return v_existing; end if;
  raise;
end;
$$;

alter table public.boa_bar_venue enable row level security;
alter table public.boa_bar_location enable row level security;
alter table public.boa_bar_membership enable row level security;
alter table public.boa_bar_sku enable row level security;
alter table public.boa_bar_serve_map enable row level security;
alter table public.boa_bar_docket enable row level security;
alter table public.boa_bar_docket_line enable row level security;
alter table public.boa_bar_movement enable row level security;
alter table public.boa_bar_movement_line enable row level security;
alter table public.boa_bar_count_session enable row level security;
alter table public.boa_bar_count_line enable row level security;
alter table public.boa_bar_pos_import enable row level security;
alter table public.boa_bar_pos_row enable row level security;

create policy boa_bar_venue_read on public.boa_bar_venue for select using (private.boa_bar_has_role(id, enum_range(null::public.boa_bar_role)));
create policy boa_bar_location_read on public.boa_bar_location for select using (private.boa_bar_has_role(venue_id, enum_range(null::public.boa_bar_role)));
create policy boa_bar_membership_self on public.boa_bar_membership for select using (user_id = auth.uid() or private.boa_bar_has_role(venue_id, array['manager','admin']::public.boa_bar_role[]));
create policy boa_bar_sku_read on public.boa_bar_sku for select using (private.boa_bar_has_role(venue_id, enum_range(null::public.boa_bar_role)));
create policy boa_bar_serve_map_read on public.boa_bar_serve_map for select using (private.boa_bar_has_role(venue_id, array['manager','auditor','admin']::public.boa_bar_role[]));
create policy boa_bar_docket_read on public.boa_bar_docket for select using (private.boa_bar_has_role(venue_id, enum_range(null::public.boa_bar_role)));
create policy boa_bar_docket_line_read on public.boa_bar_docket_line for select using (exists (select 1 from public.boa_bar_docket d where d.id = docket_id and private.boa_bar_has_role(d.venue_id, enum_range(null::public.boa_bar_role))));
create policy boa_bar_movement_read on public.boa_bar_movement for select using (private.boa_bar_has_role(venue_id, enum_range(null::public.boa_bar_role)));
create policy boa_bar_movement_line_read on public.boa_bar_movement_line for select using (exists (select 1 from public.boa_bar_movement m where m.id = movement_id and private.boa_bar_has_role(m.venue_id, enum_range(null::public.boa_bar_role))));
create policy boa_bar_count_session_read on public.boa_bar_count_session for select using (assigned_to = auth.uid() or private.boa_bar_has_role(venue_id, array['manager','auditor','admin']::public.boa_bar_role[]));
create policy boa_bar_count_line_read on public.boa_bar_count_line for select using (exists (select 1 from public.boa_bar_count_session s where s.id = count_session_id and (s.assigned_to = auth.uid() or private.boa_bar_has_role(s.venue_id, array['manager','auditor','admin']::public.boa_bar_role[]))));
create policy boa_bar_pos_import_read on public.boa_bar_pos_import for select using (private.boa_bar_has_role(venue_id, array['manager','auditor','admin']::public.boa_bar_role[]));
create policy boa_bar_pos_row_read on public.boa_bar_pos_row for select using (private.boa_bar_has_role(venue_id, array['manager','auditor','admin']::public.boa_bar_role[]));

revoke all on public.boa_bar_movement, public.boa_bar_movement_line from anon, authenticated;
grant select on public.boa_bar_venue, public.boa_bar_location, public.boa_bar_membership, public.boa_bar_sku,
  public.boa_bar_docket, public.boa_bar_docket_line, public.boa_bar_movement, public.boa_bar_movement_line,
  public.boa_bar_count_session, public.boa_bar_count_line to authenticated;
grant execute on function public.boa_bar_submit_movement(jsonb) to authenticated;

comment on table public.boa_bar_movement is 'Immutable inventory ledger header. Corrections are adjustment movements.';
comment on table private.boa_bar_balance is 'Transactional projection only; the immutable ledger remains source of truth.';
comment on table public.boa_bar_count_line is 'Contains observed quantities only. Expected quantities are intentionally never stored in the crew-visible row.';

commit;
