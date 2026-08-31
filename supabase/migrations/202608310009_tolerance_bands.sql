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

create function public.boa_bar_tolerance_bands()
returns table (
  category_key text,
  green_max_pct numeric,
  amber_max_pct numeric,
  effective_from date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select category_key, green_max_pct, amber_max_pct, effective_from
    from public.boa_bar_tolerance_band
   where effective_from <= current_date
   order by category_key;
$$;

revoke all on function public.boa_bar_tolerance_bands() from public, anon;
grant execute on function public.boa_bar_tolerance_bands() to authenticated;

commit;
