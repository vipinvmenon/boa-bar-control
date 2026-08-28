-- BAR-123 — the business date spans the festival night.
--
-- The first BEHAVIOURAL test in this suite: it calls a function with real inputs
-- and asserts the answer, rather than asserting that an object exists. The
-- existing ledger.test.sql assertions check existence only, which is why they
-- passed for a week while two EXECUTE holes were open (BAR-030).
--
-- It can run because the venue is seeded reference data, so there is a real
-- timezone and a real cutoff to compute against.

begin;
create extension if not exists pgtap;

select plan(9);

select has_column('public', 'boa_bar_venue', 'business_day_start_hour', 'the venue carries a business-day cutoff');

-- The case the whole task exists for. A close-out count taken at 01:30 on the
-- morning of the 11th is part of the 10 October event, and if it records as the
-- 11th the identity cannot close for the event.
select is(
  private.boa_bar_business_date('00000000-0000-4000-8000-000000000001', '2026-10-11 01:30+05:30'::timestamptz),
  '2026-10-10'::date,
  '01:30 after the event night belongs to the event date'
);

select is(
  private.boa_bar_business_date('00000000-0000-4000-8000-000000000001', '2026-10-11 05:59+05:30'::timestamptz),
  '2026-10-10'::date,
  'one minute before the cutoff still belongs to the event date'
);

select is(
  private.boa_bar_business_date('00000000-0000-4000-8000-000000000001', '2026-10-11 06:00+05:30'::timestamptz),
  '2026-10-11'::date,
  'the cutoff itself starts the next business day'
);

select is(
  private.boa_bar_business_date('00000000-0000-4000-8000-000000000001', '2026-10-10 23:00+05:30'::timestamptz),
  '2026-10-10'::date,
  'late evening is the same business day'
);

select is(
  private.boa_bar_business_date('00000000-0000-4000-8000-000000000001', '2026-10-10 07:00+05:30'::timestamptz),
  '2026-10-10'::date,
  'load-in morning is the same business day'
);

-- Deliberate and worth stating: pre-dawn work belongs to the previous business
-- day. With a 06:00 cutoff that is what a cutoff MEANS, and it is configurable
-- per venue if the operating reality differs.
select is(
  private.boa_bar_business_date('00000000-0000-4000-8000-000000000001', '2026-10-10 05:00+05:30'::timestamptz),
  '2026-10-09'::date,
  'before the cutoff on event morning belongs to the previous business day'
);

-- The venue timezone is used, not the server's or the caller's. Same instant,
-- expressed in UTC, must give the same answer.
select is(
  private.boa_bar_business_date('00000000-0000-4000-8000-000000000001', '2026-10-10 20:00+00:00'::timestamptz),
  '2026-10-10'::date,
  'the instant is interpreted in the venue timezone, however it was expressed'
);

select is(
  private.boa_bar_business_date('00000000-0000-4000-8000-000000000999', now()),
  null,
  'an unknown venue yields null rather than a silent wrong date'
);

select * from finish();
rollback;
