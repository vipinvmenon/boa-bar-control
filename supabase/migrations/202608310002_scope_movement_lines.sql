-- BAR-022 — every movement line must belong to the movement's venue.
--
-- The UUID foreign keys alone only prove that the referenced rows exist. They do
-- not prevent combining a venue A movement with a venue B SKU or location.

begin;

create function private.boa_bar_check_movement_line_scope()
returns trigger
language plpgsql
as $$
declare
  v_movement_venue uuid;
  v_sku_venue uuid;
  v_location_venue uuid;
begin
  select venue_id into v_movement_venue
  from public.boa_bar_movement where id = new.movement_id;
  select venue_id into v_sku_venue
  from public.boa_bar_sku where id = new.sku_id;
  select venue_id into v_location_venue
  from public.boa_bar_location where id = new.location_id;

  if v_movement_venue is null
     or v_sku_venue is distinct from v_movement_venue
     or v_location_venue is distinct from v_movement_venue then
    raise exception 'movement lines must use SKU and location from the movement venue'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger boa_bar_movement_line_scope
before insert on public.boa_bar_movement_line
for each row execute function private.boa_bar_check_movement_line_scope();

comment on function private.boa_bar_check_movement_line_scope() is
  'BAR-022. Prevents cross-venue SKU or location references in ledger lines.';

commit;
