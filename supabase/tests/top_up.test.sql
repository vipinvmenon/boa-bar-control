-- @proves: BEHAVIOURAL | BAR-064 top-up creation, field persistence,
-- @proves: BEHAVIOURAL | idempotency, authorization, warehouse visibility and
-- @proves: BEHAVIOURAL | the request -> docket -> acceptance lifecycle.

begin;
create extension if not exists pgtap;

select plan(21);

insert into public.boa_bar_venue (id, code, name, event_date, timezone) values
  ('00000000-0000-4000-8000-000000000640', 'TEST-TOP-UP', 'Top-up test', '2026-10-10', 'Asia/Kolkata');

insert into public.boa_bar_location (id, venue_id, code, name, kind) values
  ('00000000-0000-4000-8000-000000000641', '00000000-0000-4000-8000-000000000640', 'WH', 'Warehouse', 'warehouse'),
  ('00000000-0000-4000-8000-000000000642', '00000000-0000-4000-8000-000000000640', 'BAR', 'Test Bar', 'bar'),
  ('00000000-0000-4000-8000-000000000643', '00000000-0000-4000-8000-000000000640', 'TRANSIT', 'In transit', 'in_transit');

insert into public.boa_bar_sku (
  id, venue_id, code, name, category_key, container_type,
  ml_per_container, units_per_case, excise_category
) values (
  '00000000-0000-4000-8000-000000000644',
  '00000000-0000-4000-8000-000000000640',
  'TEST-BEER', 'Test Beer', 'bottled_beer', 'bottle', 650, 24, 'beer'
);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000645', 'authenticated', 'authenticated', 'lead-top-up@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000646', 'authenticated', 'authenticated', 'warehouse-top-up@example.test', now(), now()),
  ('00000000-0000-4000-8000-000000000647', 'authenticated', 'authenticated', 'crew-top-up@example.test', now(), now());

insert into public.boa_bar_membership (venue_id, user_id, role, location_id, active) values
  ('00000000-0000-4000-8000-000000000640', '00000000-0000-4000-8000-000000000645', 'bar_lead', '00000000-0000-4000-8000-000000000642', true),
  ('00000000-0000-4000-8000-000000000640', '00000000-0000-4000-8000-000000000646', 'warehouse', '00000000-0000-4000-8000-000000000641', true),
  ('00000000-0000-4000-8000-000000000640', '00000000-0000-4000-8000-000000000647', 'crew', '00000000-0000-4000-8000-000000000642', true);

-- Give the isolated warehouse enough ledger stock for the linked issue.
select private.boa_bar_post_movement(jsonb_build_object(
  'venue_id', '00000000-0000-4000-8000-000000000640',
  'idempotency_key', '00000000-0000-4000-8000-000000000648',
  'kind', 'receipt',
  'source', 'top-up-test',
  'lines', jsonb_build_array(jsonb_build_object(
    'sku_id', '00000000-0000-4000-8000-000000000644',
    'location_id', '00000000-0000-4000-8000-000000000641',
    'container_delta', 10,
    'ml_delta', 6500
  ))
), '00000000-0000-4000-8000-000000000646'::uuid);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000645","role":"authenticated"}';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000645', true);
set local role authenticated;

select lives_ok(
  $$ select public.boa_bar_request_top_up(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000640',
       'location_id', '00000000-0000-4000-8000-000000000642',
       'sku_id', '00000000-0000-4000-8000-000000000644',
       'requested_containers', 2,
       'urgency', 'urgent',
       'note', '  Main bar nearly dry  ',
       'idempotency_key', '00000000-0000-4000-8000-000000000649')) $$,
  'an assigned bar lead can create a top-up request'
);

reset role;

select is(
  (select concat_ws('|', location_id, sku_id, requested_containers, urgency, note)
   from public.boa_bar_top_up_request
   where idempotency_key = '00000000-0000-4000-8000-000000000649'),
  '00000000-0000-4000-8000-000000000642|00000000-0000-4000-8000-000000000644|2|urgent|Main bar nearly dry',
  'location, SKU, quantity, urgency and trimmed note are persisted'
);

set local role authenticated;

select is(
  (public.boa_bar_request_top_up(jsonb_build_object(
    'venue_id', '00000000-0000-4000-8000-000000000640',
    'location_id', '00000000-0000-4000-8000-000000000642',
    'sku_id', '00000000-0000-4000-8000-000000000644',
    'requested_containers', 2,
    'urgency', 'urgent',
    'note', 'Main bar nearly dry',
    'idempotency_key', '00000000-0000-4000-8000-000000000649'))->>'replayed'),
  'true',
  'the same idempotency request replays as success'
);

reset role;
select is(
  (select count(*)::integer from public.boa_bar_top_up_request
   where idempotency_key = '00000000-0000-4000-8000-000000000649'),
  1,
  'an idempotent replay creates no duplicate row'
);
set local role authenticated;

select throws_ok(
  $$ select public.boa_bar_request_top_up(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000640',
       'location_id', '00000000-0000-4000-8000-000000000642',
       'sku_id', '00000000-0000-4000-8000-000000000644',
       'requested_containers', 3,
       'urgency', 'urgent',
       'note', 'Main bar nearly dry',
       'idempotency_key', '00000000-0000-4000-8000-000000000649')) $$,
  '23505',
  'idempotency key already belongs to a different top-up request',
  'reusing a key for different facts is rejected'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000647","role":"authenticated"}';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000647', true);
select throws_ok(
  $$ select public.boa_bar_request_top_up(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000640',
       'location_id', '00000000-0000-4000-8000-000000000642',
       'sku_id', '00000000-0000-4000-8000-000000000644',
       'requested_containers', 1,
       'urgency', 'normal',
       'idempotency_key', '00000000-0000-4000-8000-000000000650')) $$,
  '42501',
  'not authorised to request stock for this bar',
  'a crew member cannot create a top-up request'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000646","role":"authenticated"}';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000646', true);
select is(
  jsonb_array_length(public.boa_bar_list_top_up_requests('00000000-0000-4000-8000-000000000640')),
  1,
  'warehouse can list the active request'
);

select throws_ok(
  $$ select public.boa_bar_update_top_up(jsonb_build_object(
       'request_id', (select id from public.boa_bar_top_up_request
                      where idempotency_key = '00000000-0000-4000-8000-000000000649'),
       'status', 'fulfilled')) $$,
  '23514',
  'invalid top-up status transition',
  'requested cannot skip directly to fulfilled'
);

select lives_ok(
  $$ select public.boa_bar_create_docket(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000640',
       'actor_id', '00000000-0000-4000-8000-000000000646',
       'from_location_id', '00000000-0000-4000-8000-000000000641',
       'to_location_id', '00000000-0000-4000-8000-000000000642',
       'top_up_request_id', (select id from public.boa_bar_top_up_request
                             where idempotency_key = '00000000-0000-4000-8000-000000000649'),
       'idempotency_key', '00000000-0000-4000-8000-000000000651',
       'source', 'top-up-test',
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000644',
         'containers', 2,
         'ml', 1300)))) $$,
  'a warehouse issue creates a linked docket'
);

reset role;
select is(
  (select status::text from public.boa_bar_top_up_request
   where idempotency_key = '00000000-0000-4000-8000-000000000649'),
  'issued',
  'linked docket creation moves requested to issued'
);
select ok(
  (select docket_id is not null from public.boa_bar_top_up_request
   where idempotency_key = '00000000-0000-4000-8000-000000000649'),
  'the issued request retains its docket link'
);

set local role authenticated;
select throws_ok(
  $$ select public.boa_bar_update_top_up(jsonb_build_object(
       'request_id', (select id from public.boa_bar_top_up_request
                      where idempotency_key = '00000000-0000-4000-8000-000000000649'),
       'status', 'cancelled')) $$,
  '23514',
  'invalid top-up status transition',
  'an issued request cannot be cancelled while its docket is in custody'
);

select throws_ok(
  $$ select public.boa_bar_create_docket(jsonb_build_object(
       'venue_id', '00000000-0000-4000-8000-000000000640',
       'actor_id', '00000000-0000-4000-8000-000000000646',
       'from_location_id', '00000000-0000-4000-8000-000000000641',
       'to_location_id', '00000000-0000-4000-8000-000000000642',
       'idempotency_key', '00000000-0000-4000-8000-000000000654',
       'source', 'top-up-negative-test',
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000644',
         'containers', 20,
         'ml', 13000)))) $$,
  '23514',
  'movement would make a location position negative',
  'the corrected projection trigger still rejects a real negative position'
);

reset role;
select is(
  (select count(*)::integer from public.boa_bar_movement
   where idempotency_key = '00000000-0000-4000-8000-000000000654'),
  0,
  'a rejected negative issue leaves no ledger movement'
);
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000647","role":"authenticated"}';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000647', true);
select lives_ok(
  $$ select public.boa_bar_accept_docket(jsonb_build_object(
       'actor_id', '00000000-0000-4000-8000-000000000647',
       'docket_id', (select docket_id from public.boa_bar_top_up_request
                     where idempotency_key = '00000000-0000-4000-8000-000000000649'),
       'idempotency_key', '00000000-0000-4000-8000-000000000652',
       'source', 'top-up-test',
       'lines', jsonb_build_array(jsonb_build_object(
         'sku_id', '00000000-0000-4000-8000-000000000644',
         'containers', 2,
         'ml', 1300)))) $$,
  'the receiving crew member can fully accept the linked docket'
);

reset role;
select is(
  (select status::text from public.boa_bar_top_up_request
   where idempotency_key = '00000000-0000-4000-8000-000000000649'),
  'fulfilled',
  'full docket acceptance automatically fulfils the request'
);
select is(
  (select fulfilled_by from public.boa_bar_top_up_request
   where idempotency_key = '00000000-0000-4000-8000-000000000649'),
  '00000000-0000-4000-8000-000000000647'::uuid,
  'fulfilment records the accepting actor'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000646","role":"authenticated"}';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000646', true);
set local role authenticated;
select throws_ok(
  $$ select public.boa_bar_update_top_up(jsonb_build_object(
       'request_id', (select id from public.boa_bar_top_up_request
                      where idempotency_key = '00000000-0000-4000-8000-000000000649'),
       'status', 'cancelled')) $$,
  '23514',
  'invalid top-up status transition',
  'a fulfilled request is terminal'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000645","role":"authenticated"}';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000645', true);
select public.boa_bar_request_top_up(jsonb_build_object(
  'venue_id', '00000000-0000-4000-8000-000000000640',
  'location_id', '00000000-0000-4000-8000-000000000642',
  'sku_id', '00000000-0000-4000-8000-000000000644',
  'requested_containers', 1,
  'urgency', 'normal',
  'idempotency_key', '00000000-0000-4000-8000-000000000653'
));

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000646","role":"authenticated"}';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000646', true);
select lives_ok(
  $$ select public.boa_bar_update_top_up(jsonb_build_object(
       'request_id', (select id from public.boa_bar_top_up_request
                      where idempotency_key = '00000000-0000-4000-8000-000000000653'),
       'status', 'cancelled')) $$,
  'warehouse can cancel a request before issue'
);

reset role;
select is(
  (select status::text from public.boa_bar_top_up_request
   where idempotency_key = '00000000-0000-4000-8000-000000000653'),
  'cancelled',
  'requested to cancelled is a valid terminal transition'
);

select is(
  (select count(*)::integer from public.boa_bar_top_up_request
   where idempotency_key = '00000000-0000-4000-8000-000000000650'),
  0,
  'the unauthorized request persisted nothing'
);

select * from finish();
rollback;
