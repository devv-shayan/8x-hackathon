-- Read-only fingerprint of what the Prisma baseline claims to reproduce: public tables,
-- columns, constraints, indexes, functions, policies, triggers, grants, enums, views,
-- sequences, the storage buckets and policies, and our triggers on auth.users. One
-- sortable line per object, so two databases diff line by line. Row data is never read.
--
-- Run against a live database that supabase/migrations/ built, before the baseline is
-- marked applied there, and diff with a replay of the baseline alone: the resolve-baseline
-- task in .github/workflows/deploy-migrations.yml (docs/rules/migrations.md, "Adopting
-- Prisma on a live database"). Supabase's pgaudit functions are platform objects and are
-- left out. From plays-dashboard, unchanged below this header.
with items as (
  select 'table|' || c.relname || '|rls=' || c.relrowsecurity || '|force=' || c.relforcerowsecurity as item
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and c.relname not in ('_prisma_migrations', '_run_once_sql')
  union all
  select 'column|' || c.relname || '.' || a.attname || '|' || format_type(a.atttypid, a.atttypmod)
         || '|notnull=' || a.attnotnull || '|default=' || coalesce(pg_get_expr(d.adbin, d.adrelid), '')
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
    and c.relname not in ('_prisma_migrations', '_run_once_sql')
  union all
  select 'constraint|' || c.relname || '|' || con.conname || '|' || pg_get_constraintdef(con.oid)
  from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname not in ('_prisma_migrations', '_run_once_sql')
  union all
  select 'index|' || tablename || '|' || indexname || '|' || indexdef
  from pg_indexes where schemaname = 'public' and tablename not in ('_prisma_migrations', '_run_once_sql')
  union all
  select 'function|' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|'
         || md5(pg_get_functiondef(p.oid))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p') and p.proname not like 'pgaudit%'
  union all
  select 'policy|' || schemaname || '.' || tablename || '|' || policyname || '|' || cmd || '|' || roles::text
         || '|' || regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g')
         || '|' || regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g')
  from pg_policies where schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects')
  union all
  select 'trigger|' || t.tgrelid::regclass::text || '|' || t.tgname || '|' || pg_get_triggerdef(t.oid)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
  where not t.tgisinternal and (n.nspname = 'public' or pn.nspname = 'public')
  union all
  select 'grant|' || table_name || '|' || grantee || '|' || string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
    and table_name not in ('_prisma_migrations', '_run_once_sql')
  group by table_name, grantee
  union all
  select 'colgrant|' || table_name || '|' || grantee || '|' || privilege_type || '|'
         || string_agg(column_name, ',' order by column_name)
  from information_schema.column_privileges
  where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
    and table_name not in ('_prisma_migrations', '_run_once_sql')
  group by table_name, grantee, privilege_type
  union all
  select 'execute|' || routine_name || '|' || grantee
  from information_schema.routine_privileges
  where routine_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
    and routine_name not like 'pgaudit%'
  group by routine_name, grantee
  union all
  select 'enum|' || t.typname || '|' || string_agg(e.enumlabel, ',' order by e.enumsortorder)
  from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' group by t.typname
  union all
  select 'view|' || viewname || '|' || md5(definition) from pg_views where schemaname = 'public'
  union all
  select 'sequence|' || sequencename from pg_sequences where schemaname = 'public'
  union all
  select 'bucket|' || id || '|public=' || public from storage.buckets
)
select item from items order by item;
