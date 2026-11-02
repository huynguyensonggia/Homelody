-- Read-only: run in the project's SQL Editor before applying security-hardening.sql.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('drinks', 'shop_settings', 'admin_users'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('drinks', 'shop_settings', 'admin_users');

select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('drinks', 'shop_settings', 'admin_users')
order by table_name, grantee, privilege_type;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'menu-images';

select n.nspname, p.proname, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'homelody_private')
and p.proname in ('is_admin', 'touch_updated_at');
