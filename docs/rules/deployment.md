# Deployment

Never run a manual production deploy (`vercel --prod`, `supabase db push` or
`supabase functions deploy` against production, `eas update --channel production` from a
branch, `eas submit` of an unreviewed build) unless the person you are working for explicitly
asks for that one deploy. What ships, ships from `main`, after a merged PR.

This repo deploys three things three ways.

## Web (`apps/web`): Vercel

- Vercel's git integration. A push to `main` deploys production; every branch and PR gets a
  preview deploy. Project root directory `apps/web`, framework Next.js.
- **Node 22.x.** Vercel takes the Node version from `engines.node` in the root directory's
  `package.json` (`apps/web/package.json`, not the repo root's), and picks the **newest**
  supported major that the range allows. So the range carries a ceiling, `>=22.18.0 <23`:
  without it, `>=22.18.0` would run production on Node 24 while CI tests on 22. Move CI,
  `.nvmrc`, `eas.json` and this range together when the repo moves to the next LTS.
- Environment variables live in the Vercel project, per environment, mirroring
  `apps/web/.env.example`. See [secrets](secrets.md) and `docs/ENV_SETUP.md`.
- **Crons** are declared in `apps/web/vercel.json` (`/api/cron/lifecycle`, daily at 09:00
  UTC) and every cron route refuses a request without the `CRON_SECRET` bearer token
  (`src/server/api/cron-auth.ts`), answering 503 when the secret is unset. So a deployment
  without `CRON_SECRET` never emits `subscription_expiring` or `user_inactive`. A play must
  not launch without it.
- **The `prepare` script must never fail a deploy.** Vercel strips `.git`, so a bare
  `git config` exits 128 and takes the install down. It ends `|| true`; keep that (or
  `|| exit 0`).
- Preview deploys catch what local gates cannot: the build environment, the install step, real
  env vars. Check the preview of a PR that changes build config, dependencies or env before it
  is merged.

## Database: migrations, not hands

`.github/workflows/deploy-migrations.yml` applies `apps/web/prisma/schema/migrations` on every
push to `main`, then the run-once SQL, then checks drift and RLS on the live database
([migrations](migrations.md)). It stays off until the repository variable
`PRISMA_BASELINE_RESOLVED` is `true`, and a database `supabase/migrations/` built needs the
one-time `resolve-baseline` task first. Never `supabase db push`: the Supabase CLI no longer
applies migrations here. Flag deploy ordering in the PR whenever app code depends on a
migration: the app deploy and the migration are not sequenced for you. The web app needs
`DATABASE_URL` (the transaction pooler) in Vercel's Production environment: a production build
without a valid one fails (`apps/web/deploy-checks.mjs`), so the live deployment keeps running
([the database URL](../ENV_SETUP.md#the-database-url)). `DIRECT_URL` is for migrations only,
and they run in GitHub Actions, never in a Vercel build.

## Mobile (`apps/mobile`): EAS Update first, the stores when it must

- **An OTA update is the default release** for a JavaScript-only change: the publish workflow
  (`apps/mobile/.eas/workflows/publish-update.yml`) to the `preview` channel, confirm on a
  device, then `production`, from `main` only ([OTA updates](ota.md)). It reaches builds made
  with `expo-updates` configured, so from a play's first store build on.
- **A store build** (EAS Build, or a local Xcode/Gradle build) is for native changes and for
  changes OTA must not carry. It goes to TestFlight / Play internal testing first, then to
  review, then out as a phased release ([mobile releases](mobile-releases.md)).
- Both pass the `store-review` gate first ([store review](store-review.md)).
- Build and update environment variables live in EAS environment variables, never in
  `eas.json` ([secrets](secrets.md)).
- **EAS builds use Node 22** because each build profile in `apps/mobile/eas.json` sets `node`
  to an exact 22.x version. Without it they would use the SDK 55 build image's default,
  Node 20.19.4. A local Xcode or Gradle build uses whatever Node the machine has: `nvm use`
  first.

## No edge functions

The template deploys none. The RevenueCat webhook is the web route
(`/api/webhooks/revenuecat`), which also emits the Play Events the email flows depend on; the
edge function that duplicated it was deleted, because two implementations of the money path is
how one silently goes stale. A play that deployed it deletes it from the project and points
RevenueCat at the web route.
