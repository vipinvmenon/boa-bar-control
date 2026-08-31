-- BAR-026 — excise categories are controlled reference data, not a hardcoded
-- TypeScript enum. The initial vocabulary is deliberately small; adding a new
-- category later is a data/migration change, not a schema rewrite.

begin;

create table public.boa_bar_excise_category (
  category_key text primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.boa_bar_excise_category (category_key, label)
values
  ('beer', 'Beer'),
  ('imfl', 'IMFL'),
  ('mixer', 'Mixer'),
  ('water', 'Water'),
  ('other', 'Other');

update public.boa_bar_sku
   set excise_category = case
     when excise_category = 'spirit' then 'imfl'
     when excise_category is null and category_key in ('bottled_beer', 'draught_beer') then 'beer'
     when excise_category is null and category_key = 'mixers' then 'mixer'
     when excise_category is null then 'other'
     else excise_category
   end;

alter table public.boa_bar_sku
  alter column excise_category set not null;

alter table public.boa_bar_sku
  add constraint boa_bar_sku_excise_category_fk
  foreign key (excise_category) references public.boa_bar_excise_category(category_key);

comment on table public.boa_bar_excise_category is
  'BAR-026. Dynamic excise vocabulary, seeded for the current event and extendable as stock data arrives.';

revoke all on public.boa_bar_excise_category from anon, authenticated;

commit;
