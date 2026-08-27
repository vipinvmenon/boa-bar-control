insert into public.boa_bar_venue (id, code, name, event_date, timezone)
values ('00000000-0000-4000-8000-000000000001', 'boa-2026', 'Bangalore Open Air 2026', '2026-10-10', 'Asia/Kolkata')
on conflict (id) do nothing;

insert into public.boa_bar_location (id, venue_id, code, name, kind) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'warehouse', 'Warehouse', 'warehouse'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'bar_1', 'Bar 1 · Main', 'bar'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'bar_2', 'Bar 2 · East', 'bar'),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'bar_3', 'Bar 3 · West', 'bar'),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'bar_4', 'Bar 4 · VIP', 'bar'),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'hospitality', 'Hospitality', 'hospitality'),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'eddies_lounge', 'Eddie’s Lounge', 'lounge'),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', 'promoters_lounge', 'Promoter’s Lounge', 'lounge'),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000001', 'in_transit', 'In transit', 'in_transit')
on conflict (id) do nothing;

insert into public.boa_bar_sku (id, venue_id, code, name, category_key, container_type, ml_per_container, units_per_case, tare_weight_g, is_supplied) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'KF650', 'Kingfisher Premium', 'bottled_beer', '650 ml bottle', 650, 12, null, true),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'BUD500', 'Budweiser', 'bottled_beer', '500 ml can', 500, 24, null, false),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'COR355', 'Corona Extra', 'bottled_beer', '355 ml bottle', 355, 24, null, false),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'STOK30', 'STOK Draught', 'draught_beer', '30 L keg', 30000, 1, null, true),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001', 'OM750', 'Old Monk', 'spirits', '750 ml bottle', 750, 12, 480, false),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000001', 'COKE300', 'Coca-Cola', 'mixers', '300 ml can', 300, 24, null, false)
on conflict (id) do nothing;

-- Auth users are intentionally not seeded here. Create local users through Studio/Auth,
-- then insert a boa_bar_membership row using the generated auth.users.id.
