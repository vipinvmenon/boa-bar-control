-- BAR-155 (+ BAR-053, BAR-058, BAR-134, BAR-147) — docket command RPCs.
--
-- Per ADR-013 these are the ONLY way a docket is written. `authenticated` holds
-- no table-level write privilege; both functions are SECURITY DEFINER and
-- validate before writing.
--
-- Custody is modelled in two legs, both `issue`, both carrying docket_id:
--
--   leg 1 (dispatch, on create):  from_location -> in_transit
--   leg 2 (receipt,  on accept):  in_transit    -> to_location
--
-- Stock leaves the warehouse when it physically leaves, and lands at the bar
-- when a second named person accepts it. The gap between the legs is exactly
-- spec §5's purpose: an unexplained shortfall sitting in `in_transit` means
-- "never arrived", whereas one appearing after leg 2 means "disappeared after
-- arrival". A single-leg model cannot tell those apart, which is the whole
-- reason the docket exists.

begin;

-- ---------------------------------------------------------------------------
-- boa_bar_create_docket — issue stock, minting the docket and its QR token.
-- ---------------------------------------------------------------------------
-- Returns { docket_id, docket_no, token }. The raw token is returned ONCE and
-- never stored; only its sha256 is persisted (migration 2).

create function public.boa_bar_create_docket(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue        uuid := (p_payload->>'venue_id')::uuid;
  v_from         uuid := (p_payload->>'from_location_id')::uuid;
  v_to           uuid := (p_payload->>'to_location_id')::uuid;
  v_key          uuid := (p_payload->>'idempotency_key')::uuid;
  v_transit      uuid;
  v_docket       uuid;
  v_docket_no    text;
  v_token        uuid;
  v_line         jsonb;
  v_lines        jsonb := '[]'::jsonb;
  v_existing     uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Issuing is a warehouse action. Crew and bar_lead cannot issue to themselves.
  if not private.boa_bar_has_role(v_venue, array['warehouse','manager','admin']::public.boa_bar_role[]) then
    raise exception 'not authorised to issue stock' using errcode = '42501';
  end if;

  if v_key is null then
    raise exception 'idempotency_key is required' using errcode = '22023';
  end if;

  -- Idempotent replay: the movement carries the key, so a retry returns the
  -- docket already created rather than minting a second one. The raw token is
  -- deliberately NOT returned again — it was disclosed once, at creation.
  select m.docket_id into v_existing
  from public.boa_bar_movement m
  where m.venue_id = v_venue and m.idempotency_key = v_key;
  if v_existing is not null then
    select d.docket_no into v_docket_no from public.boa_bar_docket d where d.id = v_existing;
    return jsonb_build_object('docket_id', v_existing, 'docket_no', v_docket_no, 'token', null, 'replayed', true);
  end if;

  if v_from is null or v_to is null or v_from = v_to then
    raise exception 'a docket needs distinct from and to locations' using errcode = '23514';
  end if;

  if jsonb_typeof(p_payload->'lines') <> 'array' or jsonb_array_length(p_payload->'lines') = 0 then
    raise exception 'a docket needs at least one line' using errcode = '22023';
  end if;

  -- Custody passes through the venue's in_transit location. Its absence is a
  -- seeding error, not a runtime condition, so fail loudly.
  select l.id into v_transit
  from public.boa_bar_location l
  where l.venue_id = v_venue and l.kind = 'in_transit' and l.active
  limit 1;
  if v_transit is null then
    raise exception 'venue has no in_transit location; seed one before issuing' using errcode = 'P0002';
  end if;

  -- Serialise docket numbering for this venue. Low volume (hundreds per event),
  -- so a transaction-scoped advisory lock is cheaper and clearer than a sequence
  -- per venue, and it cannot produce the duplicate ids the client-side
  -- array-length scheme did.
  perform pg_advisory_xact_lock(hashtext('boa_bar_docket_no' || v_venue::text));
  select 'D-' || lpad((coalesce(max(substring(d.docket_no from 3)::integer), 0) + 1)::text, 4, '0')
    into v_docket_no
  from public.boa_bar_docket d
  where d.venue_id = v_venue and d.docket_no ~ '^D-[0-9]+$';

  v_token  := gen_random_uuid();
  v_docket := gen_random_uuid();

  insert into public.boa_bar_docket (
    id, venue_id, docket_no, token_hash, token_expires_at,
    from_location_id, to_location_id, status, issued_by, issued_at
  ) values (
    v_docket, v_venue, v_docket_no, sha256(v_token::text::bytea), now() + interval '12 hours',
    v_from, v_to, 'awaiting', auth.uid(), now()
  );

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    if (v_line->>'containers')::integer <= 0 or (v_line->>'ml')::bigint <= 0 then
      raise exception 'each line needs positive containers and ml' using errcode = '23514';
    end if;

    insert into public.boa_bar_docket_line (docket_id, sku_id, issued_containers, issued_ml)
    values (v_docket, (v_line->>'sku_id')::uuid, (v_line->>'containers')::integer, (v_line->>'ml')::bigint);

    -- Leg 1: out of the source, into in_transit. Nets to zero, so
    -- boa_bar_submit_movement accepts it as a custody move.
    v_lines := v_lines
      || jsonb_build_object('sku_id', v_line->>'sku_id', 'location_id', v_from,
                            'container_delta', -(v_line->>'containers')::integer,
                            'ml_delta', -(v_line->>'ml')::bigint)
      || jsonb_build_object('sku_id', v_line->>'sku_id', 'location_id', v_transit,
                            'container_delta', (v_line->>'containers')::integer,
                            'ml_delta', (v_line->>'ml')::bigint);
  end loop;

  perform public.boa_bar_submit_movement(jsonb_build_object(
    'venue_id', v_venue,
    'idempotency_key', v_key,
    'kind', 'issue',
    'business_date', coalesce(p_payload->>'business_date', to_char(now(), 'YYYY-MM-DD')),
    'occurred_at', coalesce(p_payload->>'occurred_at', now()::text),
    'docket_id', v_docket,
    'source', coalesce(p_payload->>'source', 'pwa'),
    'metadata', jsonb_build_object('leg', 'dispatch', 'docket_no', v_docket_no),
    'lines', v_lines
  ));

  return jsonb_build_object('docket_id', v_docket, 'docket_no', v_docket_no, 'token', v_token, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- boa_bar_accept_docket — the second named person takes custody.
-- ---------------------------------------------------------------------------

create function public.boa_bar_accept_docket(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_key        uuid := (p_payload->>'idempotency_key')::uuid;
  v_token      uuid := nullif(p_payload->>'token','')::uuid;
  v_docket_id  uuid := nullif(p_payload->>'docket_id','')::uuid;
  v_reason     text := nullif(p_payload->>'difference_reason','');
  v_d          public.boa_bar_docket;
  v_transit    uuid;
  v_line       jsonb;
  v_lines      jsonb := '[]'::jsonb;
  v_short      boolean := false;
  v_issued     public.boa_bar_docket_line;
  v_acc_c      integer;
  v_acc_ml     bigint;
  v_existing   uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_key is null then
    raise exception 'idempotency_key is required' using errcode = '22023';
  end if;

  -- Locate by QR token or by id. The token is matched on its hash; the raw
  -- value is never stored.
  if v_token is not null then
    select * into v_d from public.boa_bar_docket where token_hash = sha256(v_token::text::bytea);
  elsif v_docket_id is not null then
    select * into v_d from public.boa_bar_docket where id = v_docket_id;
  else
    raise exception 'a token or docket_id is required' using errcode = '22023';
  end if;

  if v_d.id is null then
    raise exception 'docket not found' using errcode = 'P0002';
  end if;

  select m.id into v_existing
  from public.boa_bar_movement m
  where m.venue_id = v_d.venue_id and m.idempotency_key = v_key;
  if v_existing is not null then
    return jsonb_build_object('docket_id', v_d.id, 'status', v_d.status, 'replayed', true);
  end if;

  -- BAR-134: one acceptance per docket. Without this a repeat accept posts a
  -- second receipt movement, crediting the bar twice and driving in_transit
  -- negative.
  if v_d.status <> 'awaiting' then
    raise exception 'docket % is already %', v_d.docket_no, v_d.status using errcode = '23505';
  end if;

  if v_d.token_expires_at < now() then
    raise exception 'docket % token has expired', v_d.docket_no using errcode = '22023';
  end if;

  -- BAR-147: two named people, or the docket proves nothing. Without this the
  -- issuing device can close its own docket two taps later and the record names
  -- a receiver who was never present — self-certification, not custody.
  if v_d.issued_by = auth.uid() then
    raise exception 'a docket cannot be accepted by the person who issued it' using errcode = '42501';
  end if;

  if not private.boa_bar_has_role(v_d.venue_id, array['crew','bar_lead','warehouse','manager','admin']::public.boa_bar_role[]) then
    raise exception 'not authorised to accept stock' using errcode = '42501';
  end if;

  select l.id into v_transit
  from public.boa_bar_location l
  where l.venue_id = v_d.venue_id and l.kind = 'in_transit' and l.active
  limit 1;

  if jsonb_typeof(p_payload->'lines') <> 'array' or jsonb_array_length(p_payload->'lines') = 0 then
    raise exception 'acceptance needs at least one line' using errcode = '22023';
  end if;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    select * into v_issued
    from public.boa_bar_docket_line
    where docket_id = v_d.id and sku_id = (v_line->>'sku_id')::uuid;

    if v_issued.id is null then
      raise exception 'sku % is not on docket %', v_line->>'sku_id', v_d.docket_no using errcode = '23503';
    end if;

    v_acc_c  := (v_line->>'containers')::integer;
    v_acc_ml := (v_line->>'ml')::bigint;

    if v_acc_c < 0 or v_acc_ml < 0 then
      raise exception 'accepted quantities cannot be negative' using errcode = '23514';
    end if;

    -- BAR-129: you cannot accept more than was issued. The client stepper had no
    -- maximum, and an over-receipt was being classified as a shortfall.
    if v_acc_c > v_issued.issued_containers or v_acc_ml > v_issued.issued_ml then
      raise exception 'cannot accept more than issued for sku % (issued %, offered %)',
        v_issued.sku_id, v_issued.issued_containers, v_acc_c using errcode = '23514';
    end if;

    if v_acc_c < v_issued.issued_containers or v_acc_ml < v_issued.issued_ml then
      v_short := true;
    end if;

    update public.boa_bar_docket_line
      set accepted_containers = v_acc_c, accepted_ml = v_acc_ml
      where id = v_issued.id;

    -- Leg 2: out of in_transit, into the destination — accepted quantity only.
    -- BAR-058: any shortfall deliberately REMAINS in in_transit rather than
    -- vanishing. It stays attached to a docket with a reason and a named
    -- acceptor, so it has an owner and a manager can resolve it with an
    -- adjustment. Silently absorbing it is how "never delivered" becomes
    -- invisible.
    if v_acc_ml > 0 then
      v_lines := v_lines
        || jsonb_build_object('sku_id', v_issued.sku_id, 'location_id', v_transit,
                              'container_delta', -v_acc_c, 'ml_delta', -v_acc_ml)
        || jsonb_build_object('sku_id', v_issued.sku_id, 'location_id', v_d.to_location_id,
                              'container_delta', v_acc_c, 'ml_delta', v_acc_ml);
    end if;
  end loop;

  -- A short acceptance must say why. Otherwise the variance has no explanation
  -- and the docket cannot be defended at settlement.
  if v_short and v_reason is null then
    raise exception 'a short acceptance requires difference_reason' using errcode = '23514';
  end if;

  update public.boa_bar_docket
    set status = (case when v_short then 'accepted_short' else 'accepted' end)::public.boa_bar_docket_status,
        accepted_by = auth.uid(),
        accepted_at = now(),
        difference_reason = v_reason
    where id = v_d.id;

  if jsonb_array_length(v_lines) > 0 then
    perform public.boa_bar_submit_movement(jsonb_build_object(
      'venue_id', v_d.venue_id,
      'idempotency_key', v_key,
      'kind', 'issue',
      'business_date', coalesce(p_payload->>'business_date', to_char(now(), 'YYYY-MM-DD')),
      'occurred_at', coalesce(p_payload->>'occurred_at', now()::text),
      'docket_id', v_d.id,
      'source', coalesce(p_payload->>'source', 'pwa'),
      'metadata', jsonb_build_object('leg', 'receipt', 'docket_no', v_d.docket_no, 'short', v_short),
      'lines', v_lines
    ));
  end if;

  return jsonb_build_object(
    'docket_id', v_d.id,
    'docket_no', v_d.docket_no,
    'status', case when v_short then 'accepted_short' else 'accepted' end,
    'short', v_short,
    'replayed', false
  );
end;
$$;

-- Per ADR-013 these RPCs are the write path, so they are executable by signed-in
-- staff while the tables themselves remain read-only. Authorisation happens
-- inside each function.
revoke all on function public.boa_bar_create_docket(jsonb) from public, anon;
revoke all on function public.boa_bar_accept_docket(jsonb) from public, anon;
grant execute on function public.boa_bar_create_docket(jsonb) to authenticated;
grant execute on function public.boa_bar_accept_docket(jsonb) to authenticated;

comment on function public.boa_bar_create_docket(jsonb) is
  'BAR-155. Issues stock: mints the docket and its QR token, and posts leg 1 (source -> in_transit). Returns the raw token once.';
comment on function public.boa_bar_accept_docket(jsonb) is
  'BAR-155. Takes custody: posts leg 2 (in_transit -> destination) for the accepted quantity. Rejects self-acceptance, double acceptance, over-receipt, and an unexplained shortfall.';

commit;
