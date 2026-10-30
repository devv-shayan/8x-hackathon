# Playmakers Learn

Learn from YouTube by teaching AI students who remember you. You watch a
video, explain it in your own words, then teach a short class — students
ask about what you missed, and every gap links back to what the video
actually said.

Temporary project name while the final brand is undecided (shortlist in
`docs/product/brief.md`). Built for the 8x Playmakers C2 hackathon.

## Stack

| Layer           | Choice                                                        | Note                                                                                                                               |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack, React Compiler) + React 19 | See `AGENTS.md` for the v13/14→16 breaking changes that matter                                                                     |
| Styling         | Tailwind CSS v4 (CSS-first, no `tailwind.config.js`)          | Tokens in `src/app/globals.css`, see `DESIGN.md`                                                                                   |
| Database        | Prisma 6                                                      | Schema-only workflow — CI generates and commits migrations, you never hand-write one                                               |
| Auth            | Supabase Auth                                                 | Wired and configured; MVP runs as a single local user with sign-in deferred. Auth/session only — Prisma owns application data      |
| AI              | Google Gemini (free-tier)                                     | Calls go through `src/server/ai/gemini.ts` and are cost-tracked in `ai_usage`. Models: `gemini-3.5-flash`, `gemini-3.5-flash-lite` |
| Server state    | TanStack Query                                                | `QueryClient` created inside `useState`, never module scope                                                                        |
| i18n            | next-intl                                                     | Component-scoped translation files                                                                                                 |
| Observability   | Sentry + PostHog                                              | Both no-op gracefully until real keys are set                                                                                      |
| Testing         | `node --test` (unit) + Playwright (e2e)                       |                                                                                                                                    |
| Package manager | pnpm                                                          | Version pinned in `package.json`                                                                                                   |

## Project structure

```
playmakers-learn/
├── .claude/skills/          Claude Code skills — see "Skills" below
├── .claude-logs/            tracked (not gitignored) — AI session transcripts ship with the branch
├── .github/workflows/       ci.yml, deploy-migrations.yml, claude-code-review.yml
├── .githooks/commit-msg     installed automatically by `pnpm install`
├── docs/
│   ├── product/brief.md      product brief for the learning loop
│   ├── rules/                one file per engineering rule
│   ├── STANDARDS.md
│   └── CI_CD_SETUP.md
├── e2e/smoke.spec.ts        Playwright — delete once real coverage exists
├── messages/en.json         i18n strings
├── prisma/schema/            multi-file schema — the only thing you hand-edit
│   └── migrations/           CI-generated only, never by hand
├── prisma/run-once.sql       one-off SQL, applied once per database on the next deploy
├── scripts/
├── src/
│   ├── app/[locale]/         App Router pages
│   ├── components/
│   ├── i18n/
│   ├── lib/                  env, seo, supabase/, errors/, …
│   ├── server/               db/client.ts, ai/gemini.ts, api/
│   └── proxy.ts               Supabase session refresh + next-intl locale routing
├── AGENTS.md
├── CLAUDE.md
├── DESIGN.md
└── .env.example
```

## Setup

```bash
pnpm install                       # also installs the commit-msg git hook + generates the Prisma client
cp .env.example .env               # fill in DATABASE_URL/DIRECT_URL + Supabase + GEMINI_API_KEY
pnpm prisma:migrate:deploy         # apply existing migrations
pnpm dev
```

Use a single gitignored `.env` for local work — Next.js and Prisma both load
it. Prefer `pnpm prisma:migrate:deploy` when migrations already exist; use
`pnpm prisma:migrate:dev` only when you intentionally want Prisma to create a
new migration (this repo normally lets CI generate those — see
`docs/rules/migrations.md`).

Open http://localhost:3000 — English is served unprefixed, and `/en`
redirects back to `/`.

## Environment variables

Every variable the app reads is documented inline in `.env.example` and
validated at boot by `src/lib/env.ts`. Groups: database (Prisma), Supabase
Auth, Google Gemini, Sentry, PostHog, Slack alerting, i18n, cron secret, app
URL. `pnpm check:env` fails if any `process.env.X` in `src/` is missing from
either `.env.example` or the schema. See `docs/CI_CD_SETUP.md` for which of
these are Vercel-side vs. GitHub Actions-only secrets.

## Database & migrations

Prisma schema (`prisma/schema/*.prisma`, one file per domain area) is the
only thing you hand-edit. **CI writes the migration, you write the
schema** — never touch a file under `prisma/schema/migrations/` yourself.
Full workflow: `docs/rules/migrations.md`.

## Auth

Supabase Auth is wired (`src/proxy.ts`, `src/lib/supabase/*`) with this
project's URL and keys in `.env`. The MVP does not require sign-in yet
(one local user); auth flows come later. Application data still goes
through Prisma, never `supabase.from()`.

## Testing

```bash
pnpm test        # node --test over scripts/*.test.mjs — fast, no browser
pnpm test:e2e     # Playwright — boots the app itself unless E2E_BASE_URL is set
```

## Skills

| Skill                                                                      | Run it                                                   | What it does                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `template-setup`                                                           | Once, right after creating a new repo from this template | Renames placeholders, asks internal/external and accounts/landing-page questions |
| `dev-onboarding`                                                           | Once per developer                                       | Install, env vars, migrations, boot the dev server                               |
| `local-review`                                                             | Before every push                                        | Full local gate (lint/typecheck/format/env/test/build) plus a rules pass         |
| `e2e-review`                                                               | Before opening a PR for a UI/flow change                 | Boots the app, runs Playwright, reviews failures against their trace/screenshot  |
| `ai-usage-setup` / `ai-usage-check`                                        | When AI providers or models change                       | Wire or verify spend tracking                                                    |
| `staging-migration`, `sql-preview`, `seed-for-pr`, `local-feature-testing` | Day-to-day dev loop                                      | See each `SKILL.md`                                                              |

## Rules live in AGENTS.md, not CLAUDE.md

`AGENTS.md` indexes `docs/rules/*.md`. `CLAUDE.md` is thin on purpose.
`DESIGN.md` has design-token/component conventions.

## Don't over-commit

Every push triggers a real, paid CI run. Run `local-review` locally first,
then commit once the work is done. Full rule: `docs/rules/commits.md`.

## Deployment

Never run a manual production deploy command — CI/CD handles it (see
`docs/rules/deployment.md`). Before the first real PR, read
`docs/CI_CD_SETUP.md` and set up GitHub (`MIGRATIONS_TOKEN`,
`production-database` environment) and Vercel.

## Before you start replacing things

1. Delete `prisma/schema/example.prisma` once real models exist, and
   `e2e/smoke.spec.ts` once real e2e coverage exists.
2. Set `DATABASE_URL` / `DIRECT_URL` to a real Postgres (Supabase Database
   connection strings work) before the first migration.
3. Add `GEMINI_API_KEY` from Google AI Studio before any AI feature work.
4. Set up GitHub and Vercel per the Deployment section before merging the
   first PR.
5. Revisit open decisions in `docs/product/brief.md` (final name, one vs
   two students, longest video accepted).

## Scripts

| Command                                    | What it does                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`             | Standard Next.js                                                                         |
| `pnpm lint` / `typecheck` / `format:check` | CI gates, run before pushing                                                             |
| `pnpm test`                                | `node --test` over `scripts/*.test.mjs`                                                  |
| `pnpm test:e2e`                            | Playwright — boots the app itself unless `E2E_BASE_URL` is set                           |
| `pnpm check:env`                           | Fails if a `process.env.X` in `src/` isn't declared in `.env.example` + `src/lib/env.ts` |
| `pnpm check:standards`                     | Fails if a standard in `docs/STANDARDS.md` is unwired                                    |
| `pnpm check:rls`                           | Every table has RLS enabled, no policies, never forced                                   |
| `pnpm check:ai-models`                     | Every mapped model slug still prices on OpenRouter                                       |
| `pnpm prisma:generate`                     | Regenerate the Prisma client after a schema change                                       |
| `pnpm prisma:migrate:generate:check`       | Dry-run what CI's migration generator would write                                        |
| `pnpm db:run-once`                         | Apply `prisma/run-once.sql` once                                                         |

## License

MIT, see [`LICENSE`](LICENSE).
