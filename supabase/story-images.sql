-- Chạy một lần trong Supabase SQL Editor nếu đã cài database trước đây.
-- Dùng quyền đọc/cập nhật shop_settings và kho menu-images hiện có.
alter table public.shop_settings
  add column if not exists story_images jsonb not null default '[]'::jsonb;
