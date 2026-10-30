-- The security migration (decision D2, docs/rules/database.md), stage 2 of 2.
--
-- Stage 1 (20260924000200_lock_the_api_roles_out) left five tables open to the signed-in
-- app: profiles, items, tasks, activity_feed and notifications kept their RLS policies and
-- the grants those policies could use, because the mobile app read and wrote them directly
-- through Supabase. Plan PR 11 moved the app onto /api/app/v1: it now reaches its data only
-- through routes that verify the bearer token and read and write through Prisma, as the
-- role that owns these tables, which RLS does not gate. Nothing uses the API roles any more.
--
-- So the last door closes, and every table in public is the same locked door: RLS on (it
-- stays on, never FORCEd), no policies, nothing granted to anon or authenticated.
-- scripts/check-rls.mjs, with APP_READ_TABLES now empty, fails if any of that comes back.
--
-- A hand-written migration (docs/rules/migrations.md: the security statement, which the
-- Prisma schema can't express). It is the SQL stage 1's header specified, unchanged.
--
-- For a play with store builds installed: a build from before plan PR 11 still reads these
-- tables directly, and every such read fails once this runs. Raise the minimum supported
-- version past those builds first (GET /api/app/v1/config, docs/rules/mobile-releases.md).

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can read own items" on public.items;
drop policy if exists "Users can insert own items" on public.items;
drop policy if exists "Users can update own items" on public.items;
drop policy if exists "Users can read own tasks" on public.tasks;
drop policy if exists "Users can insert own tasks" on public.tasks;
drop policy if exists "Users can update own tasks" on public.tasks;
drop policy if exists "Users can read own activity" on public.activity_feed;
drop policy if exists "Users can insert own activity" on public.activity_feed;
drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;

-- A table-level REVOKE ALL also takes back every column privilege on the table, so the
-- column grants stage 1 gave authenticated on profiles go with it.
revoke all on public.profiles, public.items, public.tasks, public.activity_feed,
  public.notifications
  from anon, authenticated;
