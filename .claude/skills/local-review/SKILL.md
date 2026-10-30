---
name: local-review
description: 'Run the full local pre-push gate (the same commands CI runs: secrets, template, typecheck, lint, format, standards, events, env, store readiness, tests, web build, commit messages, and the database gates: drift, RLS, the runtime-role suites), the store-review skill when the app changed, and a manual review pass against this repo''s AGENTS.md and docs/rules. It is what makes the don''t-over-commit rule work, by catching problems before a paid CI run does. Use when the user says "/local-review", "review this before I push", "is this ready", or has finished a change and wants it validated locally before CI sees it.'
---

# Local review

A pre-push gate: the same checks CI runs, plus a manual pass against the rules CI can't fully
automate. Run it once a change is functionally done, not after every edit.

**This is what makes `docs/rules/commits.md`'s don't-over-commit rule work.** Every push runs
paid CI. This skill exists so CI _confirms_ what is already verified, instead of being the first
place a lint error, a type error or a broken build is discovered. If it is clean, commit once,
not once per fix.

## 1. Automated gates, in CI's order

These are exactly the commands the `check` job in `.github/workflows/ci.yml` runs on every pull
request, in the same order. A gate added to one is added to the other in the same PR, and
`check:standards` holds them to it: `local-review-mirrors-ci` reads both lists from the files,
and fails when this skill leaves out one of that job's gates, runs them in another order, or
runs a gate no CI job runs.

Stop at the first failure and fix it (or report it) before continuing. Don't run everything
blind and hand the user five unrelated failures. Report each command's real result, not "it
passed".

```bash
npm run check:secrets    # every tracked file, session logs included
npm run check:template   # the template tracks no session logs or worktrees; a play passes
npm run typecheck        # web, mobile, @app/contract and @app/brand
npm run lint             # 0 errors and 0 warnings (--max-warnings=0)
npm run format:check     # if this fails, run `npm run format`: always safe, never ask first
npm run check:standards  # the standards checklist (docs/STANDARDS.md)
npm run check:events     # every fired event is in its app's registry; unfired ones only warn
npm run check:env        # every env read is declared in the schema and .env.example, and vice versa
npm run check:store      # the store-review rules a file can decide (section 2 does the rest)
npm test                 # scripts, mobile Jest (+ packages/brand), the web and @app/contract suites
npm run web:build        # the Next.js production build
```

The build leaves `apps/web/.next/` behind; delete it afterwards if disk is tight.

Then the commit messages, the same check CI's `commits` job runs over the branch:

```bash
git fetch origin main
node scripts/check-commit-message.mjs --range origin/main..HEAD
```

Then the database gates, the ones CI's `migrations` job runs. They read a database with the
migrations applied, not the files, so they need a replay: a throwaway local Postgres, never a
shared or production one (Prisma needs a user name in the URL, or it fails with `P1010`):

```bash
createdb app_replay
psql -d app_replay -v ON_ERROR_STOP=1 -q -f apps/web/prisma/ci/supabase-shim.sql
export DATABASE_URL="postgresql://$USER@localhost:5432/app_replay" DIRECT_URL="postgresql://$USER@localhost:5432/app_replay"
npx prisma migrate deploy --schema apps/web/prisma/schema && npm run db:run-once
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel apps/web/prisma/schema --exit-code
npm run check:rls        # RLS on, no policies, nothing granted to anon or authenticated
TEST_DATABASE_URL="$DATABASE_URL" npm run test:db --workspace=@app/web   # as a non-superuser
dropdb app_replay
```

Without `DATABASE_URL`, `check:rls` fails rather than skips: a skipped RLS check is the same as
none. A schema change with no migration shows up in the drift check; CI generates the
migration (`docs/rules/migrations.md`), and `node scripts/generate-migration.mjs --check
--db-url "$DATABASE_URL"` shows what it will write.

## 2. Mobile: the store-review skill

If the diff touches `apps/mobile` or `packages/`, run the **`store-review`** skill
(`.claude/skills/store-review/SKILL.md`) on the branch. It classifies the change (an **OTA
update** or **needs a store build**, and why), runs `check:store`, applies the rule table in
`docs/rules/store-review.md` to the diff, and ends in one verdict: SHIP, FIX FIRST or NEEDS A
HUMAN. Put the classification and the verdict in the report.

## 3. Manual review pass

Diff the branch against its merge base (`git diff origin/main...HEAD`) and check the changed
files against `AGENTS.md` and the `docs/rules/` file for each area touched:

- **The three non-negotiables** (`AGENTS.md`):
  - a new screen, route, button, paywall step, toggle or state-changing cron has its events
    registered in its app's registry (`apps/web/src/lib/analytics/events.ts` on the web, the
    `EventName` union in `apps/mobile/lib/analytics.ts` on the app) and fired: a new name in
    `check:events`' "registered but not yet fired" warnings is a finding
    (`docs/rules/analytics.md`); the `events` skill should have run first;
  - a change under `apps/web/src/app/api/dashboard/v1/` was checked against the live contract
    from your stats dashboard, not from memory;
  - anything writing `plan_type`, `premium_*` or a subscription row does it in server code, and
    has been read twice.
- **Data** (`docs/rules/database.md`, `docs/rules/mobile-data.md`): no new Supabase
  `.from()`/`.rpc()` call site anywhere; queries live in a store under `src/server/db/`, and a
  `$queryRaw` says in a comment why Prisma can't express it; a failed query surfaces as an
  error, never an empty list; shared counts come from `dashboard-stats.ts`; nothing
  inner-joins `analytics_events` or `analytics_pageviews` to `profiles`; no `v1` response
  shape changed; a new table has its security migration.
- **Auth** (`docs/rules/auth.md`, `docs/rules/authorization.md`): identity from the verified
  session or bearer token, never from the request body; an admin page sits under
  `admin/(protected)/`, whose layout guards it; every admin API route and server action calls
  `requireAdmin()` itself; an unset secret closes the route (503), never opens it.
- **Secrets** (`docs/rules/secrets.md`): no value in `eas.json` or `app.json` (`app.json`
  holds `REPLACE_WITH_…` placeholders; `eas.json` profiles carry no `env`, since EAS expands no
  `$VAR` there and a profile value overrides the EAS variable); nothing secret named `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*`; no
  credential in a comment, a fixture or a session log.
- **Logging and errors** (`docs/rules/logging.md`, `docs/rules/error-handling.md`): no new
  `console.*` in application code; no raw error text reaching a person.
- **Migrations** (`docs/rules/migrations.md`): a schema change doesn't break a column the app
  or a `v1` route reads.
- **Brand** (`docs/rules/code-style.md`): no hardcoded hex that has a token in
  `packages/brand`.
- **Magic numbers** (`docs/rules/code-quality.md`): deliberately not an ESLint rule. A
  threshold, rate, timeout or limit whose meaning isn't obvious gets a named constant.
- **DRY, the Rule of Three**: logic that already exists in two other files is extracted before
  a third copy lands. Two occurrences are expected, not a violation.
- **God files**: a changed file that now mixes routing, data access, business logic and
  rendering.
- **Comments**: flag comments that restate the code; a missing one on a genuinely non-obvious
  invariant is also a finding.
- **Naming**: camelCase for TypeScript, PascalCase for components and types,
  `SCREAMING_SNAKE_CASE` only for true constants, snake_case for columns and event names.
- **Feature scope** (`docs/rules/feature-approach.md`): a brand-new feature shows the 80/20
  choice was offered; an adjustment to a live feature covers its edge cases.

## 4. Report

A short pass/fail summary: each gate and its real result, the OTA-or-build classification and
store-review verdict for a mobile change, and what the manual pass found (file:line for each
item), separating what blocks from what is worth flagging. Say what you fixed if you fixed
anything trivial (formatting, say). If something needs a judgement call (a new dependency, a
new global store, a `v1` change), ask rather than deciding.

If everything is clean and the branch is done, this is also the moment to write or finalize the
PR's real title and description, with the standards count before and after, the gates, and a
Production Watch List, and to mark it ready if it was a draft (`docs/rules/pull-requests.md`).
