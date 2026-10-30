# Supabase: auth, storage and the local stack

Supabase is this template's identity provider and file store, and `supabase start` runs a local
copy of it (`config.toml`). It no longer owns the schema.

## `migrations/` is frozen history

`migrations/20260101000000_init.sql` to `20260815000000_events_and_reporting.sql` built the
schema before it moved to Prisma on 2026-09-24.
`apps/web/prisma/schema/migrations/20260924000000_supabase_baseline` is those four files, byte
for byte, and every change since is a Prisma migration. `config.toml` stops the Supabase CLI from
applying them (`[db.migrations] enabled = false`).

Don't add, edit or re-run a file here. See `docs/rules/migrations.md`.
