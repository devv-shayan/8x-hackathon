-- The private bucket the app's avatars go into (POST /api/app/v1/uploads). Hand-written, a
-- sanctioned exception (docs/rules/migrations.md): a bucket is a row in Supabase's storage
-- schema, which Prisma does not manage, and every new play's database needs it, which a
-- run-once file (replaced by the next one-off) would not guarantee.
--
-- Private, with the types and the size limit the route accepts (@app/contract,
-- AVATAR_CONTENT_TYPES and MAX_AVATAR_BYTES): the bucket enforces them on the upload itself,
-- which a signed upload URL alone does not. No storage policies: only the server's secret key
-- signs URLs, after the route has verified the person.
--
-- A bucket that already exists is left as it is. Guarded, so a Postgres with no storage
-- schema (not Supabase) is not broken by it. supabase/config.toml declares the same bucket for
-- the local stack.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'user-uploads',
      'user-uploads',
      false,
      5242880,
      array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    )
    on conflict (id) do nothing;
  end if;
end
$$;
