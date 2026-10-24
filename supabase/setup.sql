-- =====================================================================
-- HOMELODY — cơ sở dữ liệu menu động (Supabase)
-- Cách chạy: Supabase Dashboard → SQL Editor → New query → dán TOÀN BỘ file → Run.
-- Chạy lại nhiều lần cũng không sao (không xóa dữ liệu đã có).
--
-- BƯỚC BẮT BUỘC sau khi chạy: sửa email ở cuối file (mục 6) thành email đăng nhập
-- của người được quyền sửa menu, rồi chạy lại riêng đoạn đó.
-- =====================================================================

-- 1. Danh sách email được quyền sửa menu --------------------------------
create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- Không tạo policy: bảng này chỉ sửa được trong Dashboard / SQL Editor.

-- Hàm có quyền đọc danh sách quản trị đặt trong schema không expose qua Data API.
create schema if not exists homelody_private;
revoke all on schema homelody_private from public;
grant usage on schema homelody_private to anon, authenticated;
revoke all on public.admin_users from anon, authenticated;

create or replace function homelody_private.is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.admin_users a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
revoke all on function homelody_private.is_admin() from public;
grant execute on function homelody_private.is_admin() to anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security invoker
set search_path = ''
as $$ select homelody_private.is_admin(); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2. Món ----------------------------------------------------------------
create table if not exists public.drinks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  category    text not null default 'Cà phê Việt',
  price       integer not null default 0 check (price >= 0),
  description text not null default '',
  note        text not null default '',          -- ghi chú hương vị: "Thanh nhẹ · Béo dịu"
  ingredients text[] not null default '{}',
  image_url   text not null default '',
  image_alt   text not null default '',
  is_active   boolean not null default true,      -- false = ẩn khỏi web (hết món)
  is_featured boolean not null default false,     -- true = hiện ở phần đầu trang (bàn xoay)
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists drinks_sort_idx on public.drinks (sort_order, created_at);

-- 3. Thông tin quán (luôn chỉ có 1 dòng, id = 1) --------------------------
create table if not exists public.shop_settings (
  id             integer primary key default 1 check (id = 1),
  address        text not null default '',
  hours          text not null default '',
  phone          text not null default '',
  directions_url text not null default '',
  contact_url    text not null default '',
  facebook_url   text not null default '',
  instagram_url  text not null default '',
  tiktok_url     text not null default '',
  updated_at     timestamptz not null default now()
);
alter table public.shop_settings add column if not exists story_images jsonb not null default '[]'::jsonb;
alter table public.shop_settings add column if not exists space_images jsonb not null default '[]'::jsonb;

insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

-- tự cập nhật updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists drinks_touch on public.drinks;
create trigger drinks_touch before update on public.drinks
  for each row execute function public.touch_updated_at();
drop trigger if exists shop_touch on public.shop_settings;
create trigger shop_touch before update on public.shop_settings
  for each row execute function public.touch_updated_at();

-- 4. Quyền truy cập (Row Level Security) ----------------------------------
-- Khách xem web: chỉ ĐỌC món đang bán + thông tin quán.
-- Người trong admin_users (đã đăng nhập): đọc/ghi tất cả.
alter table public.drinks enable row level security;
alter table public.shop_settings enable row level security;

drop policy if exists "drinks: public read active" on public.drinks;
create policy "drinks: public read active" on public.drinks
  for select using (is_active or public.is_admin());

drop policy if exists "drinks: admin insert" on public.drinks;
create policy "drinks: admin insert" on public.drinks
  for insert to authenticated with check (public.is_admin());

drop policy if exists "drinks: admin update" on public.drinks;
create policy "drinks: admin update" on public.drinks
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "drinks: admin delete" on public.drinks;
create policy "drinks: admin delete" on public.drinks
  for delete to authenticated using (public.is_admin());

drop policy if exists "shop: public read" on public.shop_settings;
create policy "shop: public read" on public.shop_settings
  for select using (true);

drop policy if exists "shop: admin update" on public.shop_settings;
create policy "shop: admin update" on public.shop_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.drinks, public.shop_settings to anon, authenticated;
grant insert, update, delete on public.drinks to authenticated;
grant update on public.shop_settings to authenticated;

-- 5. Kho ảnh món (public: ai cũng xem được ảnh, chỉ admin được tải lên/xóa) ----
-- Tạo bucket menu-images trong Dashboard → Storage (public, tối đa 3MB,
-- MIME: image/webp, image/png, image/jpeg). Tạo bucket bằng Storage API/UI.

-- (xóa ảnh qua API cần cả quyền select lẫn delete)
drop policy if exists "menu-images: admin select" on storage.objects;
create policy "menu-images: admin select" on storage.objects
  for select to authenticated using (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "menu-images: admin insert" on storage.objects;
create policy "menu-images: admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "menu-images: admin update" on storage.objects;
create policy "menu-images: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'menu-images' and public.is_admin())
  with check (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "menu-images: admin delete" on storage.objects;
create policy "menu-images: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'menu-images' and public.is_admin());

-- 6. Chỉ thêm email quản trị đã được chủ quán xác nhận.
-- insert into public.admin_users(email) values ('EMAIL_QUAN_TRI') on conflict do nothing;
-- Tạo người dùng qua Authentication → Users → Add user. Không lưu mật khẩu ở file này.
-- Dữ liệu món/thông tin quán được chuyển riêng từ bản sao lưu để giữ nguyên ảnh và giá.
