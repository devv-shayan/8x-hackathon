-- Local seed data. `supabase db reset` runs it on an empty public schema, BEFORE
-- `npm run db:reset` applies the Prisma migrations, so the app's tables don't exist
-- yet at that point. Seed them afterwards: psql "$DATABASE_URL" -f supabase/seed.sql
-- Keep this safe to run repeatedly (idempotent) and free of real secrets.

-- No admin is seeded: `supabase db reset` empties auth.users, so there is no account to
-- promote yet. Making the first admin is a step after the migrations, against an account
-- that exists: docs/ENV_SETUP.md.

-- Example waitlist rows (handy for the admin Overview count):
-- insert into public.waitlist (email, source) values
--   ('alex@example.com', 'web'),
--   ('sam@example.com',  'web')
-- on conflict (email) do nothing;
