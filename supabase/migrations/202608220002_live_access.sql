begin;

alter table public.boa_bar_docket add column token_hash bytea;
alter table public.boa_bar_docket add column token_expires_at timestamptz;
update public.boa_bar_docket
set token_hash = digest(token::text, 'sha256'), token_expires_at = issued_at + interval '12 hours';
alter table public.boa_bar_docket alter column token_hash set not null;
alter table public.boa_bar_docket alter column token_expires_at set not null;
alter table public.boa_bar_docket drop column token;
create unique index boa_bar_docket_token_hash_idx on public.boa_bar_docket (token_hash);

comment on column public.boa_bar_docket.token_hash is 'SHA-256 of the opaque QR token. The raw token is returned once and never stored.';

create function public.boa_bar_inventory_snapshot(p_venue_id uuid)
returns table (
  location_id uuid,
  location_code text,
  location_name text,
  location_kind public.boa_bar_location_kind,
  sku_id uuid,
  sku_code text,
  sku_name text,
  category_key text,
  container_type text,
  ml_per_container integer,
  containers bigint,
  ml bigint,
  value_minor bigint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if not private.boa_bar_has_role(p_venue_id, enum_range(null::public.boa_bar_role)) then
    raise exception 'not authorised for venue' using errcode = '42501';
  end if;
  return query
    select l.id, l.code, l.name, l.kind, s.id, s.code, s.name, s.category_key,
      s.container_type, s.ml_per_container,
      coalesce(b.containers, 0), coalesce(b.ml, 0), coalesce(b.value_minor, 0),
      coalesce(b.updated_at, '-infinity'::timestamptz)
    from public.boa_bar_location l
    cross join public.boa_bar_sku s
    left join private.boa_bar_balance b
      on b.venue_id = p_venue_id and b.location_id = l.id and b.sku_id = s.id
    where l.venue_id = p_venue_id and s.venue_id = p_venue_id and l.active and s.active
    order by l.code, s.code;
end;
$$;

create function public.boa_bar_sync_status(p_venue_id uuid)
returns table (server_time timestamptz, latest_posted_at timestamptz, movement_count bigint)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.boa_bar_has_role(p_venue_id, enum_range(null::public.boa_bar_role)) then
    raise exception 'not authorised for venue' using errcode = '42501';
  end if;
  return query select now(), max(m.posted_at), count(*) from public.boa_bar_movement m where m.venue_id = p_venue_id;
end;
$$;

revoke all on function public.boa_bar_inventory_snapshot(uuid) from public, anon;
revoke all on function public.boa_bar_sync_status(uuid) from public, anon;
grant execute on function public.boa_bar_inventory_snapshot(uuid) to authenticated;
grant execute on function public.boa_bar_sync_status(uuid) to authenticated;

commit;
