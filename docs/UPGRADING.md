# Upgrading a live play

A play is a copy of this template, not a fork that follows it. When a live play ports a change
from the template, most of it is code that lands through a pull request like any other. Some of
it needs a step outside the repository first, or the next deploy fails, an update reaches
nobody, or a check goes red. This file lists those steps, per change. Do the ones for what you
are porting, before merging it.

New plays need none of this: [`ENV_SETUP.md`](ENV_SETUP.md) and
[`LAUNCH_TODO.md`](LAUNCH_TODO.md) set everything up from the start.

## The deploy fails without a production value

A Vercel production build runs `apps/web/deploy-checks.mjs` (from `next.config.mjs`) and fails
without these. The deployment already live stays up, but nothing ships until the value is set.
Preview builds, CI builds and `next dev` are not checked.

### The RevenueCat webhook secret

For a play cloned before the build checked `REVENUECAT_WEBHOOK_SECRET`: before merging the
change that adds the check, set `REVENUECAT_WEBHOOK_SECRET` in Vercel's Production environment
(`openssl rand -hex 32`), and the matching Authorization header in RevenueCat (Integrations →
Webhooks), the literal `Bearer <secret>`. What the secret guards is in
[`ENV_SETUP.md`](ENV_SETUP.md#the-revenuecat-webhook-secret).

### The production database URL

For a play cloned before `next.config.mjs` called `assertProductionDatabaseEnv`: before merging
the change that adds the check, set `DATABASE_URL` in Vercel's Production environment to
Supabase → Connect → Transaction pooler, ending `?pgbouncer=true&connection_limit=1`. What
counts as valid is in [`ENV_SETUP.md`](ENV_SETUP.md#the-database-url).

## The database

- **A database `supabase/migrations/` built** (a play cloned before the schema moved to
  Prisma): record the Prisma baseline as applied before anything deploys,
  [`rules/migrations.md`](rules/migrations.md#adopting-prisma-on-a-live-database).
- **App builds from before `/api/app/v1`** read tables directly, and stage 2 of the security
  migration cuts them off: raise the minimum supported version past them first
  ([`rules/migrations.md`](rules/migrations.md)).
- **The `revenuecat-webhook` edge function**, if the play deployed it: delete it from the
  Supabase project and point RevenueCat at `/api/webhooks/revenuecat`
  ([`rules/deployment.md`](rules/deployment.md#no-edge-functions)).

## The app

- **A native change moves the runtime version.** A dependency with native code (such as
  `expo-dev-client`), an `app.json` native field, or an `eas.json` build profile or `cli` block
  (such as `cli.version`) gives the next update a runtime version no installed build has. After
  porting one, the play ships a store build before its next OTA update
  ([`rules/ota.md`](rules/ota.md)).
- **`eas.json` requires EAS CLI 21 or newer** (`cli.version`). Everyone who runs `eas` for the
  play upgrades first: `npm install -g eas-cli`.
- **`ios.associatedDomains` is no longer in the template's `app.json`.** A play that already
  claims its domain and serves the two verification files keeps its entry; one that claims it
  without serving them either serves them or removes the claim in its next store build
  ([`LAUNCH_TODO.md`](LAUNCH_TODO.md#optional-universal-links)).

## Local development

- **The local stack runs Postgres 17** (`supabase/config.toml`, `[db] major_version`), as CI
  and hosted Supabase do. A data volume made by an older major version doesn't start under the
  new one: `supabase stop --no-backup`, then `supabase start` and `npm run db:reset`. Local
  data is seed data, and the reset replaces it anyway.

## Workflow

- **Conventional Commits** (the `commit-msg` hook and CI's `commits` job): the plays
  dashboard's `/shipped` digest reads a play's commit messages. A play cloned before the rule
  is checked on the digest before it switches ([`rules/commits.md`](rules/commits.md)).
