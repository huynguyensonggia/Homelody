-- Prepared only; NOT applied to the hosted database by this change.
-- Review security-audit.sql first. Abort if expected authorization policies are absent
-- or unknown permissive policies exist; this must not silently lock out the admin.
begin;
do $$
begin
  if (select count(*) from pg_policies where schemaname = 'public' and
      ((tablename = 'drinks' and policyname in ('drinks: public read active', 'drinks: admin insert', 'drinks: admin update', 'drinks: admin delete'))
       or (tablename = 'shop_settings' and policyname in ('shop: public read', 'shop: admin update')))) <> 6 then
    raise exception 'Expected policies missing: review security-audit.sql and setup.sql first';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and
      ((tablename = 'drinks' and policyname not in ('drinks: public read active', 'drinks: admin insert', 'drinks: admin update', 'drinks: admin delete'))
       or (tablename = 'shop_settings' and policyname not in ('shop: public read', 'shop: admin update'))
       or tablename = 'admin_users')) then
    raise exception 'Unexpected policy: review its expression before hardening';
  end if;
end $$;
alter table public.admin_users enable row level security;
alter table public.drinks enable row level security;
alter table public.shop_settings enable row level security;
revoke all on public.admin_users from public, anon, authenticated;
revoke all on public.drinks, public.shop_settings from public, anon, authenticated;
grant select on public.drinks, public.shop_settings to anon, authenticated;
grant insert, update, delete on public.drinks to authenticated;
grant update on public.shop_settings to authenticated;
-- Exact policy definitions are restored from the reviewed source, not policy names alone.
alter policy "drinks: public read active" on public.drinks to anon, authenticated using (is_active or public.is_admin());
alter policy "drinks: admin insert" on public.drinks to authenticated with check (public.is_admin());
alter policy "drinks: admin update" on public.drinks to authenticated using (public.is_admin()) with check (public.is_admin());
alter policy "drinks: admin delete" on public.drinks to authenticated using (public.is_admin());
alter policy "shop: public read" on public.shop_settings to anon, authenticated using (true);
alter policy "shop: admin update" on public.shop_settings to authenticated using (public.is_admin()) with check (public.is_admin());
commit;
