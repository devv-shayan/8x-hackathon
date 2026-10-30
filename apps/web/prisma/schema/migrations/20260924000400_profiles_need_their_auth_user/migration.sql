-- A profile exists only for a user Supabase Auth has. The foreign key to auth.users used to
-- say so; 20260924000100 had to drop it (Prisma cannot model a key into `auth`), and nothing
-- took its place on insert. A deleted user's access token stays valid until it expires (an
-- hour by default), and the app's onboarding screen upserts { id, display_name } with it, so
-- the upsert re-created the profile the deletion had just removed: counted in users_total and
-- the retention cohorts, holding a name the person asked to erase, and letting items and
-- notifications hang off it again.
--
-- This trigger is that half of the key, in Postgres: an insert (or an id change) naming no
-- auth user is refused, whoever makes it. on_auth_user_created still inserts the profile after
-- Supabase Auth has written the user, so a signup passes, and the app's upsert for a live user
-- passes too.
--
-- SECURITY DEFINER with an empty search_path: the signed-in person who triggers it holds
-- nothing in `auth`, so the lookup runs as the owner of these tables. A trigger fires without
-- EXECUTE on its function, so nothing is granted: it is not callable over the Data API.
create or replace function public.profile_requires_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users where id = new.id) then
    raise exception 'profile % has no auth user', new.id
      using errcode = '23503', hint = 'A profile is created by on_auth_user_created, for an existing auth user.';
  end if;
  return new;
end;
$$;

revoke execute on function public.profile_requires_auth_user() from public, anon, authenticated;

drop trigger if exists profiles_require_auth_user on public.profiles;
create trigger profiles_require_auth_user
  before insert or update of id on public.profiles
  for each row execute function public.profile_requires_auth_user();
