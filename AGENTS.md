<!-- BEGIN:pr-workflow -->

# PR workflow — non-negotiable

You (the coding agent) open and push these PRs. CI is NOT your dev loop: every
push to an open PR is a paid CI run, an AI-review round, and real Actions
minutes. Keep iteration out of CI.

- **Finish and self-review before the PR is reviewable.** Run `/local-review`
  (lint, typecheck, format, env, tests, build + a manual pass against
  docs/rules) on your own subscription and fix everything it finds. If you are
  pushing to find out whether it compiles, that is the bug this rule stops.
- **Don't let CI review half-done work.** Where draft PRs exist (paid plans),
  open with `gh pr create --draft` and run `gh pr ready` only when done. Where
  they don't (Free-plan repos), your local branch is the draft — don't open the
  PR until it's finished; opening it is the "ready" signal.
- **Open/ready once, on the finished diff.** Treat a reviewable PR as
  merge-ready; don't push follow-up commits to iterate in the open.

<!-- END:pr-workflow -->

<!-- BEGIN:merge-on-green -->

# Merging — wait for green CI

Nothing on GitHub blocks a merge while checks are failing or still running,
so this is on you (the coding agent). A merge on a red check can break `main`
for everyone.

- **Run the checks before you push.** Run `/local-review`, or this repo's
  local gate (lint, typecheck, tests, build), and fix what it finds. CI on
  the PR is the final check, not the dev loop.
- **Wait for every CI check to finish before merging.** Run
  `gh pr checks <number> --watch` and merge only once all of them pass. Never
  merge while one is pending or failing. Don't reach for `gh pr merge --auto`
  (with no required checks it merges at once) or `--admin` to skip the wait.
- **A failing check means fix it,** push, and wait again. Not "merge now, fix
  it after".
- **The one exception is the person insisting.** If they want it merged
  before the checks pass, first tell them which checks are failing or still
  running and that `main` may break, then ask them to confirm. Merge early
  only on that explicit confirmation; a plain "merge it" is not one.

<!-- END:merge-on-green -->

# AGENTS.md

The file every coding agent reads in this repo: Claude Code, Codex, Cursor, Gemini, whatever
comes next. The rules live here and in `docs/rules/`; each tool's own file imports this one
and adds only what is specific to that tool.

This repo is a play built on the **mobile monorepo template**: an Expo app (`apps/mobile`, the
product), a Next.js marketing site, admin panel and API (`apps/web`), a shared brand package
(`packages/brand`) and a Supabase backend (`supabase/`). The product is in
[docs/product/brief.md](docs/product/brief.md), and
[docs/product/context.md](docs/product/context.md) says how the code fits together and what's built:
read it before starting work. AI calls go through `apps/web/src/server/ai/`, and
only the server calls them: the app reaches them through `/api/app/v1`.

It follows the web template, [8xsocial/template-web](https://github.com/8xsocial/template-web).
Where it differs, [the section below](#where-this-repo-differs-from-template-web) says so and
why.

## Non-negotiables

These three are what separate a play that can be judged from one that cannot. Everything else
in this file is detail.

1. **Every user-visible change registers its events first.** Screen, route, button, paywall,
   onboarding step, checkout, settings toggle, or a cron that changes a user's state. Run the
   **`events`** skill before writing the feature: it asks the things the code cannot tell you.
   An unregistered event is rejected by the beacon and disappears silently.
2. **This play reports its own numbers.** `apps/web/src/app/api/dashboard/v1/` is the Play Stats
   API. Get the live contract from your stats dashboard before touching it. Never implement it from
   memory, including from this file.
3. **Money and entitlement are load-bearing.** Anything writing `plan_type`, `premium_*` or a
   subscription row goes through server code (a server route that verified its caller, writing
   through Prisma: `apps/web/src/server/db/profiles.ts`), never the browser and never the app.
   Review those diffs twice.

The skills named in this file live in `.claude/skills/<name>/SKILL.md`. An agent that cannot
run skills reads that file and follows it; the steps are the same.

## Mobile: OTA first

A store build means days in review. An OTA update reaches users in minutes. **Ship every mobile
change as an OTA update unless it cannot be one.** Do not ask the developer to build and submit
when an update would do.

It cannot be an OTA when native code changed: a dependency with native code added, removed or
upgraded; `app.json` plugins, permissions, infoPlist, entitlements, icons, splash, identifiers
or version; an `eas.json` build profile; an Expo SDK or React Native upgrade. The fingerprint
runtime version changes when any of these do. Then say plainly: "this needs a store build
because <change>".

It must not be an OTA, even when it could be, if it changes what the app is, adds something to
buy outside in-app purchase, reveals a feature hidden from review, or needs a new permission or
privacy disclosure.

Every update: `npm run check:store` and the `store-review` skill, then `preview`, then
`production`, through `apps/mobile/.eas/workflows/publish-update.yml`. From `main` only. See
[docs/rules/ota.md](docs/rules/ota.md).

## Mobile: store review

Before any OTA to production, store build, or submission, run the `store-review` skill. It
blocks on what gets apps rejected. The ones that recur: ads or attribution SDKs without the App
Tracking Transparency prompt before they start; permissions without a specific purpose string;
a paywall without Terms of Use and Privacy links or Restore; no in-app account deletion;
features hidden from reviewers behind flags. See
[docs/rules/store-review.md](docs/rules/store-review.md).

## In-app interviews (8xResearch)

Every play ships 8xResearch's interview widget (`components/ResearchWidget.tsx`), **off until the
app has a product key**. With a key, the app asks 8xResearch on every launch whether a study is
live for this product and shows a small pill only while one is. Studies are published, paused and
scheduled in 8xResearch, so a new one reaches installed apps with no release. It is mounted once,
beside the navigator in `app/_layout.tsx`, for signed-in, onboarded people.

To turn it on:

1. Get this app's **product key** from your 8xResearch account: 18 hex characters, one per app,
   reused for every study. It is public by design.
2. Set `EXPO_PUBLIC_RESEARCH_PRODUCT_KEY` in the EAS environments (and in `.env.local` to try it).
3. **Make a store build.** The key also adds the microphone (`research-widget.plugin.js`):
   `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` on Android, its `microphonePermission` string on
   iOS. That changes the fingerprint, so updates published with the key reach only builds made
   with it. Expo Go ignores the permissions, and a dev client built before the key has no
   microphone: rebuild it. The iOS string replaces expo-image-picker's, so if the app also
   films video, say both uses in `microphonePermission`.
4. Before submitting: audio and typed answers in the App Store privacy labels and Play's Data
   safety form ([the SDK table](docs/rules/permissions-and-privacy.md)), 8xResearch named in the
   privacy policy, and a line in the review notes that the app may offer optional interviews.
5. Publish a study against the key in 8xResearch, then reopen the app. Nothing shows before
   that; that is the expected state. Check voice on one Android phone: 8xResearch has not
   verified Android voice yet.
6. Look at the pill on every signed-in screen: it floats in the bottom-right corner above
   everything, and must not cover a button. It hides itself on the paywall (`PAYWALL_PATH` in
   `components/ResearchWidget.tsx`); a play whose paywall lives elsewhere changes that path.

To show it somewhere else (one screen, the landing page), move `<ResearchWidget>` and change its
`visible` condition. It must stay mounted while an interview runs, or the interview stops.

## Engineering rules

Each is a short summary. Read the linked file before touching that area; don't rely on the
summary alone. Where template-web has a standard this repo hasn't adopted (admin RBAC, typed
feature flags, the error-reporting helpers), the rule file says so and what to do instead.

**Data and the backend**

- **[Database access](docs/rules/database.md)**: Prisma on the server is the one data path;
  Supabase is auth only. Authorization is in the route (`requireUser`, `requireAdmin`); RLS is
  on with no policies and nothing granted, as a locked door. Money columns are server-only.
  Shared counts come from `dashboard-stats.ts`. A failed query is an error, never an empty
  result. Add no new `.from()`/`.rpc()` call site.
- **[Migrations](docs/rules/migrations.md)**: CI writes the migration from the Prisma schema;
  you write the schema. RLS-on for every new table is the one hand-written statement. The
  phone is the oldest client: a schema change never breaks a `v1` route.
- **[Auth](docs/rules/auth.md)**: Supabase Auth for identity. Cookies for the website, a bearer
  token for the app, verified server-side; the app never sends a user id the server trusts.
- **[Authorization](docs/rules/authorization.md)**: the guard for every caller (person, admin,
  Play Stats API, cron, webhook), decided in code before the query. Unset secret means closed.
- **[Analytics](docs/rules/analytics.md)**: a registry per app (web and mobile), three sinks,
  events registered before the feature, `check:events` in CI, canonical Play Events names, no
  personal data in properties.
- **[Secrets](docs/rules/secrets.md)**: environment variables only (Vercel, EAS environment
  variables, GitHub secrets). `EXPO_PUBLIC_*` is public; `eas.json` and `app.json` hold
  placeholders only; never in chat; a scanner at the pre-commit hook and in CI.
- **[Logging](docs/rules/logging.md)**: Pino on the web server, the mobile logger on the device
  (Sentry breadcrumbs in release). Never `console.*` in application code.
- **[Error handling](docs/rules/error-handling.md)**: expected errors are control flow;
  unexpected ones go through the logger's `log.error` (to Sentry on mobile, to Vercel's logs on
  the web, which has no Sentry); nothing raw reaches the person, and a failed request is never
  shown as an empty list.
- **[Deployment](docs/rules/deployment.md)**: never deploy by hand. Vercel ships `main` for the
  web; EAS Update, then the stores, for the app.

**Mobile**

- **[OTA updates](docs/rules/ota.md)**: the decision (native change → build; otherwise OTA,
  unless the store rules forbid it), the fingerprint runtime, channels, preview first, staged
  rollout, rollback, source maps, the minimum-version gate.
- **[Store review](docs/rules/store-review.md)**: the rule table (ATT, purpose strings, paywall
  links, account deletion, hidden features, …) and the verdict format.
- **[Mobile data](docs/rules/mobile-data.md)**: the app talks to `/api/app/v1`, never to
  tables; `v1` never changes shape once a store build calls it; one Zod contract for both apps;
  signed upload URLs for storage.
- **[Mobile releases](docs/rules/mobile-releases.md)**: versions and build numbers, test tracks
  before production, phased release, Sentry maps for every build and update, native
  directories out of git.
- **[Permissions and privacy](docs/rules/permissions-and-privacy.md)**: specific purpose
  strings, ask in context, minimal Android permissions, the privacy manifest, and what every
  SDK the template ships collects (the source for the store privacy forms).

**Code**

- **[State management](docs/rules/state-management.md)**: TanStack Query for server state on
  mobile; Server Components on the web; entitlement is the server's; no global store by
  default.
- **[Components and icons](docs/rules/components.md)**: the primitives each app has, tokens
  only, Server Components by default, accessibility as part of done.
- **[Feature flags](docs/rules/feature-flags.md)**: typed keys, safe defaults, and never a way
  to hide anything from App Review.
- **[Code style](docs/rules/code-style.md)**: Prettier decides formatting; Zod at every
  boundary; ISO dates, integer money; brand tokens for styling.
- **[Code quality](docs/rules/code-quality.md)**: no `any`, no god files, the Rule of Three, named
  constants, comments that earn their keep.
- **[Feature approach](docs/rules/feature-approach.md)**: propose the 80/20 slice for a new
  feature; for a live one, the edge cases are the job.

**Workflow**

- **[Commits](docs/rules/commits.md)**: don't over-commit; Conventional Commits with curated
  scopes, enforced by a hook and in CI; branch, PR, merge commit.
- **[Pull requests](docs/rules/pull-requests.md)**: draft until done, then the real description
  (standards before and after, gates, store-review verdict, Production Watch List); an agent
  never merges on its own, only when the person explicitly tells it to merge that PR.

## Commits, branches and pull requests

- **Branch, PR, green CI.** Every change lands through a pull request whose CI is green.
  **An agent never merges on its own:** it merges a pull request only when the person
  explicitly tells it to merge that pull request. **Never push to `main`**, and never
  force-push anything but your own branch.
- **Conventional Commits:** `type(scope): subject`, imperative, lowercase, no trailing period,
  header at most 72 characters. Types: `feat` `fix` `perf` `refactor` `style` `docs` `test`
  `build` `ci` `chore` `revert`. Scopes, optional: `mobile` `web` `api` `auth` `db` `events`
  `paywall` `onboarding` `admin` `ota` `store` `brand` `i18n` `ci` `docs` `deps`.
- A few deliberate commits per PR, verified locally first. Formatting and logic never share a
  commit.
- The `ship` skill (`.claude/skills/ship/SKILL.md`) runs this whole path: the `local-review`
  gates, `store-review` when the app changed, the commit, the branch, the PR, CI to green.
  Asked to "push to main" or "merge to main", it opens the PR, watches CI to green and stops;
  that is not an instruction to merge.

Details: [docs/rules/commits.md](docs/rules/commits.md),
[docs/rules/pull-requests.md](docs/rules/pull-requests.md).

## Stack

- **Monorepo:** npm workspaces. Apps in `apps/*`, shared packages in `packages/*`.
- **Node 22**, 22.18 or a later 22.x, everywhere: `.nvmrc` locally, CI, EAS builds (`node` in
  each `eas.json` profile) and Vercel (`apps/web`'s `engines`, `>=22.18.0 <23`). See
  [docs/rules/deployment.md](docs/rules/deployment.md).
- **Mobile** (`apps/mobile`, `@app/mobile`): Expo SDK 55, React Native 0.83, React 19,
  expo-router, NativeWind, Supabase Auth, RevenueCat, Sentry, PostHog, i18next, TanStack Query.
  Continuous Native Generation: no `ios/` or `android/` in git.
- **Web** (`apps/web`, `@app/web`): Next.js 15 App Router, React 19, Tailwind, Prisma 6,
  Supabase SSR for auth, under `apps/web/src/`. Marketing site, admin panel, `/api` routes and
  the Play Stats API. The schema and its migrations are in `apps/web/prisma/schema/`.
- **Brand** (`packages/brand`, `@app/brand`): shared tokens and the web Tailwind preset.
- **Backend:** Supabase (Auth, Postgres, storage). `supabase/` holds `config.toml` for the
  local stack, seed data, and `migrations/`, which is frozen history.

Next.js 15 here: `params`, `searchParams`, `cookies()` and `headers()` are async; await them.
The session refresh runs in `apps/web/src/middleware.ts`.

## Commands (run from the repo root)

- `npm install`: install every workspace (and point git at `.githooks/`)
- `npm run web:dev`: Next.js dev server (localhost:3000)
- `npm run mobile:start`: Expo dev server
- `npm run db:migrate`: apply the Prisma migrations to `DATABASE_URL`/`DIRECT_URL`;
  `npm run db:reset` resets the local Supabase stack first. Production is migrated by
  `.github/workflows/deploy-migrations.yml`, never by hand.

The gates are exactly what CI runs on every pull request. Run them before you commit, with the
`local-review` skill (`.claude/skills/local-review/SKILL.md`), and report their real output:

```bash
npm run check:secrets    # every tracked file (the pre-commit hook scans staged ones)
npm run check:template   # the template tracks no session logs or worktrees
npm run typecheck        # web, mobile, @app/contract and @app/brand
npm run lint             # 0 errors and 0 warnings (--max-warnings=0)
npm run format:check     # Prettier (npm run format writes it)
npm run check:standards  # the standards checklist (docs/STANDARDS.md)
npm run check:events     # every fired event is in its app's registry; unfired ones only warn
npm run check:env        # every env read is declared in the schema and .env.example, and vice versa
npm run check:store      # the store-review rules a file can decide
npm test                 # scripts, mobile Jest (+ packages/brand), the web and @app/contract suites
npm run web:build        # the Next.js production build
```

CI's `migrations` job adds the database gates: it replays the migrations onto an empty
Postgres, then the drift check, `npm run check:rls` and the database suites as a non-superuser
(`test:db`). `local-review` has the commands for a local replay
([docs/rules/migrations.md](docs/rules/migrations.md)).

## Instrumentation map

Three sinks, three different questions. `docs/EVENTS.md` is the full guide;
[docs/rules/analytics.md](docs/rules/analytics.md) is the rules.

| Sink                       | Where                                                                                                   | Answers                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| PostHog (+ GA4 on the web) | `apps/web/src/lib/analytics/client.ts` (PostHog and GA4), `apps/mobile/lib/analytics.ts` (PostHog only) | Funnels, replay, the dashboard's PostHog connection                   |
| First-party                | `apps/web/src/lib/analytics/record.ts` → `analytics_events`                                             | Retention cohorts, admin segments, numbers that survive an ad blocker |
| Play Events API            | `apps/web/src/lib/plays/events.ts`                                                                      | The platform's email automation (welcome, win-back, trial expiry)     |

Each app has its own event registry, and `check:events` checks each app's call sites against its
own. `apps/web/src/lib/analytics/events.ts` is the web's: it types `gaEvent()`, and the
first-party whitelist (`TRACKED_EVENTS`) is built from it. The `EventName` union in
`apps/mobile/lib/analytics.ts` is the app's: it types `track()`, which goes to PostHog; the
app's first-party and Play Events moments are emitted by the web routes it calls.

## Conventions

- **Any count the admin panel and the Play Stats API both show** comes from
  `apps/web/src/lib/dashboard-stats.ts`. One definition of "paid user", in one place.
- **Brand colours live only in `packages/brand/`** (rebrand in `brand.config.ts`); both apps
  read them from there, the app through its ThemeProvider. Don't hardcode hex: a mobile test
  fails on any hex or `rgb()` literal in app code.
- **`analytics_events` and `analytics_pageviews` carry a nullable `user_id`**: guests are most
  of the top of the funnel. Never inner-join them to `profiles`; that silently drops every
  anonymous visitor.
- **`profiles` is the per-user table.** `is_admin`, `plan_type`, `premium_*` and `region` are
  server-controlled: only server code writes them, and `check:rls` fails if an API role could.
- **Data (web):** stores in `src/server/db/` (`profileStore`, `playStatsStore`,
  `analyticsStore`, `leadStore`, and `itemStore`, `taskStore`, `feedStore` behind
  `/api/app/v1`) over the one Prisma client in `src/server/db/client.ts`.
- **Supabase clients (web), auth only:** `src/lib/supabase/server.ts` (the person's session),
  `src/lib/supabase/secret-key.ts` (Auth's admin API, **server code only**),
  `src/lib/supabase/browser.ts` (sign in and out).
- **Guards:** admin pages sit under `admin/(protected)/`, whose layout checks the session and
  `profileStore.isAdmin` itself and redirects anyone else to `/admin/login`; admin API routes
  and server actions call `requireAdmin()`; the Play Stats API uses `requireDashboardKey()`;
  crons check the `CRON_SECRET` bearer.
- **Secrets** live in environment variables: `apps/web/.env.local` and `apps/mobile/.env.local`
  on your machine, Vercel and EAS environment variables for deployments. Never read, print or
  paste a real env file (any `.env*` but `.env.example`) or a key into a conversation, by any
  means: `.claude/settings.json` denies Claude Code's file-reading tools, not a shell `cat`
  ([docs/rules/secrets.md](docs/rules/secrets.md)).
- **Migrations** are Prisma's, in `apps/web/prisma/schema/migrations/`, written by CI from the
  schema ([docs/rules/migrations.md](docs/rules/migrations.md)). `supabase/migrations/` is
  frozen history.

## Project memory

Durable notes live in **`docs/memory/`**: the context that isn't derivable from the code or git
history. Build environments, release state, monetization decisions, launch history, known
traps.

**Start a session by reading `docs/memory/MEMORY.md`**, a one-line index. Read the notes
relevant to the task, not all of them. One fact per file, with frontmatter:

```markdown
---
name: <short-kebab-case-slug>
description: <one-line summary, used to decide relevance>
metadata:
  type: user | feedback | project | reference
---
```

Add a matching line to `MEMORY.md` after writing one. Update an existing note rather than
creating a near-duplicate; delete notes that turn out to be wrong. Convert relative dates to
absolute. Cross-reference with `[[note-name]]`.

## Standards

[`docs/STANDARDS.md`](docs/STANDARDS.md) (from template-web) is the checklist of what every
repo carries, and `npm run check:standards` (`scripts/check-standards.mjs`) proves each item is
wired, in CI on every pull request and in `local-review`. It checks the repo once and each
workspace in `standards.config.json` by its kind (`apps/web` as a Next.js app, `apps/mobile`
against the mobile standards). Any divergence from a standard is recorded, with its reason, in
`scripts/standards-exceptions.json`; an entry whose standard is met fails the run.

## Where this repo differs from template-web

- **npm workspaces, not pnpm.** Expo is well supported on npm workspaces; pnpm needs
  `node-linker=hoisted` and has a history of Metro resolution problems. Node 22, as in
  template-web.
- **A monorepo, so no root `src/`.** App-level standards (env schema, logger, data path) apply
  per workspace: `apps/web` is checked as a Next.js app, `apps/mobile` against the mobile
  standards. Don't create root `src/` files to satisfy a check.
- **A mobile app.** OTA updates, store review, the device-to-API data path, releases and
  privacy have rule files template-web doesn't need.
- **Next.js 15, not 16.** The session refresh is `src/middleware.ts` (template-web's `proxy.ts`).
- **Analytics is the platform's catalog** over three sinks, not template-web's generic
  PostHog taxonomy ([docs/rules/analytics.md](docs/rules/analytics.md)).
- **No AI usage tracking.** The template makes no AI call, so it carries no `ai_usage` table.
  A play that adds an AI call adopts template-web's AI usage rule and module whole.
- **No icon wrapper.** Each app imports its icon library directly; a play that wants
  template-web's wrapper adds it with its ESLint ban
  ([docs/rules/components.md](docs/rules/components.md)).
- **The website is English-only**; the app is localised with i18next.

## Per-tool entry points

This file is the source of truth. `CLAUDE.md` (Claude Code) imports it with a single
`@AGENTS.md` line and adds only Claude-specific notes. Codex, Amp, OpenCode and anything else
that reads `AGENTS.md` directly need nothing more. A tool that wants its own file
(`GEMINI.md`, `QWEN.md`, `.cursor/rules/project.mdc`) gets a thin one that imports this file.

Rules go here, never in those files. If you find yourself writing an engineering rule into a
per-tool file, it belongs in this one.
