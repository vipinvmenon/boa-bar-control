-- BAR-017 — comps are balanced custody moves to hospitality, not depletion.

begin;

-- The movement poster is already the single write implementation. Patch its two
-- kind checks in place so future edits do not create a second copy of the body.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('private.boa_bar_post_movement(jsonb,uuid)'::regprocedure)
    into v_definition;
  v_definition := replace(
    v_definition,
    'if v_kind in (''issue'',''transfer'',''return'') and (v_container_sum <> 0 or v_ml_sum <> 0)',
    'if v_kind in (''issue'',''transfer'',''return'',''comp'') and (v_container_sum <> 0 or v_ml_sum <> 0)'
  );
  v_definition := replace(
    v_definition,
    'if v_kind in (''sale'',''comp'',''waste'') and v_ml_sum >= 0',
    'if v_kind in (''sale'',''waste'') and v_ml_sum >= 0'
  );
  execute v_definition;
end;
$$;

create function private.boa_bar_validate_comp()
returns trigger
language plpgsql
as $$
declare
  v_total_ml bigint;
  v_total_containers bigint;
  v_hospitality boolean;
begin
  if new.kind <> 'comp' then return new; end if;
  select coalesce(sum(ml_delta), 0), coalesce(sum(container_delta), 0),
         bool_or(l.kind = 'hospitality')
    into v_total_ml, v_total_containers, v_hospitality
    from public.boa_bar_movement_line ml
    join public.boa_bar_location l on l.id = ml.location_id
   where ml.movement_id = new.id;
  if v_total_ml <> 0 or v_total_containers <> 0 or not coalesce(v_hospitality, false) then
    raise exception 'comp movements must balance and include a hospitality location'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create constraint trigger boa_bar_validate_comp
after insert on public.boa_bar_movement
deferrable initially deferred
for each row execute function private.boa_bar_validate_comp();

comment on function private.boa_bar_validate_comp() is
  'BAR-017. A comp is a balanced two-leg move with a hospitality destination.';

commit;
