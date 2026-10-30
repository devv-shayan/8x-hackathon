# Migrations

The schema is Prisma's: `apps/web/prisma/schema/*.prisma`, one file per domain, with the
migrations in `apps/web/prisma/schema/migrations/`. `supabase/migrations/` is frozen history:
`20260924000000_supabase_baseline` is its four files, byte for byte, and `supabase/config.toml`
stops the Supabase CLI from applying them. Never add a file there again.

**CI writes the migration. You write the schema.**

- Never create or edit a file under `prisma/schema/migrations/` by hand. CI's `migrations` job
  generates it (`scripts/generate-migration.mjs`): it replays the committed migrations onto a
  clean Postgres, diffs the result against your schema, writes the missing migration, replays
  that too to prove it applies, and commits it back to your branch as
  `chore(db): add generated migration`.
- Your job stops at `prisma/schema/*.prisma` and application code. Change them, regenerate the
  client (`npm run prisma:generate --workspace=@app/web`), make the gates pass, push. Pull
  before you keep working: the generated commit lands on your branch.
- **A red `migrations` check is real.** Either the generator refused a destructive pattern
  (`DROP COLUMN`, `SET NOT NULL`), which needs hand-written, data-preserving SQL through
  `prisma migrate dev --create-only` (a sanctioned exception), the drift check found schema
  no migration creates, the run-once SQL failed, `check:rls` found a table without its
  security, or the database suites failed as the runtime role.
- A storage bucket is a hand-written migration too: a row in Supabase's `storage` schema,
  which Prisma doesn't manage, that every new play's database needs (so not `run-once.sql`,
  whose content the next one-off replaces). `insert ... on conflict (id) do nothing`, guarded
  by `to_regclass('storage.buckets')` so a Postgres without the storage schema isn't broken,
  and mirrored in `supabase/config.toml` for the local stack
  (`20260924000500_user_uploads_bucket` is the example).
- The other sanctioned hand-written migration is the security statement for each new table,
  in its own migration named one step after the generated one:

  ```sql
  ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON "<table>" FROM anon, authenticated;
  ```

  RLS on, no policies, nothing granted to `anon` or `authenticated`, never `FORCE`
  ([database](database.md)). The Prisma schema can't express it, and `check:rls` at the end of
  the `migrations` job stays red until it exists. It is not optional on Supabase: a project's
  default privileges grant every new table in `public` to both API roles, and CI's replay
  (`prisma/ci/supabase-shim.sql`) does the same, so a table without its REVOKE is readable by
  anyone holding the app's public key.

- **No SQL-editor writes against staging or production**, for schema or data. A one-off data
  fix goes in `apps/web/prisma/run-once.sql` through the same PR and CI path (next section).
- `.github/workflows/deploy-migrations.yml` applies migrations to production on every push to
  `main`, then `run-once.sql`, then a zero-drift check and `check:rls`, once the repository
  variable `PRISMA_BASELINE_RESOLVED` is `true` (the last section). The app deploy and the
  migration are not sequenced for you: when app code depends on a new column, say so in the PR
  and ship the migration first.

## Run-once SQL: `apps/web/prisma/run-once.sql`

The one SQL file outside `migrations/` that you hand-write. Whatever it holds runs **once per
database**, on the next deploy: right after `prisma migrate deploy`, before the drift check. It
is for one-off changes that are not schema: fix a value, insert reference rows, backfill,
replace a view, add a grant or revoke one.

- **Replace the content, don't append.** The last one-off already ran. Test it with
  `npm run db:run-once` against a local replay.
- **How "once" works.** `scripts/run-once-sql.mjs` hashes the executable content (comments and
  whitespace don't count) and skips any version already in the `_run_once_sql` ledger. The
  ledger row and the SQL are one transaction.
- **Not a schema side-channel.** Tables, columns, indexes and enums go in the `.prisma` files;
  the drift check after this file fails on them.
- **CI applies it to an empty database first.** Matching nothing must be fine, and an `INSERT`
  that needs production rows is guarded (`INSERT ... SELECT ... WHERE EXISTS`).

## A local replay

`check:rls`, the drift check and the database suites read a database, not the migration files.
On a throwaway local Postgres (never a shared or production one), from the repository root:

```bash
createdb app_replay
psql -d app_replay -v ON_ERROR_STOP=1 -q -f apps/web/prisma/ci/supabase-shim.sql
export DATABASE_URL=postgresql://$USER@localhost:5432/app_replay DIRECT_URL=postgresql://$USER@localhost:5432/app_replay
npx prisma migrate deploy --schema apps/web/prisma/schema && npm run db:run-once
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel apps/web/prisma/schema --exit-code
npm run check:rls
TEST_DATABASE_URL="$DATABASE_URL" npm run test:db --workspace=@app/web
```

Prisma needs a user name in a local URL (`postgresql://<you>@localhost:5432/<db>`) or it fails
with `P1010`. `node scripts/generate-migration.mjs --check --db-url "$DATABASE_URL"` shows what
CI would generate, without writing it. With the Supabase stack (`supabase start`),
`npm run db:reset` resets it and runs the migrations; export `DATABASE_URL` and `DIRECT_URL`
for the stack's database first.

The shim stands in for what Supabase creates (the API roles, `auth.users`, the storage schema)
and keeps a project's stock default privileges, so the replay is the strict case.

## The phone is the oldest client

A web deploy replaces every running copy of the site within minutes. A store build keeps
running on phones for months. So a schema change is only safe when every route a supported
app build calls keeps its shape ([mobile data](mobile-data.md)):

- The app never reads a table, so a column can be renamed behind a `v1` route that maps it.
- A change that would alter a `v1` response is a `v2` route, not a migration that breaks `v1`.
- Remove a column only when no route that a supported build calls still reads it. The
  minimum-version gate ([mobile releases](mobile-releases.md)) is how old builds stop being
  supported.

App builds from before `/api/app/v1` existed read five tables directly, and stage 2 of the
security migration (`20260924000600`) cut them off. A play with such builds installed raises the
minimum supported version past them before it deploys that migration. A new column the person
may set from the app is a field in a `v1` route's body, never a grant.

## Adopting Prisma on a live database

A new play's database is empty: set the repository variable `PRISMA_BASELINE_RESOLVED` to
`true` before the first deploy, and the baseline runs like any other migration.

A play cloned before the schema moved to Prisma (2026-09-24) has a database that
`supabase/migrations/` built, and it
already has every object in the baseline, so the baseline is recorded there as applied, never
run. The deploy job refuses such a database until that is done. In order:

1. Create the `production-database` environment in GitHub with `PRODUCTION_DATABASE_URL`:
   Supabase's session pooler (port 5432), with no query parameters. It must connect as the
   role that owns the tables (the project's `postgres` user): Prisma relies on the owner's
   exemption from RLS.
2. Run **Deploy migrations** by hand with task `resolve-baseline`. It replays the baseline
   alone onto an empty Postgres, compares a catalog fingerprint of the replay with production
   (`apps/web/prisma/ci/catalog-fingerprint.sql`: every table, column, constraint, index,
   function, policy, trigger and grant, no row data), and only if the two are identical marks
   the baseline applied. Run twice, the second run does nothing. A difference means the
   database drifted from the four files (a hand edit, a missing migration, a project made with
   other default privileges): reconcile it first, with the diff it prints.
3. Set `PRISMA_BASELINE_RESOLVED=true` and run the workflow with task `deploy`. It applies the
   migrations after the baseline (the keys to `auth.users` re-pointed at `profiles`, with the
   `on_auth_user_deleted` trigger, the security migration, the run-once ledger, the
   `profiles_require_auth_user` trigger, EXECUTE revoked from the definer functions), then checks
   drift and RLS on the live database. Re-adding the keys checks every row; the migration's
   header has the query that finds one whose user has no profile.

Not `prisma migrate diff` against production for step 2: it compares with the whole schema,
so the migrations after the baseline would read as drift. The same fingerprint runs from a
laptop through the linked Supabase CLI:
`supabase db query --linked -f apps/web/prisma/ci/catalog-fingerprint.sql`.

**The permission traps, checked before the switch, not one failing request at a time.** Every
local and CI suite except `test:db` connects as a superuser; production does not.

- **The role `DATABASE_URL` logs in as** must own the tables, or hold their privileges plus
  `BYPASSRLS`. A non-owner without it sees every table empty, with no error: RLS is on with no
  policies. `src/server/db/runtime-role.test.mts` is the proof for the owner.
- **Triggers run as their caller unless `SECURITY DEFINER`.** A trigger on `auth.users` runs
  when Supabase Auth, as `supabase_auth_admin`, creates or deletes a user; that role holds
  nothing in `public`. `on_auth_user_created` and `on_auth_user_deleted` are definer
  functions for that reason, and so is `profiles_require_auth_user`, which reads `auth.users`
  for a signed-in person. A new trigger that reaches another schema is too.
- **A definer function is an RPC unless you revoke it.** The Data API serves every function
  in `public` at `/rpc/<name>`, and Postgres grants EXECUTE to `PUBLIC`. A trigger fires
  without EXECUTE, so every definer function here has
  `REVOKE EXECUTE ON FUNCTION ... FROM public, anon, authenticated;` after it. `check:rls`
  fails on one an API role can call; it fails on a view an API role can read, too
  ([database](database.md)).
- **A definer function pins its `search_path`.** `handle_auth_user_deleted` and
  `profile_requires_auth_user` pin `search_path = ''` and schema-qualify every name. The
  baseline's `handle_new_user` (behind `on_auth_user_created`) pins `search_path = public`, as
  the Supabase migration that first created it did. A new definer function pins `''`; moving
  `handle_new_user` to `''` is a new migration that replaces the function, never an edit to the
  baseline.
- **Nothing reads with no session.** `anon` holds nothing after the security migration. An
  app build that queried a table signed out now gets "permission denied" instead of an empty
  list; the template's app never does.
- **No API role holds any privilege on `profiles`.** A client that wrote it directly gets
  "permission denied"; the person's own settings reach it only through
  `PATCH /api/app/v1/profile` ([database](database.md)).
- **The security migration takes back what the API roles held.** Check first that nothing
  outside this repo (a script with the secret key over the Data API, an integration) reads
  one of the tables it locks.

## Supabase-specific, while it lasts

- The RevenueCat webhook in `apps/web/src/app/api/webhooks/revenuecat/route.ts` is the one
  money path; the edge function that duplicated it is deleted, because two implementations of
  the money path is how one silently goes stale, and the web route is the complete one (it also
  emits the Play Events the email flows need). If a play
  deployed it, delete it from the project too (`supabase functions delete
revenuecat-webhook`) and point RevenueCat at the web route.
- `supabase/seed.sql` is local seed data only; it never runs against production.
