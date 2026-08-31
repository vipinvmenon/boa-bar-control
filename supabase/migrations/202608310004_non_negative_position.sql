-- BAR-028 — a movement must never leave a location with negative stock.
--
-- The ledger remains append-only and the balance projection is still written only
-- by private.boa_bar_post_movement. This trigger protects the projection at that
-- single write boundary, regardless of which command RPC supplied the movement.

begin;

create function private.boa_bar_reject_negative_position()
returns trigger
language plpgsql
as $$
begin
  if new.containers < 0 or new.ml < 0 then
    raise exception 'movement would make a location position negative'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger boa_bar_reject_negative_position
before insert or update on private.boa_bar_balance
for each row execute function private.boa_bar_reject_negative_position();

comment on function private.boa_bar_reject_negative_position() is
  'BAR-028. A ledger movement cannot leave the derived location position negative.';

commit;
