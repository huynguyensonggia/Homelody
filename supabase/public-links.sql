-- Additive only: retains the existing links until the admin explicitly saves the form.
alter table public.shop_settings
  add column if not exists public_links jsonb not null default '{}'::jsonb
  check (jsonb_typeof(public_links) = 'object');

select id, public_links from public.shop_settings where id = 1;
