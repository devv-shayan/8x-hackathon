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
