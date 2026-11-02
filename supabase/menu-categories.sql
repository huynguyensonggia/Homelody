-- Additive: NULL uses the existing website categories until the admin saves a change.
alter table public.shop_settings
  add column if not exists menu_categories jsonb default null
  check (menu_categories is null or jsonb_typeof(menu_categories) = 'array');

select id, menu_categories from public.shop_settings where id = 1;
