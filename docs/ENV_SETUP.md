# Environment setup

Two env files, one per app, copied from the committed examples before you start anything:

```bash
cp apps/web/.env.example    apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
```

Both point at the **same** Supabase project. Never commit them: `.gitignore` excludes
`.env.local`, and `.claude/settings.json` denies Claude's Read tool on it (a guard against
accidents, not a sandbox: never ask an agent to print one). The committed `.env.example` files
(placeholders only) are the exception: agents read and update them so `check:env` stays green.

Local values for both files, from the local Supabase stack, are under
[Local Supabase](#local-supabase) below; the root [`README.md`](../README.md#quickstart) has
the whole quickstart. This file is setup; what a live play sets before it ports a template
change is in [`UPGRADING.md`](UPGRADING.md).

## apps/web/.env.local

Copy from `apps/web/.env.example`.

Every variable the web app reads is declared once, in the Zod schema at
`apps/web/src/lib/env.ts`, and listed in `apps/web/.env.example`.
`npm run check:env` fails when code reads a variable neither declares, when the
two disagree, or when one declares a variable nothing reads. The schema runs
once per server instance at boot (`src/instrumentation.ts`): every variable is
optional, but one that is set and malformed (a URL that isn't one, an unknown
`LOG_LEVEL`) stops the server with the list of bad names instead of failing
three requests later.

| Variable                               | Where to get it                         | Notes                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | —                                       | Your production URL, e.g. `https://yourapp.com`.                                                                                                                                                                                                                                                                                   |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Project → API                | Public. Legacy server-side alias `SUPABASE_URL` still works as a fallback.                                                                                                                                                                                                                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project → API                | Public (publishable). Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` still works as a fallback.                                                                                                                                                                                                                                            |
| `SUPABASE_SECRET_KEY`                  | Supabase → Project → API                | **Server-only. Bypasses RLS — never expose.** Legacy `SUPABASE_SERVICE_ROLE_KEY` still works as a fallback.                                                                                                                                                                                                                        |
| `DATABASE_URL`                         | Supabase → Connect → Transaction pooler | Port 6543, plus `?pgbouncer=true&connection_limit=1` (no prepared statements through the pooler; one connection per serverless instance). Every web read and write goes through it, as the `postgres` user that owns the tables. Unset: the admin panel shows an error, the Play Stats API fails, nothing is recorded first-party. |
| `DIRECT_URL`                           | Supabase → Connect → Session pooler     | Port 5432, no query parameters. Only the Prisma CLI reads it, for migrations; CI's `PRODUCTION_DATABASE_URL` secret is the same URL (docs/rules/migrations.md).                                                                                                                                                                    |
| `LOG_LEVEL`                            | —                                       | `debug`, `info`, `warn`, `error` or `silent`. Unset: `info` (`silent` under `NODE_ENV=test`).                                                                                                                                                                                                                                      |
| `NEXT_PUBLIC_POSTHOG_KEY`              | PostHog → Project Settings              | Match the mobile host.                                                                                                                                                                                                                                                                                                             |
| `NEXT_PUBLIC_POSTHOG_HOST`             | —                                       | e.g. `https://us.i.posthog.com`.                                                                                                                                                                                                                                                                                                   |
| `NEXT_PUBLIC_GA_ID`                    | GA4 → Admin → Data streams              | `G-XXXXXXXXXX`. Blank = off.                                                                                                                                                                                                                                                                                                       |
| `DASHBOARD_API_KEY`                    | Generate a long random string           | Shared with the plays-dashboard. Blank = Play Stats API disabled (503).                                                                                                                                                                                                                                                            |
| `PLAY_SLUG`                            | The play's slug on the dashboard        | Unset: `app`.                                                                                                                                                                                                                                                                                                                      |
| `REVENUECAT_WEBHOOK_SECRET`            | `openssl rand -hex 32`                  | Set RevenueCat → Webhooks → Authorization to `Bearer <secret>`, literally. **A Vercel production build fails without a valid one**; see the section below.                                                                                                                                                                         |

## apps/mobile/.env.local

Copy from `apps/mobile/.env.example`.

| Variable                                                  | Where to get it            |
| --------------------------------------------------------- | -------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`                                | Supabase → Project → API   |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                    | Supabase → Project → API   |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `_ANDROID_API_KEY` | RevenueCat → API Keys      |
| `EXPO_PUBLIC_SENTRY_DSN`                                  | Sentry → Client Keys       |
| `EXPO_PUBLIC_POSTHOG_KEY` / `_HOST`                       | PostHog → Project Settings |
| `EXPO_PUBLIC_SITE_URL`                                    | The deployed `apps/web`    |
| `EXPO_PUBLIC_RESEARCH_PRODUCT_KEY` (optional)             | Your 8xResearch account    |

`apps/mobile/lib/env.ts` is the full list. Everything `EXPO_PUBLIC_` ships inside the app,
so nothing secret ever gets that prefix. Store builds and OTA updates do not read this file:
they read **EAS environment variables**, never `eas.json`. See "Environment variables" in
`apps/mobile/README.md`.

## Reporting, events and email automation

These go in the same web env file as the table above. Every one no-ops when unset —
right for local dev and previews, wrong in production, because the failure is silent.

| Variable                  | Where to get it                                               | What breaks without it                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PLAY_INGEST_KEY`         | Your email/automation platform, when the app is created on it | No lifecycle event reaches the platform, so **no marketing email for this play is ever sent**                                                             |
| `PLATFORM_BASE_URL`       | Your email/automation platform's base URL                     | No lifecycle event is sent, same as an empty `PLAY_INGEST_KEY`                                                                                            |
| `CRON_SECRET`             | `openssl rand -hex 32`                                        | `/api/cron/lifecycle` answers 503, so `subscription_expiring` and `user_inactive` are never emitted and the expiry-reminder and win-back flows never fire |
| `NEXT_PUBLIC_DEV_COUNTRY` | Optional, local only                                          | Nothing — it lets you exercise per-market paths without a VPN                                                                                             |

`PLAY_INGEST_KEY` is **write-only and server-only**. It must never reach a browser or a
mobile client. If something client-side needs to trigger an event, call your own backend
and let the backend emit.

### The RevenueCat webhook secret

`/api/webhooks/revenuecat` writes `plan_type` and `premium_*`, so it **fails closed**: without
`REVENUECAT_WEBHOOK_SECRET` it answers 503 to every event, reads nothing, writes nothing, and
logs an error. RevenueCat retries a non-200 up to five times, over about 2.5 hours (after 5, 10,
20, 40 and 80 minutes); an event still refused after that is not sent again.

- **Vercel production builds fail without a valid secret**, so a deploy that would refuse every
  subscription event is never promoted and the live one keeps running. Valid means at least 32
  visible ASCII characters once trimmed (`openssl rand -hex 32`). Preview builds, CI builds and
  `next dev` are not checked. The check is `apps/web/deploy-checks.mjs`, run from
  `next.config.mjs`.
- **Self-hosted** (`next start` outside Vercel): nothing fails at build or boot. The webhook
  answers 503 and logs an error until the secret is set.
- **In RevenueCat** (Integrations → Webhooks), set the Authorization header field to the literal
  `Bearer <secret>`. RevenueCat sends the field exactly as typed.

A play that is already live and ports this check from the template sets the secret first:
[`UPGRADING.md`](UPGRADING.md#the-revenuecat-webhook-secret).

### The database URL

Every server read and write goes through Prisma on `DATABASE_URL`: the Play Stats API, the
admin panel, first-party analytics, and the RevenueCat webhook's writes to `plan_type` and
`premium_*`. `next build` never connects to it, so a build without it would pass and only the
live requests would fail.

- **Vercel production builds fail without a valid one**, the same way and in the same file as
  the webhook secret (`apps/web/deploy-checks.mjs`, a separate check). Valid means a
  `postgresql://` URL with a host that isn't `localhost` and a database, and, on the
  transaction pooler's port 6543, `pgbouncer=true`. The value never appears in the error.
  Preview builds, CI builds and `next dev` are not checked.
- **`DIRECT_URL` is not needed on Vercel.** The running app never reads it; only the Prisma CLI
  does, and production's migrations run in GitHub Actions (`deploy-migrations.yml`, from the
  `production-database` environment's `PRODUCTION_DATABASE_URL`), never in a Vercel build.
- **Self-hosted** (`next start` outside Vercel): nothing fails at build. Pages and routes that
  read the database fail until it is set.

A play that is already live and ports this check from the template sets the URL first:
[`UPGRADING.md`](UPGRADING.md#the-production-database-url).

### The daily cron

`/api/cron/lifecycle` is the only thing that emits `subscription_expiring` and
`user_inactive` — they are states detected on a schedule, not reactions to a user action.
`apps/web/vercel.json` schedules it daily at 09:00 UTC on Vercel. Anywhere else, point a
daily scheduler at it with the same header.

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically once the variable is set.

The route declares `maxDuration = 300` (seconds): the ceiling on Hobby and the default on Pro
with Fluid compute, which every Vercel project created since April 2025 has. On a Hobby project
without Fluid compute, lower it to 60 in `src/app/api/cron/lifecycle/route.ts`. Each batch of
500 events is sent as soon as it fills, so a run cut short keeps what it sent, and the stable
event ids let a re-run send only the rest. Thirty seconds before `maxDuration` the sweep stops,
sends what it has, logs a warning and answers `complete: false`.

### The app's minimum-version gate

`GET /api/app/v1/config` tells every installed build the oldest native version still supported
(docs/rules/ota.md). Set it per platform, in the same web env file:

| Variable                  | Example                                                   | Notes                                              |
| ------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `APP_MIN_VERSION_IOS`     | `1.3.0`                                                   | 1 to 3 numeric parts. Unset: no minimum.           |
| `APP_STORE_URL_IOS`       | `https://apps.apple.com/app/id<your app id>`              | `https`. Required when the iOS minimum is set.     |
| `APP_MIN_VERSION_ANDROID` | `1.3.0`                                                   | 1 to 3 numeric parts. Unset: no minimum.           |
| `APP_STORE_URL_ANDROID`   | `https://play.google.com/store/apps/details?id=<package>` | `https`. Required when the Android minimum is set. |

A minimum without its store URL, a malformed version or an `http` URL stops the web server at
boot. Raising a minimum locks everyone below it out until they update, including a build in App
Review: never raise it above a build that is in review.

### Avatar uploads

`POST /api/app/v1/uploads` signs upload URLs into the private `user-uploads` bucket with
`SUPABASE_SECRET_KEY`: there is nothing else to set. The deploy's migrations create the bucket
(`20260924000500_user_uploads_bucket`), and `supabase start` creates it locally from
`supabase/config.toml`. A bucket of that name that existed before is left as it was: check in
Supabase → Storage that it is private, limited to 5 MB, and takes JPEG, PNG, WebP and HEIC only.

### MCP tokens

No MCP servers ship with the template. If you add a `.mcp.json`, have each server read its
token from your shell environment as `${VAR}`, never from the repo.

## Local Supabase

`supabase start` runs the stack on the ports in [`supabase/config.toml`](../supabase/config.toml),
on Postgres 17 (`[db] major_version`), the version CI replays the migrations on and hosted
Supabase runs. It (or `supabase status`, any time after) prints the local URLs and keys:

| What                                 | Local value                                               | Goes in                                                                        |
| ------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| API URL (`[api]`)                    | `http://127.0.0.1:55321`                                  | `NEXT_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`                         |
| Publishable key (`sb_publishable_…`) | printed by `supabase status`                              | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key (`sb_secret_…`)           | printed by `supabase status`                              | `SUPABASE_SECRET_KEY` (web only)                                               |
| Database (`[db]`)                    | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` | `DATABASE_URL`, `DIRECT_URL` (web)                                             |
| The web app                          | `http://127.0.0.1:3000`                                   | `EXPO_PUBLIC_SITE_URL` (mobile)                                                |
| Studio (`[studio]`)                  | <http://127.0.0.1:55323>                                  | Nothing: browse the database and users                                         |
| Mail catcher (`[local_smtp]`)        | <http://127.0.0.1:55324>                                  | Nothing: every email the stack sends, sign-in codes included                   |

The legacy names (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`) are read only when the new ones are unset; leave them unset.
Use the hosted project's values for production.

The Prisma CLI reads the database URLs from your shell, not from the env files. Export both,
on two lines, before `npm run db:reset` (which resets the stack, then applies the Prisma
migrations: [`docs/rules/migrations.md`](rules/migrations.md)):

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres
export DIRECT_URL=$DATABASE_URL
npm run db:reset
```

On one line (`export DATABASE_URL=… DIRECT_URL=$DATABASE_URL`), `$DATABASE_URL` expands before
the first assignment runs, so `DIRECT_URL` is empty and Prisma stops with `P1012`.

**Sign-in codes** never leave your machine: the app's six-digit code arrives in the mail
catcher. The app on an Android emulator reaches your computer at `10.0.2.2`, and on a real
phone at its LAN address, not `127.0.0.1`: use that host in both mobile URLs.

## Making yourself an admin

The admin panel (`/admin`) signs in with an email and a **password**, and lets in a user whose
`profiles.is_admin` is true. The app's own sign-in has no password, so create the admin account
with one. Both steps come after the migrations: step 1 needs the trigger that creates the
profile, and step 2 needs the profile.

1. **Create the user.** Supabase Studio (locally <http://127.0.0.1:55323>; hosted, the project
   dashboard) → Authentication → Users → **Add user** → Create new user, with an email and a
   password, and auto-confirm it. The migrations' `on_auth_user_created` trigger creates its
   `profiles` row.
2. **Promote it**, by the email of that existing user:

   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```

   - **Locally**, after `npm run db:reset`: in Studio's SQL editor or `psql "$DATABASE_URL"`.
     It should answer `UPDATE 1`; `UPDATE 0` means no user has that email. The reset empties
     `auth.users` along with everything else, so repeat both steps after every reset.
   - **On a deployed database**, create the user there first, then put the same statement in
     `apps/web/prisma/run-once.sql` and ship it through a pull request: nobody writes to
     staging or production from a SQL editor ([`docs/rules/migrations.md`](rules/migrations.md)).
     The file runs once per database, on the next deploy after the merge: if the user doesn't
     exist by then, it promotes nobody and never runs again.
