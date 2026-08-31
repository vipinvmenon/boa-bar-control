-- BAR-021 — adjustments are supervisor corrections, not another hand-keyed
-- movement path. The ledger remains append-only; a correction is a new row.

begin;

create unique index boa_bar_movement_one_reversal_idx
  on public.boa_bar_movement (reverses_movement_id)
  where reverses_movement_id is not null;

create function private.boa_bar_guard_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_original public.boa_bar_movement;
  v_authorised boolean;
begin
  if new.kind <> 'adjustment' then return new; end if;

  if new.reason is null or btrim(new.reason) = '' then
    raise exception 'adjustments require a reason' using errcode = '23514';
  end if;

  select exists (
    select 1
      from public.boa_bar_membership m
     where m.venue_id = new.venue_id
       and m.user_id = new.actor_id
       and m.active
       and m.role in ('manager', 'admin')
  ) into v_authorised;
  if not v_authorised then
    raise exception 'only a manager or admin can post an adjustment' using errcode = '42501';
  end if;

  if new.reverses_movement_id is not null then
    select * into v_original
      from public.boa_bar_movement
     where id = new.reverses_movement_id;
    if not found or v_original.venue_id is distinct from new.venue_id then
      raise exception 'an adjustment can only reverse a movement in its venue'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger boa_bar_guard_adjustment
before insert on public.boa_bar_movement
for each row execute function private.boa_bar_guard_adjustment();

comment on function private.boa_bar_guard_adjustment() is
  'BAR-021. Adjustment movements require a manager/admin, a reason, and a same-venue reversal.';

commit;
