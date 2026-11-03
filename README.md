# Chalkback

**Don't just watch it. Teach it back.** Paste a YouTube video you watched, explain it in your own
words, and two AI students, Maya and Omar, ask about what you missed. Every idea you miss comes
back days later as a warm-up, until you've got it right twice.

- The app: <https://chalkback-app.vercel.app> · the website: <https://chalkback.vercel.app>
- Built by Shayan Khan and Sayed Arif for 8x Playmakers, Cohort 2
- The product brief: [docs/product/brief.md](docs/product/brief.md) · how the code fits
  together: [docs/product/context.md](docs/product/context.md)

The sketches below are drawn in the style of
[Ian Xiaohei Illustrations](https://github.com/helloianneo/ian-xiaohei-illustrations) (MIT).
Xiaohei, the small black creature, does the work each one is about. All six, with where each
lives in the code: [docs/architecture/sketches/](docs/architecture/sketches/README.md).

## How it works

![The learning loop: a video becomes an explanation and a class; missed ideas drop into the gap drawer and come back as warm-ups](docs/architecture/sketches/03-learning-loop.svg)

1. **Paste a YouTube link.** The server reads the transcript and pulls out the video's key ideas,
   each with its moment in the video (Gemini, with captions from Supadata or yt-dlp). The ideas
   stay hidden: the point is to see what you remember. A video that can't be read can be pasted
   as text instead.
2. **Explain it in your own words**, typed or out loud. The explanation is scored against the
   ideas.
3. **Teach the class.** Maya never saw the video and asks about what you left out; Omar watched it
   twice and asks about what you got wrong. A student asks only once you call on them. Stuck?
   "I'll be back" opens private help: what the video says, and the moment to rewatch.
4. **See what stuck.** The results show which ideas you taught, which you fixed in class, and
   when each missed one comes back.
5. **Warm-ups bring the gaps back.** Each missed idea becomes a gap. A student asks about it again
   2 days later; a right answer pushes it 5 days out, and two right in a row closes it. Each
   video's page shows its gaps and how every warm-up went.

## Voice

![Voice: what you say goes to Whisper and comes back as text you can fix; the students' questions come back as Orpheus voices](docs/architecture/sketches/05-voice.svg)

The students say their questions out loud (Groq Orpheus), and you can explain and answer out
loud (Groq Whisper). Hold to answer, check what you said, then send it. On the web, an
explanation is written down as you speak; on a phone, when you tap stop. Typing is always one tap
away, and audio is never stored. The free tier allows 100 student voices a day; after that the
device's own voice reads the question. More: [docs/memory/groq-voice.md](docs/memory/groq-voice.md).

## How it's built

![System map: the Expo app reaches everything through one door, /api/app/v1](docs/architecture/sketches/01-system-map.svg)

- **`apps/mobile`:** the Expo app (SDK 55). It runs as a web build on Vercel, in Expo Go, and in
  store builds. It never touches tables: everything goes through the API.
- **`apps/web`:** Next.js 15 on Vercel. The website, the admin panel, and the app's API at
  `/api/app/v1`. Prisma writes to Postgres on Supabase; Supabase Auth only signs people in. AI
  calls happen on the server only.
- **`packages/contract`:** the Zod schema of every API route, shared by both apps.
- **`packages/pixel`:** the dithered pixel backgrounds and students, drawn by the same code on the
  website and in the app.
- **`packages/brand`:** the colours, type and spacing both apps use.

Every route runs the same four checks, so none can skip one:

![One request: the four checks every route runs](docs/architecture/sketches/02-one-request.svg)

The class is where the slow AI calls are. An answer is saved first; then the next question and a
recheck of the other student's waiting question run at once. If the app gives up waiting, it
reads the class back instead of retrying:

![A class turn: saved first, two Gemini calls at once, and the catch-up after a timeout](docs/architecture/sketches/04-class-turn.svg)

## Running it locally

Follow the template's [quickstart](#quickstart) below, then, in `apps/web/.env.local`:

- `GEMINI_API_KEY`: reads videos, scores explanations and writes the students' questions.
- `GROQ_API_KEY`: voice. Accept Orpheus's terms once in the Groq console, or every voice fails.
- Install [yt-dlp](https://github.com/yt-dlp/yt-dlp) or [uv](https://docs.astral.sh/uv/) for
  captions. Without either, every video goes through Gemini, which is slower and limited to 30
  minutes.

To try a warm-up before one is due: `npm run db:seed-due-gap -- <your user id>`. To run the app on
a real phone: [docs/memory/phone-dev-setup.md](docs/memory/phone-dev-setup.md).

## Shipping

![Shipping: a branch goes through the local gates and CI to main; for phones, an update or a store build](docs/architecture/sketches/06-shipping.svg)

Work on a branch, run the local gates, open a pull request, and merge only when CI is green;
nobody pushes to `main`. Vercel deploys `main`. For phones, a JavaScript-only change ships as an
update; a native change (a new module, a permission, the icon) needs a store build. The rules
are in [AGENTS.md](AGENTS.md).

---

# App Template — Expo + Next.js monorepo

The starting point for a new play. One repo, one brand, one backend — an **Expo
mobile app**, a **Next.js marketing site + admin panel + API**, and a **Supabase**
project for sign-in and Postgres, wired together so you can go from brief to a
shipping build fast.

> Clone this, rename it for your play ([below](#renaming-for-your-play)), and build only
> what's net-new. (See the Play Engineer playbook: _start from the template, cut to the core
> flow_.)

**Working in this repo, as a person or an agent:** read [`AGENTS.md`](AGENTS.md) first. It
holds the three non-negotiables, how a mobile change ships (OTA first, store review before
every release), and the index of engineering rules in [`docs/rules/`](docs/rules/).
[`docs/STANDARDS.md`](docs/STANDARDS.md) is the checklist every repo from this template is held to.

## What's in the box

| Workspace       | Path                 | What it is                                                                                                                                                                                       |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@app/mobile`   | `apps/mobile/`       | Expo / React Native app — **the product**. Email-code, Apple and Google sign-in, RevenueCat subscriptions, Sentry, PostHog, i18n, NativeWind and OTA updates, all pre-wired.                     |
| `@app/web`      | `apps/web/`          | Next.js 15 marketing site (landing, pricing, legal, support, account deletion), **admin panel**, the app's API (`/api/app/v1`), webhooks, the daily lifecycle cron, and the **Play Stats API**.  |
| `@app/contract` | `packages/contract/` | The Zod schemas for every `/api/app/v1` route: the web validates with them, and the app parses every response with them.                                                                         |
| `@app/brand`    | `packages/brand/`    | The single brand source: two presets (`dusk`, `daylight`), one accent, role-typed palettes, type, radii, elevation, motion. Web reads CSS variables + a Tailwind preset; mobile a ThemeProvider. |
| `@app/pixel`    | `packages/pixel/`    | Chalkback's dithered pixel engine: the moving backgrounds, the students, the app icon. Pure TypeScript, drawn by the website on a canvas and by the app in a canvas or WebView.                  |

Plus:

- **`supabase/`** — the local Supabase stack: `config.toml` (ports, auth, the avatar bucket)
  and `seed.sql`. Its `migrations/` are frozen history; the schema is Prisma's, in
  `apps/web/prisma/schema/`.
- **`docs/`** — [`ENV_SETUP.md`](docs/ENV_SETUP.md) (every variable),
  [`LAUNCH_TODO.md`](docs/LAUNCH_TODO.md) (the launch checklist),
  [`UPGRADING.md`](docs/UPGRADING.md) (porting a template change into a live play),
  [`EVENTS.md`](docs/EVENTS.md), [`PLAY_API.md`](docs/PLAY_API.md), the rules in
  [`docs/rules/`](docs/rules/), and project memory in [`docs/memory/`](docs/memory/MEMORY.md).
- **`.claude/`** — [`settings.json`](.claude/settings.json): a deny list that keeps Claude's
  Read tool off real env files, a `SessionStart` hook ([`session-brief.py`](.claude/session-brief.py))
  that puts the play's standing rules into every session, and a `SessionEnd` hook
  ([`log-session.py`](.claude/log-session.py)) that writes the build log. The repo's skills live
  in [`.claude/skills/`](.claude/skills/): `events`, `play-api`, `admin`, `spec`, `ship`,
  `local-review` and `store-review`.
- **`.githooks/`** — `pre-commit` scans staged files for secrets and `commit-msg` checks
  Conventional Commits. `npm install` switches them on (`core.hooksPath`).
- **`scripts/`** — the gate scripts behind every `check:*` script in the root `package.json`.

## Architecture

```
 apps/mobile (Expo) ──sign-in only──────────────────────▶ Supabase Auth
        │
        └──HTTPS──▶ apps/web  /api/*  (Next.js routes, Vercel) ──Prisma──▶ Supabase Postgres
                         ├─ /api/app/v1/*           the app's data (schemas in @app/contract)
                         ├─ /api/waitlist · /api/contact · /api/delete-account
                         ├─ /api/track · /api/lifecycle/session   first-party events
                         ├─ /api/webhooks/revenuecat              → profiles.plan_type
                         ├─ /api/cron/lifecycle                   daily (vercel.json)
                         └─ /api/dashboard/v1/{summary,users}     → your stats dashboard (Bearer key)
```

The app uses Supabase for sign-in only; every byte of data goes through the web app's API.
All server logic lives in Next.js API routes co-deployed with the site on Vercel, reading and
writing through Prisma (`apps/web/prisma/schema/`); RLS is on everywhere as a locked door
([`docs/rules/database.md`](docs/rules/database.md)).

## Quickstart

You need Node 22 (22.18 or a later 22.x: `apps/web` allows `>=22.18.0 <23`), Docker, and the
[Supabase CLI](https://supabase.com/docs/guides/cli/getting-started).

```bash
nvm use                # Node 22 (.nvmrc)
npm install            # every workspace at once; also switches on the git hooks

# 1. The env files, before anything reads them
cp apps/web/.env.example    apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local

# 2. The local Supabase stack
supabase start         # prints the local URLs and keys; `supabase status` prints them again
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres
export DIRECT_URL=$DATABASE_URL
npm run db:reset       # resets the stack's database, then applies the Prisma migrations
```

Keep the two `export` lines separate: on one line, `$DATABASE_URL` expands before the first
assignment runs, `DIRECT_URL` ends up empty, and Prisma stops with `P1012`.

**3. Fill in the local values.** Everything else in both files can stay empty: each feature
reports itself not configured instead of failing.

| File                     | Variable                               | Local value                                                       |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------------- |
| `apps/web/.env.local`    | `NEXT_PUBLIC_SUPABASE_URL`             | `http://127.0.0.1:55321`                                          |
|                          | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key (`sb_publishable_…`) from `supabase status`   |
|                          | `SUPABASE_SECRET_KEY`                  | the secret key (`sb_secret_…`) from `supabase status`             |
|                          | `DATABASE_URL`, `DIRECT_URL`           | `postgresql://postgres:postgres@127.0.0.1:55322/postgres`         |
| `apps/mobile/.env.local` | `EXPO_PUBLIC_SUPABASE_URL`             | `http://127.0.0.1:55321`                                          |
|                          | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the same publishable key                                          |
|                          | `EXPO_PUBLIC_SITE_URL`                 | `http://127.0.0.1:3000` (the web app, which serves the app's API) |

`127.0.0.1` reaches your computer from the iOS Simulator only. On an Android emulator use
`10.0.2.2`, and on a real phone your computer's LAN address, in both mobile URLs.

```bash
# 4. Run the apps
npm run web:dev        # http://localhost:3000
npm run mobile:start   # Expo dev server
```

The template expects a development build (`expo-dev-client`): build it once, and again after
any native change, with `npx expo run:ios` or `npx expo run:android` from `apps/mobile`
([`apps/mobile/README.md`](apps/mobile/README.md#step-7--run-the-app)). Chalkback also runs in
Expo Go, since every native module it uses is in Expo Go
([phone setup](docs/memory/phone-dev-setup.md)).

**Signing in locally.** The stack sends no real email. The six-digit code the app asks for
lands in the local mail catcher at <http://127.0.0.1:55324>; Studio is at
<http://127.0.0.1:55323>. Both ports are in [`supabase/config.toml`](supabase/config.toml)
(`[local_smtp]`, `[studio]`). Apple and Google sign-in are off locally; the hosted setup is in
[`docs/LAUNCH_TODO.md`](docs/LAUNCH_TODO.md#sign-in).

[`docs/ENV_SETUP.md`](docs/ENV_SETUP.md) says what every variable is, where the hosted value
comes from, and how to make yourself an admin.

## Renaming for your play

Every item here ships in the template with a placeholder. The launch checklist,
[`docs/LAUNCH_TODO.md`](docs/LAUNCH_TODO.md), repeats them as boxes to tick.

1. **Root `package.json` → `name`** (and `description`). Claude session logging is already on
   in your copy ([below](#claude-build-logs-set-up-for-you)); only the template's own repo keeps
   no logs.
2. **The npm scope `@app/`** → your own, everywhere it appears: `package.json` files, imports,
   `apps/web/next.config.mjs` (`transpilePackages`), the root scripts, `ci.yml`
   (`--workspace=@app/web`), docs and skills. From the repository root:

   ```bash
   git grep -l '@app/' -- ':!apps/web/prisma/schema/migrations' \
     | xargs perl -pi -e 's#\@app/#\@yourplay/#g'
   rm -rf node_modules/@app   # so nothing the rename missed still resolves
   npm install                # links the workspaces under the new scope, rewrites package-lock.json
   npm run typecheck
   ```

   The committed migrations are left alone: nobody edits one by hand
   ([`docs/rules/migrations.md`](docs/rules/migrations.md)), and the scope there is only a
   comment.

3. **Brand** — [`packages/brand/brand.config.ts`](packages/brand/brand.config.ts): `preset`,
   `accent`, `appName`, `siteName`. No other file holds a colour; both apps follow.
4. **`apps/mobile/app.json`** — `name`, `slug`, `scheme` (and the same scheme in
   `android.intentFilters`), `ios.bundleIdentifier`, `android.package`, `owner` (your Expo
   account or organization), the Sentry plugin's `organization` and `project`, the splash,
   adaptive-icon and status-bar background (each preset's value is in `brand.config.ts`), and
   the `expo-image-picker` purpose strings. `app.json` ships without `extra.eas.projectId`:
   `eas init` writes it, then `eas update:configure` rewrites `updates.url` to match, in that
   order ([launch checklist](docs/LAUNCH_TODO.md#mobile-on-eas)). It claims no web domain
   either: universal links are an optional step
   ([launch checklist](docs/LAUNCH_TODO.md#optional-universal-links)).
5. **`apps/mobile/lib/constants.ts`** — `APP_SCHEME` must equal `app.json`'s `scheme`: it
   builds the sign-in redirect `<scheme>://auth/callback`. Also `APP_SUPPORT_EMAIL`,
   `APP_DOCS_URL`, `APP_TAGLINE`, `APP_DESCRIPTION`.
6. **`apps/mobile/assets/`** — `icon.png` (1024×1024: the app icon, the Android adaptive-icon
   foreground and the web favicon, per `app.json`) and `splash-icon.png`.
7. **Web contact addresses** — `SUPPORT_EMAIL` in `apps/web/src/app/support/page.tsx`, the
   `privacy@` address in `apps/web/src/app/privacy/page.tsx`, `legal@` in
   `apps/web/src/app/terms/page.tsx`, and `hello@` in `apps/web/src/components/Footer.tsx`.
   `git grep -n '@example.com' -- apps` lists them, with sample and test values that stay.
8. **Web launch state and prices** — `apps/web/src/lib/stores.ts`: the store URLs, empty
   until the apps are live (empty shows the waitlist, set shows the store buttons);
   `apps/web/src/lib/pricing.ts`: the real prices, then delete `isPricePlaceholder`.
9. **Web domain and metadata** — the `www` → apex redirect in `apps/web/next.config.mjs`, the
   title and description in `apps/web/src/app/layout.tsx`, and `NEXT_PUBLIC_SITE_URL` on
   Vercel (metadata, sitemap and robots fall back to `https://example.com` without it).
10. **Copy** — every `🎨 BRAND` / `🎨 REPLACE` / `🔑` marker: `git grep -nE '🎨|🔑|🏷️' -- apps packages`.
    That includes both apps' privacy policy and terms, the paywall's `PRO_FEATURES`, and the
    RevenueCat entitlement id in `apps/mobile/lib/purchases.ts`. The markers in
    `apps/web/src/lib/stores.ts` stay until a listing is live (step 8).

## Claude build logs (set up for you)

In a play, every Claude Code session is logged to markdown **automatically**.
The `SessionEnd` hook in [`.claude/settings.json`](.claude/settings.json) runs
[`.claude/log-session.py`](.claude/log-session.py), which writes a timestamped
markdown log into [`.claude-logs/`](.claude-logs/): every prompt and every reply, verbatim,
under a header of session stats. A `SessionStart` hook,
[`.claude/session-brief.py`](.claude/session-brief.py), opens every session with the
play's standing rules.

**The template repository itself keeps no logs.** In the template's own repo
(package `app-template`, origin `8xsocial/template-monorepo`) the logger writes
nothing and says why, and CI (`npm run check:template`) fails if a log or an
agent worktree is committed there. Any copy logs from its first session.

In a play, you do two things:

1. **Approve the hooks once** — Claude Code asks you to trust them the first time.
2. **Keep `.claude-logs/` committed and push it** so teammates can trace the build.

The same settings file denies Claude's Read tool on real env files (`.env`, `.env.local`,
`.env.*.local`, `.env.production` and the rest), so secrets don't reach the chat by accident.
It does not sandbox a shell command, so never ask an agent to print one. Author attribution
comes from your `git config user.name` automatically. Backfill older sessions with
`npm run logs:backfill`.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request and every
push to `main`, in three jobs:

- **`commits`** (pull requests only) — every commit message on the branch is a Conventional
  Commit.
- **`check`** — `check:secrets`, `check:template`, `typecheck` (web, mobile, contract, brand),
  `lint`, `format:check`, `check:standards`, `check:events`, `check:env`, `check:store`,
  `npm test` (the script tests, mobile Jest, the web suites and the contract tests) and
  `web:build`.
- **`migrations`** — replays every Prisma migration onto an empty Postgres 17 behind a
  stand-in for Supabase (`apps/web/prisma/ci/supabase-shim.sql`), generates and commits a
  missing migration on a same-repository PR, applies the run-once SQL, then fails on drift
  between the schema and the migrations, on RLS or grants (`check:rls`), and on the database
  suites (`test:db`) run as a non-superuser role, as production runs.

The [`local-review`](.claude/skills/local-review/SKILL.md) skill runs the same commands
before you push.

[`.github/workflows/claude-code-review.yml`](.github/workflows/claude-code-review.yml)
adds an AI review to every PR that is ready for review, once the repository (or
its organization) has a `CLAUDE_CODE_OAUTH_TOKEN` secret. Without the secret it
passes and does nothing.

## Deploy

- **Web** → Vercel. Root directory `apps/web`, framework Next.js, and the env vars from
  `apps/web/.env.example`. A Vercel production build fails without a valid `DATABASE_URL` and
  `REVENUECAT_WEBHOOK_SECRET` ([`docs/ENV_SETUP.md`](docs/ENV_SETUP.md)).
- **Mobile** → EAS. Build profiles are in `apps/mobile/eas.json`, but the
  values go in **EAS environment variables**, never in `eas.json`
  ([`docs/rules/secrets.md`](docs/rules/secrets.md)). Most changes ship as OTA
  updates ([`docs/rules/ota.md`](docs/rules/ota.md)); store builds follow
  [`docs/rules/mobile-releases.md`](docs/rules/mobile-releases.md).
- **Database** → [`.github/workflows/deploy-migrations.yml`](.github/workflows/deploy-migrations.yml)
  applies the Prisma migrations from `main`, once the `production-database` environment and the
  `PRISMA_BASELINE_RESOLVED` variable are set
  ([`docs/rules/migrations.md`](docs/rules/migrations.md)). Point RevenueCat's
  webhook at the web route (`/api/webhooks/revenuecat`).

[`docs/LAUNCH_TODO.md`](docs/LAUNCH_TODO.md) is the whole path, in order. A play that is
already live reads [`docs/UPGRADING.md`](docs/UPGRADING.md) before it ports a template change:
some need a value set in production first, or the next deploy fails.

## Repo layout

```
app-template/               # your play's name, once renamed
├── apps/
│   ├── mobile/             # Expo app (@app/mobile)
│   └── web/                # Next.js site + admin + /api (@app/web)
├── packages/
│   ├── brand/              # Shared brand tokens (@app/brand)
│   ├── contract/           # /api/app/v1 schemas (@app/contract)
│   └── pixel/              # The pixel backgrounds and students (@app/pixel)
├── supabase/               # config.toml, seed.sql, frozen migrations/
├── docs/                   # product/, architecture/sketches/, ENV_SETUP, LAUNCH_TODO, EVENTS, rules/, memory/
├── scripts/                # the check:* gates
├── .claude/                # settings (env deny list + hooks), session-brief.py, log-session.py, skills/
├── .claude-logs/           # Auto-written session logs (committed, in a play)
├── .githooks/              # pre-commit (secrets) + commit-msg (Conventional Commits)
└── .github/workflows/      # CI, database deploy, AI review
```

## License

MIT, see [`LICENSE`](LICENSE).
