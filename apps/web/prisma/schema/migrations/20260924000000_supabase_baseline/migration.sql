-- BASELINE. Never run this on a database that supabase/migrations/ already built.
--
-- The four files in supabase/migrations/ (20260101000000_init to
-- 20260815000000_events_and_reporting), byte for byte and in order, from when schema
-- management moved to Prisma (plan PR 8). supabase/migrations/ is frozen history from here:
-- never add a file there again.
--
-- A database built by those files already has every object in this one. Before the first
-- `prisma migrate deploy` there, prove it (prisma/ci/catalog-fingerprint.sql) and mark this
-- migration applied, never run: the `resolve-baseline` task in
-- .github/workflows/deploy-migrations.yml does both (docs/rules/migrations.md, "Adopting
-- Prisma on a live database").
--
-- A fresh database (CI, a local replay, a new play's first deploy) runs it like any other
-- migration, after prisma/ci/supabase-shim.sql has stood in for what Supabase itself
-- creates. The files rely on a Supabase project's stock default privileges for their grants,
-- as they always did; the migrations after this one set every grant explicitly.

-- ═══ supabase/migrations/20260101000000_init.sql ═══

-- ─────────────────────────────────────────────────────────────────────────────
-- Base schema for the app template
-- Run with: supabase db reset  (local)
--           supabase db push   (remote)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Profiles table ────────────────────────────────────────────────────────────
-- One row per auth.users entry. Auto-created via trigger on signup.
-- Add app-specific columns here (e.g., bio, preferences, credits, etc.)

create table public.profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  -- TODO: Add your app-specific columns here
  -- e.g., bio text, credits integer default 0, plan_type text default 'free'
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

comment on table public.profiles is 'Per-user profile data, extended from auth.users.';

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- Users can read any profile (adjust if profiles should be private)
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

-- Users can only update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Users can insert their own profile (needed for manual upsert)
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ── Auto-create profile on signup ─────────────────────────────────────────────
-- Triggered when a new row is inserted into auth.users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Auto-update updated_at ─────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Add more tables below as your app grows.
-- Tip: Create a new migration file for each feature addition so diffs are clean.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ supabase/migrations/20260418000000_app_domain.sql ═══

-- App domain tables: items, tasks, activity feed, notifications
-- Also extends profiles with plan_type for server-side subscription state.

-- ── Extend profiles ──────────────────────────────────────────────────────────

alter table public.profiles add column if not exists plan_type text not null default 'free';

-- Replace placeholder column types/constraints with your actual business logic.
-- All tables include: soft deletes (deleted_at), RLS, updated_at trigger.

-- ── Enums ────────────────────────────────────────────────────────────────────

create type item_status as enum ('active', 'pending', 'archived');
create type task_state as enum ('todo', 'in-progress', 'review', 'done');
create type task_priority as enum ('low', 'medium', 'high');
create type activity_kind as enum ('milestone', 'comment', 'alert', 'review');
create type notification_category as enum ('billing', 'system', 'product', 'team');

-- ── Items ────────────────────────────────────────────────────────────────────

create table items (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references auth.users(id) on delete cascade not null,
    name        text not null,
    owner       text not null default '',
    status      item_status not null default 'active',
    completion  integer not null default 0 check (completion >= 0 and completion <= 100),
    health      integer not null default 100 check (health >= 0 and health <= 100),
    active_users integer not null default 0,
    summary     text,
    deleted_at  timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

alter table items enable row level security;

create policy "Users can read own items"
    on items for select using (auth.uid() = user_id and deleted_at is null);

create policy "Users can insert own items"
    on items for insert with check (auth.uid() = user_id);

create policy "Users can update own items"
    on items for update using (auth.uid() = user_id);

create trigger set_items_updated_at
    before update on items
    for each row execute function set_updated_at();

-- ── Tasks ────────────────────────────────────────────────────────────────────

create table tasks (
    id          uuid primary key default gen_random_uuid(),
    item_id     uuid references items(id) on delete cascade not null,
    user_id     uuid references auth.users(id) on delete cascade not null,
    title       text not null,
    state       task_state not null default 'todo',
    priority    task_priority not null default 'medium',
    due_date    date,
    deleted_at  timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "Users can read own tasks"
    on tasks for select using (auth.uid() = user_id and deleted_at is null);

create policy "Users can insert own tasks"
    on tasks for insert with check (auth.uid() = user_id);

create policy "Users can update own tasks"
    on tasks for update using (auth.uid() = user_id);

create trigger set_tasks_updated_at
    before update on tasks
    for each row execute function set_updated_at();

-- ── Activity feed ────────────────────────────────────────────────────────────

create table activity_feed (
    id          uuid primary key default gen_random_uuid(),
    item_id     uuid references items(id) on delete cascade not null,
    user_id     uuid references auth.users(id) on delete cascade not null,
    kind        activity_kind not null,
    title       text not null,
    detail      text,
    created_at  timestamptz not null default now()
);

alter table activity_feed enable row level security;

create policy "Users can read own activity"
    on activity_feed for select using (auth.uid() = user_id);

create policy "Users can insert own activity"
    on activity_feed for insert with check (auth.uid() = user_id);

-- ── Notifications ────────────────────────────────────────────────────────────

create table notifications (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references auth.users(id) on delete cascade not null,
    title       text not null,
    body        text,
    category    notification_category not null default 'system',
    read        boolean not null default false,
    created_at  timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "Users can read own notifications"
    on notifications for select using (auth.uid() = user_id);

create policy "Users can update own notifications"
    on notifications for update using (auth.uid() = user_id);

-- ═══ supabase/migrations/20260601000000_web_admin_and_pipeline.sql ═══

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

-- ═══ supabase/migrations/20260815000000_events_and_reporting.sql ═══

-- ─────────────────────────────────────────────────────────────────────────────
-- First-party events + the columns the Play Stats API needs to answer for
-- retention, trials and per-market paid users.
--
-- Builds on 20260601000000_web_admin_and_pipeline.sql.
-- Run with: supabase db reset  (local)  /  supabase db push  (remote)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── analytics_events ──────────────────────────────────────────────────────────
-- One row per (visitor, event, day) by default — see lib/analytics/record.ts for
-- the dedupe rules. This is the play's own history, and the only route to
-- retention cohorts: PostHog only sees forward from the day it was installed,
-- and a meaningful slice of most audiences blocks it entirely.
create table if not exists public.analytics_events (
  id         uuid        primary key default gen_random_uuid(),
  -- NULLABLE on purpose. Guests are most of the top of funnel; dropping
  -- anonymous rows makes landing → signup conversion uncomputable. Anonymous
  -- rows are identified by metadata->>'session_id'.
  user_id    uuid        references auth.users(id) on delete set null,
  name       text        not null,
  path       text,
  -- Carries the event's discriminators, plus session_id and country. Country is
  -- stamped here rather than in a column so every event is segmentable by
  -- market with no schema change per event type.
  metadata   jsonb,
  created_at timestamptz not null default now()
);

-- The dedupe lookup in recordUserEvent: (name, user_id | session_id, day).
create index if not exists analytics_events_name_created_idx
  on public.analytics_events (name, created_at desc);
create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id, name, created_at desc)
  where user_id is not null;
create index if not exists analytics_events_session_idx
  on public.analytics_events ((metadata->>'session_id'), name, created_at desc)
  where user_id is null;
-- The retention-cohort join: "was this user active on exactly day N?"
create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at)
  where user_id is not null;

alter table public.analytics_events enable row level security;
-- No policies: writes go through the service role (lib/analytics/record.ts) and
-- reads happen in admin screens that already hold the service role. Nobody else
-- gets in, including the owner of the row — an event log a user can read is a
-- side channel into what the product measures.

-- ── analytics_pageviews ───────────────────────────────────────────────────────
-- Raw dwell deltas, appended without dedupe and summed later for time-on-screen.
create table if not exists public.analytics_pageviews (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete set null,  -- nullable: see above
  session_id text        not null,
  path       text        not null,
  dwell_ms   integer     not null check (dwell_ms > 0),
  created_at timestamptz not null default now()
);

create index if not exists analytics_pageviews_path_created_idx
  on public.analytics_pageviews (path, created_at desc);
create index if not exists analytics_pageviews_session_idx
  on public.analytics_pageviews (session_id, created_at desc);

alter table public.analytics_pageviews enable row level security;

-- ── Profile columns the current Play Stats contract needs ─────────────────────
-- last_seen_at is the activity signal retention.cohorts counts against. Without
-- it the play can report signups but not whether anybody came back, and D1/D7/D30
-- read n/a on the dashboard.
alter table public.profiles add column if not exists last_seen_at        timestamptz;
alter table public.profiles add column if not exists locale              text;          -- BCP-47, drives email language
alter table public.profiles add column if not exists marketing_consent   boolean not null default false;

-- The subscription block on /api/dashboard/v1/users. `premium_status` is the
-- BILLING status, which outranks the period type: when a trial's conversion
-- charge fails, RevenueCat keeps period_type 'trial' and extends expires_date
-- through payment recovery, so period-type-first logic reports a failed
-- conversion as a healthy month-long trial. Map billing_issues_detected_at /
-- grace_period_expires_date into 'past_due' here before looking at the period.
alter table public.profiles add column if not exists premium_status      text;          -- 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
alter table public.profiles add column if not exists premium_started_at  timestamptz;
alter table public.profiles add column if not exists premium_expires_at  timestamptz;
alter table public.profiles add column if not exists premium_will_renew  boolean;
alter table public.profiles add column if not exists premium_store       text;          -- 'app_store' | 'play_store' | 'stripe' | ...
-- Without product, a monthly subscription and an annual trial are
-- indistinguishable on the trial roster.
alter table public.profiles add column if not exists premium_product     text;

comment on column public.profiles.last_seen_at is 'Last activity. The denominator-side signal for retention.cohorts on the Play Stats API.';
comment on column public.profiles.premium_status is 'Billing status. A billing issue OUTRANKS the period type — see the Play Stats API contract.';

-- ── Privilege lockdown for the new server-controlled columns ──────────────────
-- Same reasoning as the previous migration: RLS lets a user update their own
-- profile row, so anything that decides entitlement or what the dashboard
-- reports must be revoked at the column level. marketing_consent and locale are
-- deliberately NOT revoked — those are the user's own settings to change.
revoke update (
  last_seen_at, premium_status, premium_started_at, premium_expires_at,
  premium_will_renew, premium_store, premium_product
) on public.profiles from authenticated, anon;

-- Indexes for the trial roster and the per-country paid split.
create index if not exists profiles_premium_status_idx on public.profiles (premium_status)
  where premium_status is not null;
create index if not exists profiles_last_seen_idx      on public.profiles (last_seen_at);
create index if not exists profiles_expires_idx        on public.profiles (premium_expires_at)
  where premium_expires_at is not null;
