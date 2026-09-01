-- BAR-028 follow-up found during BAR-064 hosted behavior testing.
--
-- A BEFORE INSERT trigger runs before ON CONFLICT decides to update the
-- existing balance row. For a valid depletion, NEW therefore contains only the
-- negative delta and is rejected even when the location has enough stock. An
-- AFTER trigger sees the final inserted or updated position; raising still
-- rolls the whole statement and movement back atomically.

begin;

drop trigger if exists boa_bar_reject_negative_position on private.boa_bar_balance;

create trigger boa_bar_reject_negative_position
after insert or update on private.boa_bar_balance
for each row execute function private.boa_bar_reject_negative_position();

commit;
