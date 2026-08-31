-- BAR-025 — tolerance bands are audit inputs and belong in versioned data.

begin;

create table public.boa_bar_tolerance_band (
  category_key text primary key,
  green_max_pct numeric(8,4) not null check (green_max_pct >= 0),
  amber_max_pct numeric(8,4) not null check (amber_max_pct > green_max_pct),
  effective_from date not null,
  check (amber_max_pct <= 100)
);

comment on table public.boa_bar_tolerance_band is
  'BAR-025. Versioned variance thresholds used by the audit, not UI decoration.';

insert into public.boa_bar_tolerance_band
  (category_key, green_max_pct, amber_max_pct, effective_from)
values
  ('bottled_beer', 1, 3, '2026-08-31'),
  ('draught_beer', 8, 15, '2026-08-31'),
  ('spirits', 3, 8, '2026-08-31'),
  ('mixers', 2, 5, '2026-08-31');

revoke all on public.boa_bar_tolerance_band from anon, authenticated;

commit;
