# Play Stats API — what this play sends

**Contract implemented: 2026-08-14 · shape: mobile app play**

Keep the date above current. It is what lets the next session ask the dashboard
for _only_ what changed rather than re-reading the whole spec:

```
"we implemented the spec on 2026-08-14. what changed since?"
"run integration_check on <play-slug>"
```

## Endpoints

| Route                           | Purpose               |
| ------------------------------- | --------------------- |
| `GET /api/dashboard/v1/summary` | Headline counts       |
| `GET /api/dashboard/v1/users`   | The roster, paginated |

Auth on both: `Authorization: Bearer <DASHBOARD_API_KEY>`. Generate with
`openssl rand -hex 32`, set it on this play's deployment, and paste the same value into
the dashboard's connection (it is stored AES-256 encrypted). Wrong key → 401. Env var
absent → 503, so a deploy without the secret exposes nothing rather than everything.

## /summary — fields sent

| Field                            | Status         | Source                                        |
| -------------------------------- | -------------- | --------------------------------------------- |
| `users_total`                    | always         | full scan of `profiles`, every row            |
| `users_by_plan`                  | always         | `bucketFor()` in `src/lib/dashboard-stats.ts` |
| `new_users_7d` / `new_users_30d` | always         | `profiles.created_at`                         |
| `generated_at`                   | always         | request time                                  |
| `users_by_country`               | when non-empty | `profiles.region`                             |
| `paid_users_by_country`          | when non-empty | same, with the paid predicate                 |
| `trial_users_by_country`         | when non-empty | same, with `premium_status = 'trialing'`      |
| `retention.cohorts`              | when non-empty | `analytics_events` vs `profiles.created_at`   |
| `revenue`                        | **never**      | RevenueCat connects to the dashboard directly |

`revenue` is deliberately absent. The dashboard ranks a play's own revenue copy below a
direct billing connection, so for a store-billed play, sending it is work that changes
nothing. A play that moves to web billing should switch to the **website** shape and add
it — ask the MCP for that contract.

## /users — fields sent

`{ id, email, name, plan, granted, country, currency, created_at, last_seen_at, subscription? }`

Supported filters:

- `?plan=` — `free`, `premium` (paying), `trial`, `granted`, `promo`, `sandbox`. Any other
  value is a 400 that names them. `test` is a reserved non-paying bucket name in the contract,
  but `bucketFor()` puts nobody in it, so this play does not list it: `?plan=test` is a 400
  too. `/summary` still reports `users_by_plan.test` as 0.
- `?stage=checkout` — accounts that fired `checkout_started`, from this play's own event log.
- `?stage=purchase` — paying accounts.
- `?stage=add_to_cart` — **not implemented, returns 400.** Deliberate: the dashboard maps a
  400 to "this play does not list users by that stage yet", whereas silently returning
  everyone would make the funnel bar list the wrong people, which looks like data rather
  than a gap.

## Plan bucketing

`src/lib/dashboard-stats.ts` → `bucketFor()`. Mutually exclusive, evaluated in this order:

1. `plan_type !== 'premium'` → **free**
2. `premium_environment === 'sandbox'` → **sandbox**
3. `premium_source === 'grant'` → **granted**
4. `premium_source === 'promo'` → **promo**
5. `premium_status === 'trialing'` → **trial**
6. otherwise → **premium** (the only paying bucket)

Every bucket except `premium` is a reserved non-paying name in the contract. Sandbox is
checked first because a sandbox purchase fires the same RevenueCat events as a real sale,
so any logic that reads the event type instead of `environment` counts every TestFlight
tester as a customer.

## Known gaps to close per play

- [ ] `profiles.region` must actually be populated at signup, or every per-market number
      is unattributed. The admin overview warns when coverage drops below 50%.
- [ ] Returning accounts leave a first-party row. `retention.cohorts` is built from
      `profiles.created_at` (the cohort and its `signups`) and each account's rows in
      `analytics_events` (back on day 1, 7 or 30 means a row that UTC day). The app's own
      `track()` goes to PostHog only, and `/api/lifecycle/session` records `signup_completed`
      once per account, so an app play records a first-party event for the activity that means
      "came back", or its retained counts read 0.
- [ ] `profiles.last_seen_at` is not part of retention: `/api/lifecycle/session` writes it on
      every session, and it feeds `/users`' `last_seen_at` and the daily cron's `user_inactive`
      (the win-back flow). The app calls that route from `lib/lifecycle.ts`; with no
      `EXPO_PUBLIC_SITE_URL` it is never written.
- [ ] Set `DASHBOARD_API_KEY` on the deployment and connect the play in the dashboard.

## Verifying

```bash
curl -s -H "Authorization: Bearer $DASHBOARD_API_KEY" \
  http://localhost:3000/api/dashboard/v1/summary | jq
```

Check by eye that every split is ≤ its total, then confirm from the other side with
`integration_check`. The route logs and drops any split that overshoots its own total,
because the dashboard would otherwise drop it silently.
