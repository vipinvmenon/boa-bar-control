-- BAR-018 — sale movements are an import result, never a hand-keyed command.
--
-- The general movement RPC remains the common ledger writer, but a sale may
-- only reach the ledger from the future POS import path (`source = 'pos'`).
-- Keeping this invariant in a trigger protects the append-only table even if a
-- second command path is introduced later.

begin;

create function private.boa_bar_reject_hand_keyed_sale()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'sale' and coalesce(new.source, '') <> 'pos' then
    raise exception 'sale movements must come from POS import' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger boa_bar_reject_hand_keyed_sale
before insert on public.boa_bar_movement
for each row execute function private.boa_bar_reject_hand_keyed_sale();

comment on function private.boa_bar_reject_hand_keyed_sale() is
  'BAR-018. Hand-keyed sale movements are forbidden; POS import is the only source.';

commit;
