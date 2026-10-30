-- A SECURITY DEFINER function in public runs as its owner, past RLS, and the Supabase Data API
-- serves every function in public at /rest/v1/rpc/<name> to any role holding EXECUTE, which
-- Postgres grants to PUBLIC and Supabase's default privileges grant to anon and authenticated.
-- The two trigger functions here are definer so that Supabase Auth, which holds nothing in
-- public, can create and delete profiles through them. A trigger needs no EXECUTE to fire, so
-- nobody gets it: scripts/check-rls.mjs fails on any definer function an API role can call.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_deleted() from public, anon, authenticated;
