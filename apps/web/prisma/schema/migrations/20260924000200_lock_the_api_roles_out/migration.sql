-- The security migration (decision D2, docs/rules/database.md), stage 1 of 2.
--
-- The web app now reads and writes through Prisma, connected as the role that owns these
-- tables, which RLS does not gate. Nothing it does goes through the anon or authenticated
-- roles any more. The mobile app still does, until plan PR 11 moves it onto /api/app/v1: it
-- reads profiles, items, tasks, activity_feed and notifications directly, signed in, under
-- their RLS policies. So:
--
--   - every table: RLS on (it already is; stated so the rule holds by construction), never
--     FORCE, which would subject the owner too and deny every Prisma query;
--   - nothing is granted to anon anywhere: the app never reads signed out;
--   - the five tables the app still reads keep their policies and exactly the grants those
--     policies can use, and no more (no DELETE, TRUNCATE, REFERENCES or TRIGGER);
--   - every other table, Prisma's _prisma_migrations included: no policies (none has one)
--     and nothing granted.
--
-- Stage 2, in plan PR 11 once the app reads through /api/app/v1 only, drops those policies
-- and revokes the rest, then empties APP_READ_TABLES in scripts/check-rls.mjs (and deletes
-- the rls-no-policies line in scripts/standards-exceptions.json). Its own migration, as a
-- new file, never an edit to this one:
--
--   drop policy if exists "Users can read own profile" on public.profiles;
--   drop policy if exists "Users can update own profile" on public.profiles;
--   drop policy if exists "Users can insert own profile" on public.profiles;
--   drop policy if exists "Users can read own items" on public.items;
--   drop policy if exists "Users can insert own items" on public.items;
--   drop policy if exists "Users can update own items" on public.items;
--   drop policy if exists "Users can read own tasks" on public.tasks;
--   drop policy if exists "Users can insert own tasks" on public.tasks;
--   drop policy if exists "Users can update own tasks" on public.tasks;
--   drop policy if exists "Users can read own activity" on public.activity_feed;
--   drop policy if exists "Users can insert own activity" on public.activity_feed;
--   drop policy if exists "Users can read own notifications" on public.notifications;
--   drop policy if exists "Users can update own notifications" on public.notifications;
--   revoke all on public.profiles, public.items, public.tasks, public.activity_feed,
--     public.notifications from anon, authenticated;
--
-- A build that still reads a table directly breaks the moment that runs, so it waits until
-- no supported app build does (the minimum-version gate, docs/rules/mobile-releases.md).
--
-- profiles, in particular. Its server-controlled columns (is_admin, plan_type, premium_*,
-- region, last_seen_at) were "locked" by column-level REVOKEs in two of the four Supabase
-- migrations. Those were no-ops: Supabase's default privileges had already granted UPDATE
-- on the whole table to authenticated, and a column REVOKE does not narrow a table GRANT.
-- On a stock project, any signed-in person could make themselves an admin, or premium,
-- with one PostgREST call. The lock is made real below: the table-level write grants go,
-- and authenticated gets INSERT and UPDATE on the person's own settings only. The
-- "publicly readable" policy goes too: it let anyone with the app's public key read every
-- account's plan, admin flag and market. The app only ever reads its own row.
-- scripts/check-rls.mjs (SERVER_CONTROLLED_COLUMNS) now fails if a write grant on any of
-- those columns comes back.

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_feed enable row level security;
alter table public.notifications enable row level security;
alter table public.waitlist enable row level security;
alter table public.contact_messages enable row level security;
alter table public.premium_grants enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_pageviews enable row level security;

-- Not read by the app: the locked door, now. None of these has a policy.
revoke all on public.waitlist, public.contact_messages, public.premium_grants,
  public.analytics_events, public.analytics_pageviews
  from anon, authenticated;

-- Prisma's own ledger. `prisma migrate deploy` (or `migrate resolve`) created it in public
-- just before this ran, so Supabase's default privileges granted it to both API roles: with
-- the Data API on, anyone holding the app's public key could rewrite the migration history.
do $$ begin
  if to_regclass('public._prisma_migrations') is not null then
    alter table public._prisma_migrations enable row level security;
    revoke all on public._prisma_migrations from anon, authenticated;
  end if;
end $$;

-- Read by the app until plan PR 11: signed in only, the verbs the policies allow.
revoke all on public.profiles, public.items, public.tasks, public.activity_feed,
  public.notifications
  from anon, authenticated;
grant select, insert, update on public.items to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select, insert on public.activity_feed to authenticated;
grant select, update on public.notifications to authenticated;

-- profiles: read your own row; write only your own settings. `id` is in the write grants
-- because the onboarding screen upserts { id, display_name }, and an upsert's
-- ON CONFLICT DO UPDATE sets every column it sends; the policies pin id to auth.uid().
grant select on public.profiles to authenticated;
grant insert (id, display_name, avatar_url, locale, marketing_consent)
  on public.profiles to authenticated;
grant update (id, display_name, avatar_url, locale, marketing_consent)
  on public.profiles to authenticated;

drop policy if exists "Profiles are publicly readable" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);
