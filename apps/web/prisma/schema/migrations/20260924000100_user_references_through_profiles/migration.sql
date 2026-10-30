-- Nine columns in public referenced auth.users by foreign key. Prisma cannot model a
-- reference into a schema it does not manage (P4002), and it must not manage `auth`, which
-- belongs to Supabase. So each now references the profile instead, which is one row per
-- auth user (on_auth_user_created makes it), and the profile goes when the auth user does,
-- through a trigger on auth.users (plays-dashboard's
-- 20260918000100_members_without_auth_fk is the same move). The effect is what the keys
-- did: deleting an account deletes its rows, keeps the history that outlives it (analytics,
-- who granted premium) with the user id cleared, and an insert naming a user who has no
-- account is refused.
--
-- On a database with data, adding the keys checks every row. One whose user has no profile
-- (a profile deleted by hand) stops this migration; find them first with, for example:
--   select id from public.items i where not exists (select 1 from public.profiles p where p.id = i.user_id);
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.items drop constraint if exists items_user_id_fkey;
alter table public.tasks drop constraint if exists tasks_user_id_fkey;
alter table public.activity_feed drop constraint if exists activity_feed_user_id_fkey;
alter table public.notifications drop constraint if exists notifications_user_id_fkey;
alter table public.premium_grants drop constraint if exists premium_grants_user_id_fkey;
alter table public.premium_grants drop constraint if exists premium_grants_granted_by_fkey;
alter table public.analytics_events drop constraint if exists analytics_events_user_id_fkey;
alter table public.analytics_pageviews drop constraint if exists analytics_pageviews_user_id_fkey;

-- The keys again, now to public.profiles, as Prisma writes them (prisma/schema/*.prisma).
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "premium_grants" ADD CONSTRAINT "premium_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "premium_grants" ADD CONSTRAINT "premium_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "analytics_pageviews" ADD CONSTRAINT "analytics_pageviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- The profile goes with its auth user, and the keys above take everything else with it.
-- SECURITY DEFINER with an empty search_path: Supabase Auth deletes the user as
-- supabase_auth_admin, which holds nothing in public, and the trigger runs as the role that
-- owns these tables.
create or replace function public.handle_auth_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_auth_user_deleted();
