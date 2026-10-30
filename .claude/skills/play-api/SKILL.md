---
name: play-api
description: Implement, extend or debug this play's reporting to the stats dashboard — the Play Stats API at /api/dashboard/v1/summary and /users. Use when asked "connect this play to the dashboard", "why is our revenue/retention/market data blank", "what are we not sending", "the dashboard shows the wrong number of paid users", "add per-country revenue", "set up DASHBOARD_API_KEY", or before launch when the play must start reporting. Also use when the contract version has moved and this repo is on an older copy.
---

# Play Stats API

This play reports its own numbers to the stats dashboard. Nothing else can: analytics providers
count visitors by their own definition (one play showed ~25k GA4 users against ~9.6k real
accounts), and a shared billing account cannot be scoped to one product. What this repo serves
is the authoritative answer.

## Never implement this from memory, including from this file

The contract moves. Ask the dashboard for the current version **first**, every time:

```
"get the latest play API docs for a mobile app play"      # apps/mobile + apps/web here
"get the latest play API docs for a website play"          # web-only play
"we implemented the spec on <date>. what changed since?"   # incremental — much shorter
"run integration_check on <play-slug>"                     # what THIS play is missing, live
```

That is your stats dashboard's MCP server, if it has one (add it to `.mcp.json`). `integration_check` calls this
play's live endpoint, so a field you added minutes ago counts without waiting for a sync. It
reports the exact field paths that are absent and the fix for each. Start there, then use
`integration_docs` for the contract behind whatever it named.

## Where it lives in this repo

```
apps/web/src/app/api/dashboard/v1/summary/route.ts   # the counts
apps/web/src/app/api/dashboard/v1/users/route.ts     # the roster, paginated
apps/web/src/lib/dashboard-api-auth.ts               # Bearer key, constant-time compare
apps/web/src/lib/dashboard-stats.ts                  # the queries, shared by both routes
docs/PLAY_API.md                                     # what this play currently sends
```

Auth: `DASHBOARD_API_KEY`, a long random secret (`openssl rand -hex 32`) set on this play's
deployment and pasted into the dashboard, which stores it encrypted. Wrong key → 401. Env var
absent → 503, so a deploy without the secret exposes nothing rather than everything.

## The four traps

These are not hypothetical. Each one shipped in a real play and looked correct on screen.

**1. The partial scan.** Supabase's Data API caps an unbounded `select` at 1000 rows. Two plays
shipped `users_by_country` that way and reported 4% and 9% country coverage against real
figures near 82% and 87%. A split that thin reads as "this play cannot answer per-market". The
reads here go through Prisma (`src/server/db/play-stats.ts`), which has no cap: every scan
reads every row, and a `take` only ever walks a set in batches to its end. Keep it that way, and
if a scan cannot finish, **omit the field rather than send a partial one**. The roster's
timestamps are rendered by Postgres as PostgREST rendered them
(`src/server/db/postgrest-time.ts`): a `v1` response keeps its bytes.

**2. Splits are partitions, never additions.** Every `*_by_country`, `by_kind` and `by_country`
bucket set must sum to **at most** the total beside it. Covering less is fine and shows as
unattributed. Covering more is the play contradicting itself, and the dashboard drops the whole
split silently — indistinguishable from never having sent it.

**3. Sandbox purchases look exactly like real ones.** They fire the same RevenueCat lifecycle
events. Deciding `paid` from event types counts every TestFlight tester as a customer. The only
reliable signal is the webhook's `environment` field, captured when it fires and stored on the
profile. The reserved non-paying buckets are `free`, `granted`, `promo`, `sandbox`, `test`,
`trial`; every other key in `users_by_plan` counts as paid.

**4. A billing issue outranks the period type.** When a trial's conversion charge fails,
RevenueCat keeps `period_type: trial` and extends `expires_date` through payment recovery — so
period-type-first logic reports a failed conversion as a healthy month-long trial. Map
`billing_issues_detected_at` / `grace_period_expires_date` (or Stripe's `past_due` / `unpaid`)
**before** looking at the period type.

## Rules that apply to every field

- Send **counts and amounts, never percentages or rates.** The dashboard divides, because only
  it knows which cohorts are mature and which denominators are comparable.
- An unanswerable field is **omitted**, never zeroed or sent partial. A partial split is
  indistinguishable from a real answer.
- Country codes are ISO 3166-1 alpha-2. Anything else folds into the remainder.
- `retention.cohorts` counts activity on **exactly** day N, not "within N days" — a rolling
  definition reads considerably higher and is not comparable to the benchmarks. Send your whole
  history on the first sync; the dashboard keeps rows older than its 60-day window permanently.
- **A mobile play on RevenueCat omits `revenue` entirely.** The dashboard ranks the play's own
  copy below a direct billing connection, so sending it is work that changes nothing.

## After any change

```bash
curl -s -H "Authorization: Bearer $DASHBOARD_API_KEY" localhost:3000/api/dashboard/v1/summary | jq
```

Check by eye that every split is ≤ its total, then confirm from the other side:

```
"run integration_check on <play-slug>"
```

Update `docs/PLAY_API.md` with what this play now sends and the date, so the next session can
ask the MCP for only what changed since.
