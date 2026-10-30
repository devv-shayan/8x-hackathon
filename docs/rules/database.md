# Database access

> **Status.** Both apps follow this rule. `apps/web` reads and writes through Prisma, with
> auth-only Supabase wrappers. `apps/mobile` reaches its data only through `/api/app/v1`
> ([mobile data](mobile-data.md)), and no table keeps a policy or a grant it could use. **Add
> no `.from()`/`.rpc()` call site**, in either app: both clients are typed so it won't compile.

## One data path: Prisma, on the server

All database access goes through the Prisma client in `apps/web/src/server/db/client.ts`
(exported as `db`). No raw `pg`/`postgres` client, no second ORM, no Supabase
`.from()`/`.rpc()` for data. Supabase is auth, plus signed storage URLs, and nothing else
([auth](auth.md)). `$queryRaw` only where Prisma cannot express the query, called out in the PR
and in a comment on the query. Today's: the event-log dedupe lookup (a text `->>` comparison
its expression index needs), the RLS check's catalog query, and the Play Stats roster and the
lifecycle cron, whose timestamps leave the app as PostgREST rendered them
(`src/server/db/postgrest-time.ts`: a `v1` response keeps its bytes).

Why, in general: one production repo shipped 147 direct RPC call sites TypeScript couldn't
see, and a dropped column silently broke one in production. Why, here: an installed app cannot
be forced to update, so a phone that queries tables turns the schema into a public API frozen
by the oldest build still installed.

Enforced by `eslint.config.mjs`'s `no-restricted-imports`: `@prisma/client` as a value only in
`src/server/db/client.ts` (type imports anywhere), `db` from that module only inside
`src/server/db/` (the `Prisma` namespace anywhere), no driver or second ORM anywhere,
`@supabase/*` only in `src/lib/supabase/` and `src/middleware.ts`. `check:standards` proves the
rule is in effect (`prisma-only-data-path`, `supabase-auth-only`). Prisma, `pg` and any
Node-only database code never go in `apps/mobile`.

Queries live in stores (one per domain, under `src/server/db/`: `profiles`, `play-stats`,
`analytics`, `leads`, and `items`, `tasks`, `feed` behind `/api/app/v1`), not in route handlers
or pages. Each exports a factory that takes the
client (`createProfileStore(db)`) and the instance the app uses (`profileStore`); a route
imports the instance, and a test builds one on the client it needs. Pass the store around, not
the client.

## Authorization is in code; RLS is a locked door

The route authorizes before it queries (template-web's model: with every read and write going
through a server route, the route is the one authorization path, not RLS policies as well):

- `requireUser()` (`src/server/auth/require-user.ts`) resolves the person from the app's
  bearer token, verified by Supabase Auth; a website route reads the session cookie through
  `createServerSupabaseClient()`. Scope every query to that user server-side; never trust an id
  from the request body. (`/api/lifecycle/session` still checks its bearer token inline.)
- For admin pages, the `admin/(protected)/layout.tsx` guard; for admin API routes and server
  actions, `requireAdmin()` ([authorization](authorization.md)).
- `requireDashboardKey()` for the Play Stats API; the `CRON_SECRET` bearer for crons; the
  webhook's own signature or secret for a webhook.

Every table has **RLS enabled with no policies, and nothing granted to `anon` or
`authenticated`**. Prisma connects as the table owner, which RLS exempts, so the app works; any
other role gets nothing, even if someone switches the Supabase Data API back on. Never
`FORCE` RLS: it would subject the owner too and deny every Prisma query. `check:rls` proves all
of this against a replayed database in CI, and against production after every deploy. Keep
the Supabase Data API off: nothing reads tables through it.

The security migration ran in two stages. Stage 1
(`prisma/schema/migrations/20260924000200_lock_the_api_roles_out`) locked every table but the
five the app still read directly (`profiles`, `items`, `tasks`, `activity_feed`,
`notifications`); stage 2 (`20260924000600_lock_the_api_roles_out_stage_2`) dropped their
policies and revoked their grants once the app read through `/api/app/v1` only. No table
is an exception now: `APP_READ_TABLES` in `scripts/check-rls.mjs` is empty, and
`check:standards` (`rls-no-policies`) fails if a table is added to it. Should one ever be,
every permissive policy it keeps must restrict to the person's own rows (`auth.uid()` = the
owner column, ANDed with anything else); `check:rls` fails on any other, such as
`using (true)`, unless `ALLOWED_POLICIES` names it with a reason.

A locked table can still be read around, two ways, and `check:rls` fails on both:

- **A view or materialized view** runs as its owner, so it skips the RLS of the tables under
  it, and Supabase's default privileges grant every new one in `public` to `anon` and
  `authenticated`. Revoke both in the migration that creates it (`EXPOSED_VIEWS` for a
  deliberate exception, with its reason).
- **A `SECURITY DEFINER` function** runs as its owner too, and the Data API serves every
  function in `public` at `/rpc/<name>` to any role holding EXECUTE, which Postgres grants to
  `PUBLIC` by default. Revoke it from `public, anon, authenticated`; a trigger function still
  fires without it (`CALLABLE_DEFINER_FUNCTIONS` for a deliberate exception).

**A profile exists only for a user Supabase Auth has.** The key from `profiles.id` to
`auth.users` is a trigger, not a foreign key (Prisma can't model a key into `auth`):
`profiles_require_auth_user` refuses an insert naming no auth user, whoever makes it, and
`on_auth_user_deleted` deletes the profile with the user. Without the first, a deleted user's
still-valid token could re-create their profile: through the direct onboarding upsert of app
builds from before `/api/app/v1`, and through `PATCH /api/app/v1/profile`, which makes a live
user's missing row.

This is not plays-dashboard's model (policies as the authorization boundary, `dbAs`): that
repo kept policies because it had live users and hundreds of call sites. This one has neither.

## Money and entitlement columns

`profiles.is_admin`, `plan_type`, `premium_*`, `region`, `last_seen_at` and `created_at`, and
every subscription row, are **server-controlled**. Only server code writes them, through
`src/server/db/profiles.ts`: the RevenueCat webhook (`applyEntitlement`: `plan_type`,
`premium_*`) and the lifecycle route (`recordSession`: `last_seen_at`, `region`); an admin
grant, when a play adds one, is a server action behind `requireAdmin()`. Never the browser,
never the app. **Review every diff that writes them twice** (AGENTS.md, non-negotiable 3).

The person's own settings (`display_name`, `avatar_url`, `locale`, `marketing_consent`) are
written by `PATCH /api/app/v1/profile` through `profileStore.updateOwnSettings`, which copies
those four fields by name and nothing else. No API role holds any privilege on `profiles`. A
column REVOKE does **not** narrow a table-level GRANT: the template's original column REVOKEs
did nothing on a Supabase project, whose default privileges grant every table to
`authenticated`, and any signed-in person could make themselves an admin. `check:rls` fails if
any API role can write a server-controlled column, however the privilege was granted
(`SERVER_CONTROLLED_COLUMNS`).

## Shared numbers have one definition

Any count the admin panel and the Play Stats API both show comes from
`apps/web/src/lib/dashboard-stats.ts`: one definition of "paid user" (`bucketFor()`,
`isPaid()`), one retention calculation, in one place. An admin screen that counts its own way
will disagree with the stats dashboard, and then nobody trusts either.

## Guests are most of the funnel

`analytics_events.user_id` and `analytics_pageviews.user_id` are **nullable**: anonymous
visitors are most of the top of the funnel. Never inner-join them to `profiles`; that silently
drops every guest, and a landing page reads as having no traffic. Left join, or count by
session.

## A failed query is an error, not an empty result

A failed query throws, and the caller lets it: the screen says "couldn't load" instead of
rendering "0 users" or "$0". Never catch a read just to return `[]` or `null`. An empty result
is only ever what the database actually returned. The app's API client is held to the same
rule: it throws on any failure, and a screen shows it (`apps/mobile/lib/api.ts`).

## Reads that must be complete

PostgREST stopped every select at 1,000 rows, which is why the Play Stats scans used to page by
hand. Prisma returns everything the query matches: bound a read of an unbounded table by its
window (a date range), never by a `take` that silently drops rows. A `take` is only for walking
a set in batches to the end (`accountActivitySince` in `src/server/db/play-stats.ts`).

Schema changes: [migrations](migrations.md). The app's side of this: [mobile data](mobile-data.md).
