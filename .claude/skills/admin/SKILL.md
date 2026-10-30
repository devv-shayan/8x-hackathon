---
name: admin
description: Add or change a screen in this play's admin panel — users, analytics, funnel, retention, grants, payments, support. Use for "add an admin page for X", "I need to see Y in the admin", "let me grant premium from the dashboard", "show me which users did Z", or when an operator needs to see or do something no screen currently covers.
---

# Admin

The admin panel is where the play is operated: who signed up, what they did, who paid, who to
comp. It ships in this template already wired — extend it, do not rebuild it.

## What is already there

```
apps/web/src/app/admin/login/page.tsx              # email + password, Supabase auth
apps/web/src/app/admin/(protected)/layout.tsx      # the page guard (session + is_admin) + nav shell
apps/web/src/app/admin/(protected)/page.tsx        # overview: users, paying, trial, new this week, waitlist, messages
apps/web/src/app/admin/(protected)/users/page.tsx  # the first 100 accounts: email, plan, region, admin, joined
apps/web/src/app/admin/(protected)/analytics/      # funnel, engagement, retention cohorts
apps/web/src/app/api/admin/users/route.ts          # every account, paged (?page=&perPage=): requireAdmin() first
apps/web/src/lib/require-admin.ts                  # requireAdmin(): API routes and server actions
apps/web/src/lib/dashboard-stats.ts                # the numbers behind the screens
apps/web/src/server/db/                            # the stores: every query, through Prisma
```

Access is `profiles.is_admin`, which is **server-controlled**: no API role can write it
(`check:rls` fails if one could), so nobody can promote themselves from the browser or the app.
Grant it in SQL.

## Adding a screen

1. **Put the query in a store under `src/server/db/`**, not in the page, and any number the
   Play Stats API also shows in `src/lib/dashboard-stats.ts`. The Play Stats API and the admin
   screens must agree on what "paid user" means — one definition, one place. A screen that
   counts paid users its own way will disagree with the dashboard and someone will spend an
   afternoon on it. A read that fails shows the error, never a 0.
2. **Page under `src/app/admin/(protected)/<name>/page.tsx`.** The layout already guards every
   page under it: it resolves the session with `getUser()`, checks `profileStore.isAdmin`, and
   redirects anyone else to `/admin/login`. It doesn't call `requireAdmin()`, which answers with
   a `NextResponse` a layout can't return. Do not re-implement the guard in the page, and do
   not put an admin screen outside that group where it would be unguarded.
3. **Server components read; mutations are server actions** in a sibling `actions.ts`, each one
   calling `requireAdmin()` first and refusing when it answers with a `response`. A server
   action is a public endpoint — the layout guard does not protect it. An admin API route
   (`src/app/api/admin/`) does the same and returns that `response`.
4. **Add it to the nav** in `(protected)/layout.tsx`.
5. Anything destructive (delete a user, revoke a grant) gets a confirm step. Operators
   misclick. The template ships no destructive admin action and no audit table: the first
   such action a play adds also adds one (a Prisma model with who acted, on which account, what
   changed and when), written in the same transaction as the change.

The users screen is deliberately small: one page of 100 from Supabase Auth, no search and no
paging on screen. A play that outgrows it pages with `searchParams` and the same
`listUsers({ page, perPage })` the API route uses, and searches through a store query under
`src/server/db/`, not by filtering a page in the component.

## Reading events in the admin

The first-party tables are the point of the admin analytics screens:

- `analytics_events` — one row per (visitor, event, day), deduped, with `metadata` for
  discriminators. Query by `name` and group by `date(created_at)`.
- `analytics_pageviews` — raw dwell deltas, summed for time-on-screen. Not deduped.

Both carry `user_id` **nullable** — guests are most of the top of funnel. A query that inner-joins
to `profiles` silently drops every anonymous visitor, which is how a marketing page ends up
reading as having no traffic.

## The rule that matters

An admin screen that shows a number the Play Stats API also reports must compute it the **same
way**, from `src/lib/dashboard-stats.ts`. When the two disagree, nobody knows which to trust and both
stop being used.
