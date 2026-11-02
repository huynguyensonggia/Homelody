-- NULL preserves the current favorites. Saved arrays define an explicit order.
alter table public.shop_settings
  add column if not exists featured_drink_ids jsonb default null
  check (featured_drink_ids is null or (jsonb_typeof(featured_drink_ids) = 'array' and jsonb_array_length(featured_drink_ids) <= 6));
select id, featured_drink_ids from public.shop_settings where id = 1;
