-- @proves: BEHAVIOURAL | Creates and claims real invites and asserts the resulting
-- @proves: BEHAVIOURAL | membership. Proves privilege escalation is refused, that a
-- @proves: BEHAVIOURAL | code is single-use, and that the last admin cannot be removed.
--
-- BAR-143 / BAR-144 — enrolling staff on site.
--
-- The assertions that matter are the ones about escalation. An invite carries a
-- role, so if a bar lead could mint one they could promote themselves by claiming
-- it on a second account — which would hand them variance, reports and count
-- sign-off, the three things the role gate exists to protect.

begin;
create extension if not exists pgtap;

select plan(10);

-- Use an isolated venue so the live bootstrap admin cannot make the synthetic
-- admin below look like a second admin. The whole setup is rolled back.
insert into public.boa_bar_venue (id, code, name, event_date, timezone) values
  ('00000000-0000-4000-8000-0000000000d0', 'TEST-MEMBERSHIP', 'Membership test', '2026-10-10', 'Asia/Kolkata');

insert into public.boa_bar_location (id, venue_id, code, name, kind) values
  ('00000000-0000-4000-8000-0000000000d4',
   '00000000-0000-4000-8000-0000000000d0', 'BAR-TEST', 'Test bar', 'bar');

-- An admin, a bar lead, and somebody arriving at 20:00 with no access at all.
insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000d1','authenticated','authenticated','admin@example.test',now(),now()),
  ('00000000-0000-4000-8000-0000000000d2','authenticated','authenticated','lead@example.test',now(),now()),
  ('00000000-0000-4000-8000-0000000000d3','authenticated','authenticated','newstarter@example.test',now(),now());

insert into public.boa_bar_membership (venue_id, user_id, role, active) values
  ('00000000-0000-4000-8000-0000000000d0','00000000-0000-4000-8000-0000000000d1','admin',true),
  ('00000000-0000-4000-8000-0000000000d0','00000000-0000-4000-8000-0000000000d2','bar_lead',true);

-- ---------------------------------------------------------------------------
-- As the bar lead: cannot invite at all, and certainly cannot mint a manager.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}';

select throws_ok(
  $$ select public.boa_bar_create_invite(jsonb_build_object(
       'venue_id','00000000-0000-4000-8000-0000000000d0',
       'role','crew','display_name','Someone')) $$,
  '42501',
  'only a manager or admin may invite staff',
  'a bar lead cannot invite staff'
);

-- ---------------------------------------------------------------------------
-- As the admin.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}';

select lives_ok(
  $$ select public.boa_bar_create_invite(jsonb_build_object(
       'venue_id','00000000-0000-4000-8000-0000000000d0',
       'role','bar_lead',
       'location_id','00000000-0000-4000-8000-0000000000d4',
       'display_name','Aditi')) $$,
  'an admin can invite a bar lead'
);

select is(
  (select length(code) from public.boa_bar_invite where display_name = 'Aditi'),
  6,
  'the code is six characters, for reading aloud across a loading bay'
);

select is(
  (select count(*)::int from public.boa_bar_invite
   where display_name = 'Aditi' and code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  1,
  'and uses an alphabet with no O/0 or I/1 to mishear'
);

select throws_ok(
  $$ select public.boa_bar_create_invite(jsonb_build_object(
       'venue_id','00000000-0000-4000-8000-0000000000d0',
       'role','crew','display_name','')) $$,
  '22023',
  'an invite needs the person''s name',
  'an invite must name the person, so custody is never anonymous'
);

-- ---------------------------------------------------------------------------
-- The new starter claims it.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000d3","role":"authenticated"}';

select lives_ok(
  $$ select public.boa_bar_claim_invite(
       (select code from public.boa_bar_invite where display_name = 'Aditi')) $$,
  'a signed-in user with no access can claim the code'
);

select is(
  (select role::text from public.boa_bar_membership
   where user_id = '00000000-0000-4000-8000-0000000000d3' and active),
  'bar_lead',
  'and receives exactly the role the invite carried'
);

-- The name arrives with the membership, so the first movement they post already
-- carries a real name rather than being backfilled later.
select is(
  (select display_name from public.boa_bar_person
   where user_id = '00000000-0000-4000-8000-0000000000d3'),
  'Aditi',
  'and is named from the invite'
);

select throws_ok(
  $$ select public.boa_bar_claim_invite(
       (select code from public.boa_bar_invite where display_name = 'Aditi')) $$,
  '42501',
  'that code is not valid',
  'a code cannot be claimed twice'
);

-- ---------------------------------------------------------------------------
-- The last admin cannot lock everybody out.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}';

select throws_ok(
  $$ select public.boa_bar_set_membership(jsonb_build_object(
       'venue_id','00000000-0000-4000-8000-0000000000d0',
       'user_id','00000000-0000-4000-8000-0000000000d1',
       'active', false)) $$,
  '23514',
  'this is the last admin; promote somebody else first',
  'the last admin cannot remove themselves mid-event'
);

select * from finish();
rollback;
