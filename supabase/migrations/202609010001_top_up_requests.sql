-- BAR-064 — bar top-up requests.
-- A request is an operational record, not a movement: stock changes only when
-- warehouse staff issue a docket. The request therefore has its own lifecycle.

begin;

create type public.boa_bar_top_up_status as enum ('requested', 'issued', 'fulfilled', 'cancelled');

create table public.boa_bar_top_up_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.boa_bar_venue(id),
  location_id uuid not null references public.boa_bar_location(id),
  sku_id uuid not null references public.boa_bar_sku(id),
  requested_containers integer not null check (requested_containers > 0),
  urgency text not null default 'normal' check (urgency in ('normal', 'urgent')),
  note text,
  status public.boa_bar_top_up_status not null default 'requested',
  idempotency_key uuid not null,
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  docket_id uuid unique references public.boa_bar_docket(id),
  issued_at timestamptz,
  issued_by uuid references auth.users(id),
  fulfilled_at timestamptz,
  fulfilled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  unique (venue_id, requested_by, idempotency_key)
);

alter table public.boa_bar_top_up_request enable row level security;
revoke all on public.boa_bar_top_up_request from anon, authenticated;
grant select on public.boa_bar_top_up_request to authenticated;

create policy boa_bar_top_up_read on public.boa_bar_top_up_request
for select using (
  private.boa_bar_has_role(venue_id, array['warehouse','manager','admin']::public.boa_bar_role[])
  or exists (
    select 1 from public.boa_bar_membership m
    where m.venue_id = boa_bar_top_up_request.venue_id
      and m.user_id = auth.uid()
      and m.active
      and m.location_id = boa_bar_top_up_request.location_id
  )
);

create function public.boa_bar_request_top_up(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := nullif(p_payload->>'venue_id', '')::uuid;
  v_location uuid := nullif(p_payload->>'location_id', '')::uuid;
  v_sku uuid := nullif(p_payload->>'sku_id', '')::uuid;
  v_qty integer := nullif(p_payload->>'requested_containers', '')::integer;
  v_key uuid := nullif(p_payload->>'idempotency_key', '')::uuid;
  v_urgency text := coalesce(nullif(p_payload->>'urgency', ''), 'normal');
  v_note text := nullif(btrim(p_payload->>'note'), '');
  v_request public.boa_bar_top_up_request;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_key is null or v_venue is null or v_location is null or v_sku is null then
    raise exception 'top-up request is missing required fields' using errcode = '22023';
  end if;
  if v_qty is null or v_qty <= 0 then
    raise exception 'requested quantity must be positive' using errcode = '22023';
  end if;
  if v_urgency not in ('normal', 'urgent') then
    raise exception 'top-up urgency must be normal or urgent' using errcode = '22023';
  end if;
  if not private.boa_bar_has_role(v_venue, array['bar_lead','manager','admin']::public.boa_bar_role[])
     or not exists (
       select 1
       from public.boa_bar_membership m
       where m.venue_id = v_venue
         and m.user_id = auth.uid()
         and m.active
         and (m.location_id = v_location or m.role in ('manager','admin'))
     ) then
    raise exception 'not authorised to request stock for this bar' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.boa_bar_location l
    where l.id = v_location and l.venue_id = v_venue and l.kind = 'bar' and l.active
  ) then
    raise exception 'location is not an active bar in this venue' using errcode = '23503';
  end if;
  if not exists (
    select 1
    from public.boa_bar_sku s
    where s.id = v_sku and s.venue_id = v_venue and s.active
  ) then
    raise exception 'sku does not belong to this venue' using errcode = '23503';
  end if;

  select * into v_request
  from public.boa_bar_top_up_request
  where venue_id = v_venue
    and requested_by = auth.uid()
    and idempotency_key = v_key;

  if found then
    if v_request.location_id <> v_location
       or v_request.sku_id <> v_sku
       or v_request.requested_containers <> v_qty
       or v_request.urgency <> v_urgency
       or v_request.note is distinct from v_note then
      raise exception 'idempotency key already belongs to a different top-up request' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'request_id', v_request.id,
      'status', v_request.status,
      'replayed', true
    );
  end if;

  insert into public.boa_bar_top_up_request (
    venue_id, location_id, sku_id, requested_containers, urgency, note,
    idempotency_key, requested_by
  ) values (
    v_venue, v_location, v_sku, v_qty, v_urgency, v_note,
    v_key, auth.uid()
  )
  returning * into v_request;

  return jsonb_build_object(
    'request_id', v_request.id,
    'status', v_request.status,
    'replayed', false
  );
end;
$$;

revoke all on function public.boa_bar_request_top_up(jsonb) from public, anon;
grant execute on function public.boa_bar_request_top_up(jsonb) to authenticated;

-- Link a warehouse issue to the request in the same transaction as docket
-- creation. If any link validation fails, the docket and its ledger leg roll
-- back with this statement rather than leaving an untracked issue.
alter function public.boa_bar_create_docket(jsonb) rename to boa_bar_create_docket_without_top_up;

create function public.boa_bar_create_docket(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_request_id uuid := nullif(p_payload->>'top_up_request_id', '')::uuid;
  v_request public.boa_bar_top_up_request;
  v_result jsonb;
  v_docket_id uuid;
begin
  if v_request_id is not null then
    select * into v_request
    from public.boa_bar_top_up_request
    where id = v_request_id
    for update;

    if not found then
      raise exception 'top-up request not found' using errcode = 'P0002';
    end if;
    if v_request.status not in ('requested', 'issued') then
      raise exception 'top-up request is already %', v_request.status using errcode = '23514';
    end if;
    if v_request.venue_id <> nullif(p_payload->>'venue_id', '')::uuid
       or v_request.location_id <> nullif(p_payload->>'to_location_id', '')::uuid then
      raise exception 'docket route does not match top-up request' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(p_payload->'lines') line
      where (line->>'sku_id')::uuid = v_request.sku_id
        and (line->>'containers')::integer = v_request.requested_containers
    ) then
      raise exception 'docket quantity and SKU do not match top-up request' using errcode = '23514';
    end if;
  end if;

  v_result := public.boa_bar_create_docket_without_top_up(p_payload);
  v_docket_id := (v_result->>'docket_id')::uuid;

  if v_request_id is not null then
    if v_request.status = 'issued' and v_request.docket_id is distinct from v_docket_id then
      raise exception 'top-up request is linked to another docket' using errcode = '23505';
    end if;

    update public.boa_bar_top_up_request
       set status = 'issued',
           docket_id = v_docket_id,
           issued_at = coalesce(issued_at, now()),
           issued_by = coalesce(issued_by, auth.uid())
     where id = v_request_id;

    v_result := v_result || jsonb_build_object('top_up_request_id', v_request_id);
  end if;

  return v_result;
end;
$$;

revoke all on function public.boa_bar_create_docket_without_top_up(jsonb) from public, anon, authenticated;
revoke all on function public.boa_bar_create_docket(jsonb) from public, anon;
grant execute on function public.boa_bar_create_docket(jsonb) to authenticated;

create function public.boa_bar_update_top_up(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_id uuid := nullif(p_payload->>'request_id', '')::uuid;
  v_status text := nullif(p_payload->>'status', '');
  v_docket_id uuid := nullif(p_payload->>'docket_id', '')::uuid;
  v_request public.boa_bar_top_up_request;
  v_docket public.boa_bar_docket;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_id is null or v_status not in ('issued', 'fulfilled', 'cancelled') then
    raise exception 'invalid top-up status transition' using errcode = '22023';
  end if;

  select * into v_request
  from public.boa_bar_top_up_request
  where id = v_id
  for update;

  if not found then
    raise exception 'top-up request not found' using errcode = 'P0002';
  end if;
  if not private.boa_bar_has_role(
    v_request.venue_id,
    array['warehouse','manager','admin']::public.boa_bar_role[]
  ) then
    raise exception 'only warehouse, manager or admin may update top-ups' using errcode = '42501';
  end if;
  if v_request.status::text = v_status then
    return jsonb_build_object('request_id', v_id, 'status', v_status, 'replayed', true);
  end if;

  if v_request.status = 'requested' and v_status = 'cancelled' then
    update public.boa_bar_top_up_request
       set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
     where id = v_id;
  elsif v_request.status = 'requested' and v_status = 'issued' then
    select * into v_docket
    from public.boa_bar_docket
    where id = v_docket_id;

    if not found
       or v_docket.venue_id <> v_request.venue_id
       or v_docket.to_location_id <> v_request.location_id
       or not exists (
         select 1
         from public.boa_bar_docket_line dl
         where dl.docket_id = v_docket.id
           and dl.sku_id = v_request.sku_id
           and dl.issued_containers = v_request.requested_containers
       ) then
      raise exception 'docket does not fulfil this top-up request' using errcode = '23514';
    end if;

    update public.boa_bar_top_up_request
       set status = 'issued', docket_id = v_docket.id,
           issued_at = now(), issued_by = auth.uid()
     where id = v_id;
  elsif v_request.status = 'issued' and v_status = 'fulfilled' then
    select * into v_docket
    from public.boa_bar_docket
    where id = v_request.docket_id;

    if not found or v_docket.status <> 'accepted' then
      raise exception 'top-up cannot be fulfilled before full docket acceptance' using errcode = '23514';
    end if;

    update public.boa_bar_top_up_request
       set status = 'fulfilled',
           fulfilled_at = coalesce(v_docket.accepted_at, now()),
           fulfilled_by = coalesce(v_docket.accepted_by, auth.uid())
     where id = v_id;
  else
    raise exception 'invalid top-up status transition' using errcode = '23514';
  end if;

  return jsonb_build_object('request_id', v_id, 'status', v_status, 'replayed', false);
end;
$$;

revoke all on function public.boa_bar_update_top_up(jsonb) from public, anon;
grant execute on function public.boa_bar_update_top_up(jsonb) to authenticated;

create function public.boa_bar_complete_top_up_from_docket()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    update public.boa_bar_top_up_request
       set status = 'fulfilled',
           fulfilled_at = new.accepted_at,
           fulfilled_by = new.accepted_by
     where docket_id = new.id and status = 'issued';
  end if;
  return new;
end;
$$;

create trigger boa_bar_top_up_fulfil_on_accept
after update of status on public.boa_bar_docket
for each row execute function public.boa_bar_complete_top_up_from_docket();

revoke all on function public.boa_bar_complete_top_up_from_docket() from public, anon, authenticated;

create function public.boa_bar_list_top_up_requests(p_venue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not private.boa_bar_has_role(
    p_venue_id,
    array['warehouse','manager','admin']::public.boa_bar_role[]
  ) then
    raise exception 'only warehouse, manager or admin may list top-ups' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(r) order by (r.urgency = 'urgent') desc, r.requested_at),
    '[]'::jsonb
  ) into v_result
  from public.boa_bar_top_up_request r
  where r.venue_id = p_venue_id
    and r.status in ('requested','issued');

  return v_result;
end;
$$;

revoke all on function public.boa_bar_list_top_up_requests(uuid) from public, anon;
grant execute on function public.boa_bar_list_top_up_requests(uuid) to authenticated;

comment on table public.boa_bar_top_up_request is
  'BAR-064. A bar request for stock; ledger movement occurs only through its linked docket.';
comment on function public.boa_bar_request_top_up(jsonb) is
  'BAR-064. Creates or safely replays a location-scoped top-up request.';
comment on function public.boa_bar_update_top_up(jsonb) is
  'BAR-064. Applies guarded warehouse lifecycle transitions.';
comment on function public.boa_bar_list_top_up_requests(uuid) is
  'BAR-064. Lists active top-up requests for warehouse roles.';

commit;
