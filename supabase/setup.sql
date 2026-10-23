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

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
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
insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

-- tự cập nhật updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
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
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 3145728, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = true;

-- (xóa ảnh qua API cần cả quyền select lẫn delete)
drop policy if exists "menu-images: admin select" on storage.objects;
create policy "menu-images: admin select" on storage.objects
  for select to authenticated using (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "menu-images: admin insert" on storage.objects;
create policy "menu-images: admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "menu-images: admin update" on storage.objects;
create policy "menu-images: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "menu-images: admin delete" on storage.objects;
create policy "menu-images: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'menu-images' and public.is_admin());

-- 6. Người quản trị — ĐỔI email bên dưới, có thể thêm nhiều dòng ------------
insert into public.admin_users (email) values
  ('email-cua-ban@gmail.com')
on conflict (email) do nothing;

-- 7. Dữ liệu mẫu (chỉ thêm khi bảng món còn trống) ------------------------
-- Ảnh mẫu trỏ vào thư mục assets/images của website; khi tải ảnh mới trong /admin sẽ tự thay.
insert into public.drinks (name, category, price, description, note, ingredients, image_url, image_alt, is_featured, sort_order)
select * from (values
  ('Matcha Latte', 'Trà', 55000, 'Matcha thanh nhẹ, quyện cùng sữa tươi béo dịu.', 'Thanh nhẹ · Béo dịu · Hậu trà',
     array['Bột matcha','Sữa tươi','Đá viên'], 'assets/images/drink-matcha-latte.webp', 'Ly Matcha Latte đá', true, 10),
  ('Bạc xỉu', 'Cà phê Việt', 45000, 'Sữa béo dịu, điểm chút cà phê đậm thơm.', 'Ngọt dịu · Thơm cà phê',
     array['Cà phê phin','Sữa đặc','Sữa tươi','Đá viên'], 'assets/images/drink-iced-latte.webp', 'Ly Bạc xỉu đá', true, 20),
  ('Cà phê sữa đá', 'Cà phê Việt', 39000, 'Cà phê đậm vị, sữa đặc ngọt vừa, thêm đá mát lành.', 'Đậm đà · Ngọt béo',
     array['Cà phê phin','Sữa đặc','Đá viên'], '', 'Ly Cà phê sữa đá', true, 30),
  ('Cold brew cam', 'Cà phê Việt', 55000, 'Cà phê ủ lạnh kết hợp vị cam tươi sáng.', 'Êm dịu · Tươi mát · Hương cam',
     array['Cà phê ủ lạnh (cold brew)','Nước cam tươi','Lát cam','Đá viên'], '', 'Ly Cold brew cam', true, 40)
) as seed(name, category, price, description, note, ingredients, image_url, image_alt, is_featured, sort_order)
where not exists (select 1 from public.drinks);
