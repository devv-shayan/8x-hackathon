# Launch checklist

Work top to bottom. The order mirrors the Play Engineer playbook stages. Don't
mark a box until you've verified it end-to-end on a real device / real payment.

What each variable does, and what breaks without it, is in [`ENV_SETUP.md`](ENV_SETUP.md).
The rename steps, with the commands, are in the root
[`README.md`](../README.md#renaming-for-your-play).

## Brief & setup

- [ ] Brief understood; success criteria + kill threshold agreed with the PM
- [ ] Instrumentation plan agreed **before** building (the `events` skill)
- [ ] The local stack runs, following the root [quickstart](../README.md#quickstart) in its
      order: env files copied, `supabase start`, `DATABASE_URL` and `DIRECT_URL` exported on
      two lines, `npm run db:reset`, local keys filled in, `npm run web:dev`,
      `npm run mobile:start`
- [ ] You can sign in to the app locally with the code from the mail catcher
      (<http://127.0.0.1:55324>)

## Rename and rebrand

- [ ] Root `package.json` → `name` renamed from `app-template` (this switches Claude session
      logging on)
- [ ] The `@app/` npm scope renamed everywhere `git grep -l '@app/'` finds it, except the
      committed migrations; `npm install` and `npm run typecheck` pass after
- [ ] `packages/brand/brand.config.ts` → `preset`, `accent`, `appName`, `siteName`
- [ ] `apps/mobile/app.json` → `name`, `slug`, `scheme` (and the scheme in
      `android.intentFilters`), `ios.bundleIdentifier`, `android.package`, `owner`, the Sentry
      plugin's `organization` and `project`
- [ ] `apps/mobile/app.json` → the splash, adaptive-icon and status-bar colours match the preset
      (each preset's values are in `brand.config.ts`), and the `expo-image-picker` purpose
      strings say what your app does
- [ ] `apps/mobile/lib/constants.ts` → `APP_SCHEME` equal to `app.json`'s `scheme`,
      `APP_SUPPORT_EMAIL`, `APP_DOCS_URL`, `APP_TAGLINE`, `APP_DESCRIPTION`
- [ ] `apps/mobile/assets/icon.png` and `splash-icon.png` replaced
- [ ] Web contact addresses: `SUPPORT_EMAIL` in `apps/web/src/app/support/page.tsx`, `privacy@`
      in `apps/web/src/app/privacy/page.tsx`, `legal@` in `apps/web/src/app/terms/page.tsx`,
      `hello@` in `apps/web/src/components/Footer.tsx`
- [ ] `apps/web/src/lib/pricing.ts` → real prices matching the store products,
      `isPricePlaceholder` deleted
- [ ] `apps/web/src/lib/stores.ts` left empty until a listing is live: the site shows the
      waitlist until then
- [ ] `apps/web/next.config.mjs` → your domain in the `www` → apex redirect;
      `apps/web/src/app/layout.tsx` → the site's title and description
- [ ] Every marker resolved but `apps/web/src/lib/stores.ts`'s:
      `git grep -nE '🎨|🔑|🏷️' -- apps packages` (landing copy, FAQ, paywall features, the
      RevenueCat entitlement id, both apps' privacy policy and terms). The store URLs' markers
      stay until a listing is live ([Store readiness](#store-readiness))

## Repository

- [ ] Branch protection on `main`: pull requests only, admins included, no required checks
      (agents wait for green CI before merging, per `AGENTS.md`)
- [ ] So CI's generated-migration commit triggers its own CI run: the `MIGRATIONS_APP_ID`
      variable and `MIGRATIONS_APP_PRIVATE_KEY` secret (a GitHub App), or a `MIGRATIONS_TOKEN`
      secret. Without either, that commit lands with no CI run of its own
- [ ] Optional: the `CLAUDE_CODE_OAUTH_TOKEN` secret, for the AI review on every PR

## Supabase (hosted)

- [ ] Production project created (and a staging one, if the play has a preview environment)
- [ ] Migrated by `.github/workflows/deploy-migrations.yml`: the `production-database`
      GitHub environment with the `PRODUCTION_DATABASE_URL` secret (Supabase → Connect →
      Session pooler, port 5432), and the repository variable `PRISMA_BASELINE_RESOLVED` set to
      `true` before the first deploy ([`rules/migrations.md`](rules/migrations.md))
- [ ] The first deploy has run. Setting the variable deploys nothing by itself: the workflow
      runs on the next push to `main`, or run it now (Actions → Deploy migrations → Run
      workflow, task `deploy`, or `gh workflow run deploy-migrations.yml -f task=deploy`), and
      check that it finishes green
- [ ] Storage → `user-uploads` is private, 5 MB, JPEG / PNG / WebP / HEIC only (the migration
      creates it; one that existed before is left as it was)
- [ ] An admin account exists ([`ENV_SETUP.md`](ENV_SETUP.md#making-yourself-an-admin))

### Sign-in

The app signs in with a six-digit email code, native Sign in with Apple on iOS, and Apple or
Google through the browser elsewhere (`apps/mobile/app/(auth)/login.tsx`). Locally only the
email code works: both providers are off in `supabase/config.toml`.

- [ ] Authentication → Sign In / Providers → **Email** on, email OTP length **6** (the app's
      code input has six boxes)
- [ ] Authentication → Emails → the **Magic Link** and **Confirm signup** templates contain
      `{{ .Token }}`: the app asks for the code, and the hosted templates send only a link
- [ ] Authentication → Emails → SMTP: your own sender. Supabase's built-in one delivers only to
      your Supabase team's addresses, a few an hour
- [ ] Authentication → URL Configuration: **Site URL** is your web domain, and **Redirect URLs**
      include `<scheme>://auth/callback` (`APP_SCHEME`, equal to `app.json`'s `scheme`): the
      browser flows return there
- [ ] **Apple**: Providers → Apple on. Its Client IDs list the app's bundle identifier
      (`app.json` → `ios.bundleIdentifier`: the native sheet's token is issued for it) and your
      Services ID, with the key, key ID and team ID for the browser flow. The secret generated
      from that key expires after six months: put its renewal in the calendar
- [ ] **Apple Developer**: the App ID has the Sign in with Apple capability (EAS Build turns it
      on from `ios.usesAppleSignIn`), and the Services ID's return URL is the Supabase callback
      shown on the Apple provider page
- [ ] **Google**: Providers → Google on, with a Google Cloud OAuth client (Web application)
      whose authorized redirect URI is the Supabase callback shown on the Google provider page
- [ ] A provider you drop loses its button in `login.tsx`; keep Apple while any other
      third-party login remains (Apple 4.8)

## Web on Vercel

- [ ] Project: root directory `apps/web`, framework Next.js; domain attached, `www` redirects
      to the apex
- [ ] Production environment variables (the full list is `apps/web/.env.example`):
  - [ ] `NEXT_PUBLIC_SITE_URL` — `https://` your domain
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
        `SUPABASE_SECRET_KEY`
  - [ ] `DATABASE_URL` — Supabase → Connect → Transaction pooler, port 6543, ending
        `?pgbouncer=true&connection_limit=1`. **The production build fails without it.**
  - [ ] `REVENUECAT_WEBHOOK_SECRET` — `openssl rand -hex 32`. **The production build fails
        without it.**
  - [ ] `CRON_SECRET` — `openssl rand -hex 32`. Without it the daily cron answers 503: no
        expiry reminders, no win-back emails
  - [ ] `DASHBOARD_API_KEY` — `openssl rand -hex 32`, the same value in the dashboard's
        connection. Without it the Play Stats API answers 503
  - [ ] `PLAY_SLUG` — the play's slug on the dashboard (unset: `app`)
  - [ ] `PLAY_INGEST_KEY` — from the dashboard. Without it no marketing email for this play
        is ever sent
  - [ ] `NEXT_PUBLIC_POSTHOG_KEY` (and `NEXT_PUBLIC_POSTHOG_HOST` off the US cloud),
        `NEXT_PUBLIC_GA_ID`
  - [ ] Not on Vercel: `DIRECT_URL` (only the Prisma CLI reads it; production migrates in
        GitHub Actions) and `NEXT_PUBLIC_DEV_COUNTRY` (local only)
- [ ] The same set for Preview, pointed at staging, if the play has one
- [ ] The lifecycle cron (`apps/web/vercel.json`, daily at 09:00 UTC) is listed under the
      project's Cron Jobs, and its first run answers 200

## Mobile on EAS

- [ ] EAS CLI 21 or newer (`npm install -g eas-cli`): `eas.json`'s `cli.version` refuses an
      older one, and the `eas env:set` commands in `apps/mobile/README.md` need it
- [ ] `app.json` → `owner` is your Expo account or organization; then, in `apps/mobile`, in
      this order: `eas init` (creates the EAS project and writes `extra.eas.projectId`, which
      `app.json` ships without), then `eas update:configure` (rewrites `updates.url` to
      `https://u.expo.dev/<project id>`). Commit both changes
- [ ] EAS project linked to the GitHub repository, base directory `apps/mobile`
- [ ] EAS environment variables, in `production` and `preview` (development builds load their
      JavaScript from Metro, which reads `apps/mobile/.env.local`), all `plaintext`:
  - [ ] `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - [ ] `EXPO_PUBLIC_SITE_URL` — the deployed web app: every data call goes to its
        `/api/app/v1`
  - [ ] `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
  - [ ] `EXPO_PUBLIC_SENTRY_DSN`
  - [ ] `EXPO_PUBLIC_POSTHOG_KEY` (and `EXPO_PUBLIC_POSTHOG_HOST` off the US cloud)
  - [ ] `EXPO_PUBLIC_RESEARCH_PRODUCT_KEY`, only if the play runs 8xResearch interviews
        (AGENTS.md, "In-app interviews"); unset, the widget is off
- [ ] `SENTRY_AUTH_TOKEN` in `preview` and `production` with `--visibility secret`, never in
      `eas.json` (until Sentry is set up, `SENTRY_DISABLE_AUTO_UPLOAD=true`)
- [ ] `eas env:list --environment production` shows every one of them
- [ ] The first store build is made (`eas build --profile production`): it is the build that
      switches OTA updates on ([`rules/ota.md`](rules/ota.md))

### Optional: universal links

Off in the template, and nothing is needed for sign-in: the app opens `<scheme>://` links, and
`app.json` claims no web domain, so a fresh clone makes no claim its site can't back. Do this
only if `https://<your domain>/…` links should open the app instead of the site. Apple and
Google verify the claim by fetching a file from the domain, so the site serves both files before
the build that claims it ships:

- [ ] `https://<your domain>/.well-known/apple-app-site-association`: JSON, served over HTTPS
      with `Content-Type: application/json` and no redirect, whose `applinks.details` name
      `<Team ID>.<ios.bundleIdentifier>` and the paths the app opens
- [ ] `https://<your domain>/.well-known/assetlinks.json`: the `android.package` and the
      SHA-256 fingerprint of the app signing key (Play Console → App integrity → App signing),
      for `delegate_permission/common.handle_all_urls`
- [ ] Both served by `apps/web`, a route handler each, at
      `src/app/.well-known/apple-app-site-association/route.ts` and
      `src/app/.well-known/assetlinks.json/route.ts`, answering with `Response.json(…)`. Claim
      the apex domain: `www` redirects to it (`next.config.mjs`), and a redirected file fails
      verification
- [ ] `app.json`: `ios.associatedDomains: ["applinks:<your domain>"]`, and a second
      `android.intentFilters` entry shaped like the scheme's (`VIEW`, `BROWSABLE` and `DEFAULT`,
      `"autoVerify": true`) with `"data": [{ "scheme": "https", "host": "<your domain>" }]`.
      Both are native: they ship in a store build, not an OTA update
      ([`rules/ota.md`](rules/ota.md))
- [ ] Every path the files list opens a screen: expo-router routes a link by its path

## Build

- [ ] Core flow on web + iOS + Android: signup → onboarding → value → paywall → payment
- [ ] Admin panel reachable at `/admin` with the admin account
- [ ] Data pipeline live: `/api/dashboard/v1/summary` + `/users` return real numbers with the
      Bearer key, and the play is connected in your stats dashboard (
      [`PLAY_API.md`](PLAY_API.md))
- [ ] Scope cut to what v1 needs — no gold-plating

## Integrate & instrument

- [ ] GA4 + PostHog verified — events fire end-to-end, landing to paid
      ([`EVENTS.md`](EVENTS.md))
- [ ] RevenueCat live: products in App Store Connect and the Play Console, the `premium`
      entitlement and a `default` offering; full purchase + restore + entitlement path works
- [ ] RevenueCat → Integrations → Webhooks: `https://<your domain>/api/webhooks/revenuecat`,
      Authorization `Bearer <REVENUECAT_WEBHOOK_SECRET>`, literally; a sandbox purchase
      updates `profiles.plan_type`
- [ ] Events confirmed landing in the plays database, and a test sign-up gets the welcome email

## QA gate

- [ ] Full flow passes on real iOS + Android + web
- [ ] Payment path run as a **real transaction**
- [ ] Copy / language checked for every market
- [ ] Team + creator feedback incorporated

## Store readiness

- [ ] `npm run check:store -- --strict` passes and the `store-review` skill says SHIP
- [ ] Privacy policy + Terms reachable (`/privacy`, `/terms`, and in the app)
- [ ] Account deletion reachable in the app (Settings) and on the web (`/delete-account`) —
      required by both stores
- [ ] App icons, screenshots, store listings ready; the privacy forms filled from
      [`rules/permissions-and-privacy.md`](rules/permissions-and-privacy.md)
- [ ] App Store + Play Store review submissions passing
- [ ] Once a listing is live: its URL in `apps/web/src/lib/stores.ts` (the site switches from
      the waitlist to the store buttons), and `APP_STORE_URL_IOS` / `APP_STORE_URL_ANDROID`
      on Vercel before any `APP_MIN_VERSION_IOS` / `APP_MIN_VERSION_ANDROID`

## Launch support

- [ ] On hand for fast fixes as traffic hits
- [ ] Funnel drop-offs → shipped changes, same day where possible
- [ ] Instrumentation kept intact while iterating
- [ ] `.claude-logs/` committed and pushed
