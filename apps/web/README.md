# @app/web

The Next.js 15 (App Router) marketing site, admin panel, and backend API routes.
Co-deployed on Vercel; talks to the same Supabase project as `apps/mobile`: Supabase Auth for
identity, and Postgres through Prisma for every byte of data.

## Run

```bash
# from the monorepo root
npm install          # once, installs all workspaces
cp apps/web/.env.example apps/web/.env.local   # then fill it in
npm run web:dev      # http://localhost:3000
```

The page renders with `.env.local` as copied. Sign-in, the admin panel and every API route
that reads the database need the local Supabase stack: the root
[Quickstart](../../README.md#quickstart) has the steps and the local values.

## What's here

```
src/app/
├── page.tsx              # Landing: Hero → Story → FeatureDescent → PricingTeaser → FaqSection → CallToAction
├── pricing/              # Pricing page (plans from src/lib/pricing.ts)
├── support/              # Support + contact form
├── privacy/ terms/       # Legal (required for the app stores)
├── delete-account/       # Account deletion (required for the app stores)
├── admin/
│   ├── login/            # Email/password sign-in (Supabase)
│   └── (protected)/      # Guarded by profiles.is_admin → Overview, Users, Analytics
├── api/
│   ├── app/v1/           # The mobile app's API: profile, items, tasks, activity, notifications,
│   │                     #   uploads, account, config (schemas in @app/contract)
│   ├── waitlist/         # POST email → waitlist table
│   ├── contact/          # POST message → contact_messages
│   ├── delete-account/   # Authed self-delete, or email request
│   ├── track/            # First-party analytics beacon → analytics_events
│   ├── lifecycle/session/  # The app reports a session: user_signed_up, last_seen_at
│   ├── cron/lifecycle/   # Daily: subscription_expiring, user_inactive (CRON_SECRET)
│   ├── webhooks/revenuecat/   # Subscription state → profiles.plan_type
│   ├── admin/users/      # Admin-only user list
│   └── dashboard/v1/     # Play Stats API, summary/ and users/ (Bearer DASHBOARD_API_KEY)
├── layout.tsx            # Brand CSS variables, fonts, metadata, analytics providers
├── icon.tsx              # The favicon, drawn from the brand
└── sitemap.ts robots.ts
src/components/           # Nav, Footer, PageShell, StoreBadges, WaitlistForm, PricingTeaser,
                          #   PricingMatrix, PlanCard, CallToAction, forms, tracking
src/components/landing/   # Hero, Story, FeatureDescent, FaqSection and their scenery
src/components/device/    # The phone frame and the app screens drawn in it
src/lib/                  # env schema, stores (launch state), pricing, faq, dashboard-stats,
                          #   require-admin, dashboard-api-auth, geo, utils
src/lib/analytics/        # The event registry (events.ts), client + first-party sinks
src/lib/plays/            # The Play Events API client (lifecycle emails)
src/lib/supabase/         # the auth-only Supabase clients (server, secret-key, browser)
src/server/db/            # the Prisma client and the stores: every query lives here
src/server/api/           # createAppRoute (the /api/app/v1 wrapper), cron-auth, cursors
src/server/auth/          # requireUser: the app's bearer token, verified
src/server/account/       # account deletion
src/server/storage/       # signed avatar upload URLs (the user-uploads bucket)
src/server/lib/logger/    # the structured (Pino) logger; server-only
prisma/schema/            # the schema, one file per domain, and its migrations (CI writes them)
prisma/ci/                # the Supabase stand-in for a replay, and the baseline's catalog fingerprint
prisma/run-once.sql       # one-off data changes, applied once per database (npm run db:run-once)
deploy-checks.mjs         # fails a Vercel production build without DATABASE_URL or the webhook secret
vercel.json               # the daily lifecycle cron
src/instrumentation.ts    # validates the env schema once per server instance, at boot
src/middleware.ts         # refreshes the Supabase session cookie on every request
```

`npm run check:env` checks that every variable the code reads is declared in
`src/lib/env.ts` and `.env.example`, and that nothing declared there is unused.
`npm run web:test` runs the unit suites (Node 22.18 or a later 22.x); `npm run test:db` here runs the
database suites against a replay, as a non-superuser (`docs/rules/migrations.md`).

## Launch state

`src/lib/stores.ts` holds the App Store and Google Play URLs, and ships with both empty: the
site is in its pre-launch state, with the waitlist form where the store buttons go and a
closing band that says the app is not out yet. Set a URL once that listing is live and the
page switches itself (`IS_LIVE`); a play live on one store sets only that one.

## Brand

Colours, fonts, radii, shadows and easings come from `@app/brand`: the root layout
inlines them as CSS variables (scoped by `<html data-preset data-scheme>`) and the
Tailwind preset points every utility at them. Rebrand in
`packages/brand/brand.config.ts` (preset, accent, site name) and both web and mobile
follow.

## Analytics

PostHog (`src/components/PostHogProvider`), Google Analytics 4
(`src/components/GoogleAnalytics`), and Vercel Analytics are wired in `src/app/layout.tsx`.
Each no-ops until its env var is set. First-party events go through `/api/track` into
`analytics_events`, and every event name is registered in `src/lib/analytics/events.ts`
([`docs/EVENTS.md`](../../docs/EVENTS.md)). **Verify events fire end-to-end before
sending traffic** (per the Play Engineer playbook).

## Deploy (Vercel)

Set the root directory to `apps/web`, framework **Next.js**, and add every var
from `.env.example` in Project → Settings → Environment Variables. A production build fails
without a valid `DATABASE_URL` and `REVENUECAT_WEBHOOK_SECRET` (`deploy-checks.mjs`);
[`docs/ENV_SETUP.md`](../../docs/ENV_SETUP.md) says what each variable does, and
[`docs/LAUNCH_TODO.md`](../../docs/LAUNCH_TODO.md) what production needs.
