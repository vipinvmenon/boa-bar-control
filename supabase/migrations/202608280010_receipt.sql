-- BAR-060 — recording a delivery.
--
-- Phase 1 of the specification is "receipt + issue + docket". Issue and docket
-- exist; receipt did not. `boa_bar_open_stock` loads the warehouse once at
-- bootstrap and needs a database password, so a pallet arriving from STOK at 14:00
-- on the day had nowhere to be recorded at all.
--
-- Specification §4: a receipt is posted "against a delivery note / invoice
-- number". That is not decoration — it is the document the excise return and the
-- STOK settlement are both reconciled to, so a receipt without one cannot be
-- defended later.
--
-- THE DUPLICATE-DELIVERY GUARD. The idempotency key stops one submission being
-- posted twice. It does not stop a person entering the SAME pallet twice, twenty
-- minutes apart, because that is two different actions — and on a busy load-in
-- that is a genuinely easy mistake which silently inflates the warehouse and shows
-- up later as unexplained shrinkage. A delivery note is unique per supplier per
-- venue, so the second attempt is refused with a sentence naming the first.

begin;

create function public.boa_bar_record_receipt(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_venue uuid := (p_payload->>'venue_id')::uuid;
  v_location uuid := (p_payload->>'location_id')::uuid;
  v_key uuid := (p_payload->>'idempotency_key')::uuid;
  v_supplier text := btrim(coalesce(p_payload->>'supplier',''));
  v_note text := btrim(coalesce(p_payload->>'delivery_note',''));
  v_occurred timestamptz := coalesce((p_payload->>'occurred_at')::timestamptz, now());
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_sku public.boa_bar_sku;
  v_existing uuid;
  v_duplicate text;
  v_movement uuid;
  v_seen uuid[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_key is null then
    raise exception 'idempotency_key is required' using errcode = '22023';
  end if;
  if not private.boa_bar_has_role(v_venue, array['warehouse','manager','admin']::public.boa_bar_role[]) then
    raise exception 'only warehouse, manager or admin may record a delivery' using errcode = '42501';
  end if;

  select id into v_existing from public.boa_bar_movement
    where venue_id = v_venue and idempotency_key = v_key;
  if v_existing is not null then
    return jsonb_build_object('movement_id', v_existing, 'replayed', true);
  end if;

  if v_supplier = '' then
    raise exception 'a delivery needs a supplier' using errcode = '22023';
  end if;
  if v_note = '' then
    raise exception 'a delivery needs its delivery note or invoice number' using errcode = '22023';
  end if;
  if v_occurred > now() + interval '1 hour' then
    raise exception 'occurred_at is in the future; check the device clock' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.boa_bar_location l
    where l.id = v_location and l.venue_id = v_venue and l.active
  ) then
    raise exception 'location does not belong to this venue' using errcode = '23503';
  end if;

  -- The same pallet entered twice, twenty minutes apart, is two actions with two
  -- idempotency keys. This is what catches it.
  select m.occurred_at::text into v_duplicate
  from public.boa_bar_movement m
  where m.venue_id = v_venue
    and m.kind = 'receipt'
    and lower(m.metadata->>'supplier') = lower(v_supplier)
    and lower(m.metadata->>'delivery_note') = lower(v_note)
  limit 1;
  if v_duplicate is not null then
    raise exception 'delivery note % from % was already recorded at %', v_note, v_supplier, v_duplicate
      using errcode = '23505';
  end if;

  if jsonb_typeof(p_payload->'lines') <> 'array' or jsonb_array_length(p_payload->'lines') = 0 then
    raise exception 'a delivery needs at least one line' using errcode = '22023';
  end if;

  for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
    select * into v_sku from public.boa_bar_sku
      where id = (v_line->>'sku_id')::uuid and venue_id = v_venue and active;
    if v_sku.id is null then
      raise exception 'no active SKU % at this venue', v_line->>'sku_id' using errcode = '23503';
    end if;
    if v_sku.id = any(v_seen) then
      raise exception 'the same product appears twice on this delivery' using errcode = '23505';
    end if;
    v_seen := v_seen || v_sku.id;

    if (v_line->>'containers')::integer <= 0 then
      raise exception 'each delivery line must be at least one container' using errcode = '23514';
    end if;

    v_lines := v_lines || jsonb_build_object(
      'sku_id', v_sku.id,
      'location_id', v_location,
      'container_delta', (v_line->>'containers')::integer,
      'ml_delta', (v_line->>'containers')::bigint * v_sku.ml_per_container
    );
  end loop;

  v_movement := private.boa_bar_post_movement(jsonb_build_object(
    'venue_id', v_venue,
    'idempotency_key', v_key,
    'kind', 'receipt',
    'occurred_at', v_occurred,
    'source', coalesce(p_payload->>'source', 'pwa'),
    -- The reason column is what the activity feed shows; the metadata is what the
    -- excise return and the STOK settlement reconcile against.
    'reason', v_supplier || ' · ' || v_note,
    'metadata', jsonb_build_object('supplier', v_supplier, 'delivery_note', v_note),
    'lines', v_lines
  ), auth.uid());

  return jsonb_build_object(
    'movement_id', v_movement,
    'lines', jsonb_array_length(v_lines),
    'replayed', false
  );
end;
$$;

revoke all on function public.boa_bar_record_receipt(jsonb) from public, anon;
grant execute on function public.boa_bar_record_receipt(jsonb) to authenticated;

comment on function public.boa_bar_record_receipt(jsonb) is
  'BAR-060. A delivery against a delivery note, per spec §4. Refuses a repeat of the same note from the same supplier.';

commit;
