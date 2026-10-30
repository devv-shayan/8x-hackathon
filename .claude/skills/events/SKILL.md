---
name: events
description: 'Register and wire the analytics events for a feature, before the feature is built. Use this whenever you are about to add or change anything a user can see or do — a screen, a route, a button, a paywall, an onboarding step, a checkout, a settings toggle, a share sheet, a cron job that changes a user''s state. Also use when asked "what events do we have", "is this tracked", "why is this number blank on the dashboard", "add tracking for X", or when a feature is finished and nobody has decided what it reports. If you are unsure whether a change needs events, run this skill: the answer is usually yes.'
---

# Events

**Instrumentation is not a follow-up task.** A feature that ships without events cannot be
judged, and the week-5 kill/scale decision reads from the numbers this repo reports. A screen
with no events is a screen nobody can defend.

This skill runs **before** the feature code, not after.

## The one rule

> Every user-visible change registers its events in its app's registry **first**, then fires
> them from the code you write. No event fires that is not in the registry.

Each app has its own registry, and each is the single source of truth for that app:

- **Web:** `apps/web/src/lib/analytics/events.ts`. It types the `gaEvent()` call sites, and the
  server-side whitelist (`TRACKED_EVENTS`) is built from it. A name not in it is rejected by
  the beacon with a 400 and the data is gone silently — which is exactly how a play discovers
  six months later that its main funnel step was never recorded.
- **Mobile:** the `EventName` union in `apps/mobile/lib/analytics.ts`. It types the app's
  `track()` call sites, which go to PostHog. It is a separate list, not a mirror of the web's.

`npm run check:events` checks every call site against its own app's registry, in CI.

## Step 1: Read what already exists

Never invent a name that already has one. Start here:

```bash
cat apps/web/src/lib/analytics/events.ts    # web registry
cat apps/mobile/lib/analytics.ts            # mobile registry: the EventName union
npm run check:events                        # what is registered vs what is fired
```

Reuse an existing name if the moment is the same moment. Two names for one action means every
funnel built on it is wrong. A moment both apps record keeps one name in both registries
(`onboarding_completed`, `account_deleted`).

## Step 2: Ask for the events you cannot infer

Some events follow mechanically from the code (a screen mounts → `*_viewed`). Others encode a
product decision only the person asking can make. **Ask about these explicitly — do not guess:**

1. **What is the "aha" for this feature?** The single action that means it worked. This becomes
   the `user_activated` trigger or the feature's primary metric. If there is no answer, the
   feature has no success criterion and that is worth surfacing now.
2. **What is the drop-off you expect?** Each step you want to see people fall out of needs its
   own event, or the funnel has a gap you cannot see into.
3. **What discriminator does each event carry?** If an event can fire for different _things_
   (per pack, per lesson, per plan, per envelope), the id of that thing must ride in the
   metadata **and** be declared as a discriminator (Step 4). Without it, per-item counts are
   fiction: dedupe records the first one per day and drops the rest.
4. **Is this a money moment?** Purchases, trials, refunds and cancellations must also go to the
   Play Events API (Step 5) or the email automation for this play never fires.
5. **Does this change a user's lifecycle state?** Signup, activation, going inactive, deleting
   an account. These are the canonical events the platform already has flows for — use the
   canonical name, do not coin a new one.

Put the answers in the doc comment above the event group. The comment is not decoration: six
months from now it is the only record of why the event exists and what it was meant to prove.

## Step 3: Register, in the right group

Add to `apps/web/src/lib/analytics/events.ts` (web) and/or the `EventName` union in
`apps/mobile/lib/analytics.ts` (mobile). Names are `snake_case`, object-then-action
(`checkout_started`, not `start_checkout`).

```ts
/**
 * <Feature name> — <what this group is judged on, in one sentence.>
 *
 * <Which of these is THE metric and why. What question each one answers that
 * would otherwise be unanswerable.>
 */
export const FEATURE_EVENTS = {
	/** <When exactly it fires.> metadata: { thing_id } */
	viewed: 'feature_viewed'
} as const

export const FEATURE_EVENT_NAMES = Object.values(FEATURE_EVENTS)
```

Then spread `FEATURE_EVENT_NAMES` into `ALL_EVENT_NAMES` at the bottom of `events.ts`. That one
list types `gaEvent()` and is the first-party whitelist: `TRACKED_EVENTS` in
`src/lib/analytics/record.ts` is `ALL_EVENT_NAMES`, so a group left out of it fails typecheck at
every `gaEvent` call and is rejected by `/api/track`. Never hand-list `TRACKED_EVENTS`; if some
events should be PostHog-only, narrow it with a filter there (see Step 4 for which).

On mobile, add the names to the `EventName` union; there is no second list to update.

## Step 4: Pick the sinks — this is the part that gets skipped

There are three, they answer different questions, and choosing wrong is invisible:

| Sink                                                   | Use it for                                                                  | Gets you                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **PostHog + GA4** (`gaEvent` / `track`)                | Everything. Always fire here.                                               | Funnels, session replay, the dashboard's PostHog connection                                       |
| **First-party** (`recordUserEvent` + `TRACKED_EVENTS`) | Anything you need per-person, historical, or segmentable in the admin panel | `retention.cohorts` on the Play Stats API, admin segments, and numbers that survive an ad blocker |
| **Play Events API** (`src/lib/plays/events.ts`)        | Lifecycle + money moments only                                              | The platform's email automation: welcome, abandoned checkout, trial expiry, win-back              |

Fire first-party for anything that is **judged over time or per person**. PostHog only sees
forward from the day it was installed; your own table already knows what happened last quarter,
and it is the only route to retention cohorts for a play with no PostHog.

How each app reaches the sinks:

- **Web:** one `gaEvent()` call fans out to PostHog, GA4 and the `/api/track` beacon, which
  persists anything in `TRACKED_EVENTS`. `recordUserEvent` is the server-side call, for moments
  no browser sees (a webhook, a server route).
- **Mobile:** `track()` goes to PostHog only. A moment the app needs first-party or on the Play
  Events API is emitted server-side by the web route the app calls (first-party under the web
  registry's name, Play Events under the canonical one): signup through
  `/api/lifecycle/session`, a consent change through `PATCH /api/app/v1/profile`.

If the event carries a discriminator, declare it in `EVENT_DISCRIMINATORS` in
`apps/web/src/app/api/track/route.ts`. The client is not allowed to choose the dedupe key — a caller
that sent a fresh discriminator per request would write unbounded rows — so the allowed set is
decided server-side, per event name, and everything else in `metadata` is dropped.

## Step 5: Money and lifecycle also go to the Play Events API

`user_signed_up` and `account_deleted` are mandatory for every play. If the play monetizes, the
Tier 2 subscription and purchase events are what the revenue email flows run on.

```ts
import { trackPlayEvent } from '@/lib/plays/events'

await trackPlayEvent(
	'subscription_started',
	{ id: user.id, email: user.email, plan: 'pro', country, marketing_consent: consent },
	{ plan: 'pro', price_cents: 999, currency: 'usd', interval: 'month', from_trial: true }
)
```

Money is **integer minor units plus an ISO 4217 currency**, never floats. Call it from the
server only — the ingest key must never reach a browser or a mobile client. See
`docs/EVENTS.md` for the full canonical catalog and the two cron-driven events.

## Step 6: Verify before you call it done

```bash
npm run check:events
```

This fails the build if a name is fired but not in its app's registry, if `EVENT_DISCRIMINATORS`
declares an event that doesn't exist, or if a Play Events call uses a non-canonical name. A name
registered but never fired is only a warning: registering ahead of the UI that fires it is
allowed, so read the warnings rather than trusting the green. It runs in CI too. A green check,
with every new name fired, is the definition of done for instrumentation.

Then confirm the play's end of the contract still holds:

```
"run integration_check on <play-slug>"
```

A dashboard MCP, if yours has one, audits what this play is actually serving right now and names the
exact fields it is not sending. Ask it rather than reading a spec that may have moved.

## Anti-patterns, all of which have shipped before

- **Firing an unregistered name.** The beacon 400s it, nothing surfaces, the number is blank for
  months. This is the single most common failure and the whole reason for the registry.
- **One event for a repeating thing, with no discriminator.** Records the first per day, drops
  every other one, and the per-item breakdown reads as real data.
- **Inferring paid status from webhook event types.** A sandbox purchase fires the same
  lifecycle events as a real sale. Use the `environment` field, or every TestFlight tester
  counts as a customer.
- **Sending rates instead of counts.** Send counts; the dashboard divides, because only it knows
  which cohorts are mature.
- **Adding the events after the feature.** By then the call sites are spread across the diff,
  the discriminators were never threaded through, and it gets deferred.
