# Events

Everything this play measures, and how to add to it. The `events` skill
(`.claude/skills/events/`) walks an agent through this; read that first if you are working with
Claude Code.

## Why there is a registry

Each app has its own registry, the single source of truth for that app's event names.

`apps/web/src/lib/analytics/events.ts` is the web's. It feeds:

- the typed `gaEvent()` call sites (`src/lib/analytics/client.ts`), so a typo is a compile
  error;
- the server-side `TRACKED_EVENTS` whitelist in `src/lib/analytics/record.ts`, which is built
  from the registry's `ALL_EVENT_NAMES` rather than hand-listed;
- `npm run check:events`, which fails CI when a call site fires a name the registry doesn't
  have.

The app's is the `EventName` union in `apps/mobile/lib/analytics.ts`, which types its `track()`
call sites. It is a separate list, not a mirror of the web's, and `check:events` checks the
app's call sites against it on their own. A moment both apps record keeps one name in both
(`onboarding_completed`, `account_deleted`).

**An event fired but not registered is rejected by `/api/track` with a 400 and disappears.** No
error surfaces anywhere a person would see it. Real plays have lost their main funnel step this
way for months at a time. The registry exists so that cannot happen quietly.

## The three sinks

Every event goes to PostHog, and on the web to GA4 as well. Some also go further. Choosing is a
real decision, not a formality.

### 1. PostHog (and GA4 on the web) — always

`src/lib/analytics/client.ts` (web: PostHog and GA4) and `apps/mobile/lib/analytics.ts` (mobile:
PostHog only; the app has no GA4).

```ts
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
gaEvent(FUNNEL_EVENTS.planSelected, { plan: plan.id })
```

Gets you funnels, session replay, and the dashboard's PostHog connection. PostHog only sees
forward from the day it was installed, and a meaningful slice of most audiences blocks it.

On the web, the same `gaEvent()` call also beacons the event to `/api/track`, which persists it
first-party (the next sink) when it is in `TRACKED_EVENTS`. On the app, `track()` goes to
PostHog only; what the app needs in the other two sinks is emitted by the web route it calls
(signup, below).

### 2. First-party — anything judged over time or per person

`src/lib/analytics/record.ts` → the `analytics_events` table.

```ts
import { recordUserEvent } from '@/lib/analytics/record'
await recordUserEvent(user.id, 'checkout_started', { path, metadata: { plan } })
```

This is the only route to `retention.cohorts` on the Play Stats API, and the only data the admin
analytics screens can segment. Your own database already knows what happened last quarter.

Dedupe, pick at most one:

- `dedupeDaily` (default) — once per visitor/event/UTC day. Right for chatty page views.
- `dedupeForever` — once per visitor/event, ever. Right for lifetime-once milestones (signup,
  onboarding) where a redelivery must never create a second row.
- `dedupeDaily: false` — record every occurrence. Right for purchases, refunds, per-item
  completions.

**Discriminators.** If an event fires once per _thing_ (per plan, per lesson, per item), the id
of that thing must ride in `metadata` **and** be declared in `EVENT_DISCRIMINATORS` in
`src/app/api/track/route.ts`. Without it the dedupe key is `(visitor, name, day)` alone: the first
one that day is recorded and the rest are silently dropped, so per-item counts are fiction.

The client cannot choose the dedupe key. A caller sending a fresh discriminator per request
would bypass dedupe and write unbounded rows, so the allowed set is decided server-side per
event name and everything else in `metadata` is dropped.

### 3. Play Events API — lifecycle and money only

`src/lib/plays/events.ts` → the platform, which runs this play's email automation. You never touch
the email provider; you emit canonical events and the platform owns the audiences, flows and deliverability.

```ts
import { trackPlayEvent } from '@/lib/plays/events'
await trackPlayEvent(
	'user_signed_up',
	{ id: user.id, email: user.email, name, country, locale, plan: 'free', marketing_consent },
	{ signup_method: 'google' }
)
```

Server-side only — `PLAY_INGEST_KEY` must never reach a browser or a mobile client. If a client
needs to trigger one, call your own backend and let it emit.

Money is **integer minor units plus an ISO 4217 currency**, never floats. Timestamps are ISO
8601 UTC. `event_id` is the idempotency key: a fresh UUID per real occurrence, the _same_ one on
a retry, so a redelivery never double-sends an email.

## Canonical catalog

Use these names. They are the vocabulary every play shares, and the platform only offers flows
for events it recognises. Coining a local synonym means no flow ever fires.

### Tier 1 — required of every play

| Event             | Fires when                           | Key properties                                                         |
| ----------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `user_signed_up`  | An account is created                | `signup_method` (`email`\|`google`\|`apple`), `referrer?`, `campaign?` |
| `account_deleted` | Account deleted or erasure requested | `reason?`                                                              |

`account_deleted` is the GDPR right-to-be-forgotten hook: on receipt the platform hard-suppresses
the contact and purges their PII. Always send it.

### Tier 2 — required of any play that monetizes

| Event                    | Fires when                               | Key properties                                               |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------ |
| `user_activated`         | The user hits your "aha" — you define it | `activation_type?`                                           |
| `trial_started`          | A free trial begins                      | `plan`, `trial_ends_at`                                      |
| `subscription_started`   | First paid subscription                  | `plan`, `price_cents`, `currency`, `interval`, `from_trial?` |
| `subscription_renewed`   | A subscription renews                    | `plan`, `price_cents`, `currency`                            |
| `subscription_expiring`  | **Cron:** N days before it lapses        | `plan`, `expires_at`, `price_cents`, `currency`              |
| `subscription_cancelled` | Auto-renew turned off, access remains    | `plan`, `reason?`, `access_until`                            |
| `subscription_expired`   | Access actually ends                     | `plan`                                                       |
| `purchase_completed`     | One-time or consumable purchase          | `product_id`, `name`, `price_cents`, `currency`, `quantity?` |
| `user_inactive`          | **Cron:** no activity for N days         | `last_active_at`, `days_inactive`                            |

### Tier 3 — optional, sharpens targeting

`waitlist_joined`, `email_captured`, `checkout_started`, `checkout_completed`, `feature_used`,
`marketing_consent_changed`, and `custom` for anything else.

`checkout_started` without a following `checkout_completed` is what drives the abandoned-checkout
flow, so send both with the same `checkout_id` or the reminder never stops.

### The two cron-driven events

`subscription_expiring` and `user_inactive` are states you detect on a schedule, not reactions to
a user action. `src/app/api/cron/lifecycle/route.ts` in this template does both via the batch
endpoint, with stable `event_id`s so re-runs dedupe. Point a daily scheduler at it.

## Signup, in a monorepo play

Signup happens in the **app**, not on this marketing site, so the web backend would otherwise
never learn about it. `apps/mobile/lib/lifecycle.ts` closes that: it POSTs the session's access
token to `/api/lifecycle/session`, which verifies it server-side and then

- emits `user_signed_up` (Tier 1 — the welcome series trigger),
- stamps `profiles.last_seen_at`, which the `user_inactive` cron selects on,
- stamps `profiles.region` on first sight, the source of every per-market figure.

It is already called from `apps/mobile/app/_layout.tsx` on cold start and on `SIGNED_IN`, and it
is idempotent, so extra calls are free. **Set `EXPO_PUBLIC_SITE_URL`** in the app's env or the
call no-ops and all three of the above silently never happen.

## Naming

`snake_case`, object then action: `checkout_started`, not `start_checkout`. Past tense for things
that happened, present for states. If an existing name already covers the moment, **reuse it** —
two names for one action means every funnel built on either is wrong.

## Consent

Marketing flows send only to contacts with `marketing_consent = true`. Transactional messages
tied to money or account state are allowed regardless. Provide `user.marketing_consent` on
events, or fire `marketing_consent_changed` when the user toggles it. The app's toggle does:
`PATCH /api/app/v1/profile` fires it, first-party and to the platform, whenever
`marketing_consent` actually changes. Unsubscribes are handled
by the platform and exposed back to you — mirror them into your DB if you show an email
preferences screen.

## Checking your work

```bash
npm run check:events
```

Fails when a name is fired but not in its app's registry, when `EVENT_DISCRIMINATORS` declares an
event that doesn't exist, or when a Play Events call uses a non-canonical name. A name registered
but never fired is only a warning: registering ahead of the UI that fires it is allowed. Runs in
CI. Then confirm the play's own reporting from the other side:

```
"run integration_check on <play-slug>"
```
