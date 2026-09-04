-- BAR-166 — close or abandon an open count.
--
-- THE DEFECT. Opening a count is what blinds the device to that location
-- (BAR-161): while a draft session exists, `boa_bar_inventory_snapshot` withholds
-- the location and the `boa_bar_movement_line` read policy refuses its rows, so
-- the position cannot be re-summed from the ledger either. Nothing closed a
-- session except submitting it.
--
-- So a crew member who opens a count on the wrong bar — at 21:00, on a shared
-- phone, in the dark, which is not a hypothetical — is blind to that bar's stock
-- for the rest of the night, with no way out but to submit a count they did not
-- take. Submitting a false count to escape a UI state is the worst available
-- outcome: it seals a theoretical position (BAR-084) and puts a signed figure
-- into the variance report.
--
-- BAR-165 made the state legible by warning before you leave a count. It could
-- not make it escapable without this.
--
-- WHAT THIS REFUSES, and why each matters:
--
--   * a submitted session          — it is sealed and it is evidence (BAR-084).
--                                    The remedy for a wrong submitted count is a
--                                    recount that supersedes it (BAR-145), which
--                                    keeps both on the record. Abandoning one
--                                    would delete an audit trail.
--   * somebody else's session      — the blind is per-user, so abandoning another
--                                    person's count would neither help them nor
--                                    be theirs to do. A manager who needs to
--                                    intervene has the recount path.
--   * a blank reason               — "why is this bar's count being thrown away"
--                                    is the question the next morning asks. Same
--                                    rule as the adjustment guard (BAR-021) and
--                                    the supersede reason (BAR-145).
--
-- It deliberately does NOT delete the session or its lines. The ledger is
-- append-only and so is everything derived from it: an abandoned count keeps its
-- lines, its author and its timestamps, and gains the fact that it was abandoned.
-- Anyone asking "did somebody start counting Bar 2 and give up?" gets an answer.

begin;

alter table public.boa_bar_count_session
  add column abandoned_at timestamptz,
  add column abandoned_by uuid references auth.users(id),
  add column abandon_reason text;

comment on column public.boa_bar_count_session.abandoned_at is
  'When this draft count was abandoned without being submitted (BAR-166). Null for every session that is still open or was submitted.';
comment on column public.boa_bar_count_session.abandoned_by is
  'Who abandoned it. Recorded separately from assigned_to because a shared device may change hands mid-shift (BAR-141).';
comment on column public.boa_bar_count_session.abandon_reason is
  'Why the count was thrown away. Required by boa_bar_abandon_count; the question the next morning asks.';

-- The three abandonment facts move together or not at all. A session with an
-- `abandoned_at` and no reason is exactly the record this task exists to avoid.
alter table public.boa_bar_count_session
  add constraint boa_bar_count_session_abandon_complete check (
    (abandoned_at is null and abandoned_by is null and abandon_reason is null)
    or (abandoned_at is not null and abandoned_by is not null
        and abandon_reason is not null and length(btrim(abandon_reason)) > 0)
  );

-- Terminal means terminal: an abandoned session cannot be resurrected, and the
-- reason cannot be rewritten later.
create or replace function private.boa_bar_count_session_abandon_guard()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if old.abandoned_at is not null then
    if new.abandoned_at is distinct from old.abandoned_at
       or new.abandoned_by is distinct from old.abandoned_by
       or new.abandon_reason is distinct from old.abandon_reason
       or new.status is distinct from old.status then
      raise exception 'an abandoned count session is final; start a new count instead'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.boa_bar_count_session_abandon_guard() from public, anon, authenticated;

create trigger boa_bar_count_session_abandon_immutable
  before update on public.boa_bar_count_session
  for each row execute function private.boa_bar_count_session_abandon_guard();

-- ---------------------------------------------------------------------------
-- boa_bar_abandon_count
-- ---------------------------------------------------------------------------
-- One command per user action, so it queues in the outbox and replays safely
-- (ADR-013, BAR-069). Replay is idempotent: abandoning an already-abandoned
-- session returns the same answer rather than raising, because the device may
-- have posted successfully and lost the reply.

create function public.boa_bar_abandon_count(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session uuid := (p_payload->>'count_session_id')::uuid;
  v_reason text := btrim(coalesce(p_payload->>'reason', ''));
  v_row public.boa_bar_count_session;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_session is null then
    raise exception 'count_session_id is required' using errcode = '22023';
  end if;
  if v_reason = '' then
    raise exception 'a reason is required to abandon a count' using errcode = '22023';
  end if;

  select * into v_row from public.boa_bar_count_session where id = v_session;
  if not found then
    raise exception 'count session not found' using errcode = '23503';
  end if;

  -- Idempotent replay. Checked before the ownership and status rules so a
  -- successful command whose reply was lost cannot come back as an error.
  if v_row.abandoned_at is not null then
    return jsonb_build_object(
      'count_session_id', v_row.id,
      'status', 'abandoned',
      'replayed', true
    );
  end if;

  if v_row.assigned_to <> auth.uid() then
    raise exception 'only the person holding this count can abandon it'
      using errcode = '42501';
  end if;

  if v_row.status <> 'draft' or v_row.submitted_at is not null then
    raise exception 'a submitted count cannot be abandoned; take a recount instead, which supersedes it and keeps both on the record'
      using errcode = '23514';
  end if;

  update public.boa_bar_count_session
     set status = 'abandoned',
         abandoned_at = now(),
         abandoned_by = auth.uid(),
         abandon_reason = v_reason
   where id = v_session;

  -- The blind lifts here, and it lifts because of this UPDATE rather than
  -- anything in this function: private.boa_bar_is_blinded tests
  -- `status = 'draft'`, so the location becomes readable to this user again the
  -- moment the status changes. No policy or predicate is edited by this task.
  return jsonb_build_object(
    'count_session_id', v_session,
    'status', 'abandoned',
    'replayed', false
  );
end;
$$;

revoke all on function public.boa_bar_abandon_count(jsonb) from public, anon;
grant execute on function public.boa_bar_abandon_count(jsonb) to authenticated;

comment on function public.boa_bar_abandon_count(jsonb) is
  'BAR-166. Ends a DRAFT count session without submitting it, lifting the blind on that location. Refuses a submitted session, refuses somebody else''s, and requires a reason. Idempotent on replay.';

commit;
