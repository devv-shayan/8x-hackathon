-- A stand-in for the parts of a Supabase project that the schema depends on but that
-- Supabase, not our migrations, creates: the anon / authenticated / service_role roles,
-- auth.users with auth.uid(), auth.role() and auth.jwt(), the storage schema, pgcrypto in
-- `extensions`, and a new project's default privileges.
--
-- Applied by CI (and a local replay, docs/rules/migrations.md) to an empty Postgres before
-- `prisma migrate deploy`, so the baseline and every later migration replay as they would
-- against a real project. Never run against Supabase itself.
--
-- Adapted from plays-dashboard's prisma/ci/supabase-shim.sql. One deliberate difference:
-- that project's database was hardened (new tables get RLS on and no grants), and a play's
-- may not be. This shim keeps Supabase's stock defaults instead: every table created in
-- public is granted to anon, authenticated and service_role, and nothing turns RLS on for
-- you. That is the state supabase/migrations/ was written against, and it is the strict
-- test: a new table that is missing its security migration is readable here, so check:rls
-- fails the PR, where a hardened replay would have passed it.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
-- Roles are cluster-wide, so on a local Postgres another project may already have made
-- service_role without it. Supabase's service_role bypasses RLS.
alter role service_role bypassrls;
grant anon, authenticated, service_role to current_user;
grant usage on schema public to anon, authenticated, service_role;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- Supabase puts extensions on every role's search_path.
do $$ begin
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
end $$;
set search_path = "$user", public, extensions;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')) $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[],
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now(),
  updated_at timestamptz default now(), last_accessed_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;

-- Supabase's stock default privileges: what the migration role creates in public is granted
-- to the three API roles. Each table's security migration takes it back
-- (docs/rules/migrations.md).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
