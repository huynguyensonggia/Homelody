-- Database đã cài: chạy một lần trong Supabase SQL Editor.
-- Dùng quyền đọc/cập nhật shop_settings và bucket menu-images hiện có.
alter table public.shop_settings
  add column if not exists space_images jsonb not null default '[]'::jsonb;
