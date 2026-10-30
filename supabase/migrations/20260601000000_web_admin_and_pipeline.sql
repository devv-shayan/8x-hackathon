-- ─────────────────────────────────────────────────────────────────────────────
-- Web layer: admin access, the Play Stats pipeline, and lead capture.
-- Builds on 20260101000000_init.sql (profiles + set_updated_at) and
-- 20260418000000_app_domain.sql (profiles.plan_type).
--
-- Run with: supabase db reset  (local)  /  supabase db push  (remote)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extend profiles for admin + the Play Stats API ────────────────────────────
alter table public.profiles add column if not exists is_admin             boolean not null default false;
alter table public.profiles add column if not exists region               text;          -- ISO 3166-1 alpha-2, == launch country
alter table public.profiles add column if not exists premium_source       text;          -- 'purchase' | 'promo' | 'grant' | null
alter table public.profiles add column if not exists premium_environment  text;          -- 'production' | 'sandbox' | null

comment on column public.profiles.is_admin is 'Grants access to /admin. Server-controlled only (see column GRANTs below).';
comment on column public.profiles.premium_source is 'How premium was obtained. Only ''purchase'' counts as a paying sale in the Play Stats API.';

-- Indexes for the dashboard summary scan.
create index if not exists profiles_created_at_idx on public.profiles (created_at);
create index if not exists profiles_plan_type_idx  on public.profiles (plan_type);
create index if not exists profiles_region_idx     on public.profiles (region);

-- ── Privilege lockdown ────────────────────────────────────────────────────────
-- RLS lets a user UPDATE their own profile row, but they must NOT be able to set
-- server-controlled columns (escalate to admin, or self-upgrade to premium).
-- Column-level GRANTs are enforced on top of RLS; the service_role bypasses both,
-- so the RevenueCat webhook and admin tools still work.
revoke update (is_admin, plan_type, premium_source, premium_environment)
  on public.profiles from authenticated, anon;

-- ── Waitlist ──────────────────────────────────────────────────────────────────
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  source      text,                      -- 'web', 'app', a campaign tag, etc.
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- RLS on, no policies for anon/authenticated → only the service_role (used by the
-- API route) can read or write. The public form posts through that route.
alter table public.waitlist enable row level security;

-- ── Contact messages (support form + deletion requests) ───────────────────────
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  message     text not null,
  category    text not null default 'general',   -- 'general' | 'deletion' | ...
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_handled_idx    on public.contact_messages (handled);

alter table public.contact_messages enable row level security;  -- service_role only

-- ── Premium grants (admin comps audit trail) ──────────────────────────────────
-- When an admin comps a user, write a row here and set profiles.premium_source='grant'.
-- Keeps "who granted what, and why" auditable, separate from real sales.
create table if not exists public.premium_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  granted_by  uuid references auth.users(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists premium_grants_user_idx on public.premium_grants (user_id);

alter table public.premium_grants enable row level security;  -- service_role only
