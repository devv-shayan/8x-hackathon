# Analytics and instrumentation

**Every user-visible change registers its events first** (AGENTS.md, non-negotiable 1). A
screen, route, button, paywall, onboarding step, checkout, settings toggle, share sheet, or a
cron that changes a user's state: its events are decided and registered _before_ the feature
code is written, with the `events` skill (`.claude/skills/events/`), which asks what the code
cannot tell you. A feature with no events can't be judged, and the week-5 kill-or-scale
decision reads from what this repo reports.

`docs/EVENTS.md` is the full guide: the canonical catalog, dedupe, discriminators, consent.
This file is the rules.

## A registry per app, three sinks

Each app has its own registry, the single source of truth for its event names:
`apps/web/src/lib/analytics/events.ts` on the web, and the `EventName` union in
`apps/mobile/lib/analytics.ts` on the app. They are separate lists, not mirrors: `check:events`
checks each app's call sites against its own. A moment both apps record keeps one name in both
(`onboarding_completed`, `account_deleted`).

| Sink                       | Where                                                                                                   | Answers                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| PostHog (+ GA4 on the web) | `apps/web/src/lib/analytics/client.ts` (PostHog and GA4), `apps/mobile/lib/analytics.ts` (PostHog only) | Funnels, replay, the dashboard's PostHog connection                   |
| First-party                | `apps/web/src/lib/analytics/record.ts` → `analytics_events`                                             | Retention cohorts, admin segments, numbers that survive an ad blocker |
| Play Events API            | `apps/web/src/lib/plays/events.ts`                                                                      | The platform's email automation (welcome, win-back, trial expiry)     |

Every event goes to PostHog (and GA4 on web). Anything judged over time or per person also goes
first-party. Lifecycle and money events also go to the Play Events API, server-side only. The
app's `track()` reaches PostHog alone; its first-party and Play Events moments are emitted by
the web routes it calls (first-party under the web registry's names, Play Events under the
canonical ones). Choosing is a real decision; `docs/EVENTS.md` says how.

## The rules

1. **Register before you fire.** A web event fired but not in the registry is rejected by
   `/api/track` with a 400 and vanishes; nothing anywhere says so. Plays have lost their main
   funnel step for months this way. On the app, an unregistered name doesn't typecheck.
2. **`npm run check:events` is the gate.** It fails on a name fired but not in its app's
   registry, a discriminator for an event that doesn't exist, or a non-canonical Play Events
   name. A name registered but never fired is only a warning. It runs in CI. Run it before you
   commit.
3. **Use the canonical names.** The Play Events catalog (`user_signed_up`, `trial_started`,
   `subscription_started`, … in `docs/EVENTS.md`) is shared by every play; the platform only
   runs flows for names it knows. A local synonym means no flow ever fires. Reuse an existing
   name when it is the same moment: two names for one action make every funnel on either wrong.
4. **Naming:** `snake_case`, object then action (`checkout_started`, not `start_checkout`), past
   tense for things that happened, present for states. No variables in a name; a name is a
   fixed string literal.
5. **Properties are ids, enums and booleans.** No free text, and no personal data (a name, an
   email, what someone typed) in event properties or first-party `metadata`. Record _that_ a
   field changed, not _what_ was typed. The Play Events API is the one sink that carries a
   person's email, by contract, and only from the server.
6. **Per-item events carry a discriminator.** An event that fires once per _thing_ (per plan,
   per item) carries that thing's id in `metadata` and declares it in `EVENT_DISCRIMINATORS`
   in `apps/web/src/app/api/track/route.ts`. Without it, the first one each day is recorded and
   the rest are silently deduped away.
7. **Keys stay server-side.** `PLAY_INGEST_KEY` never reaches a browser or the app. If the app
   needs to trigger a Play Event, it calls its own backend and the backend emits (signup does
   this through `/api/lifecycle/session`).
8. **Web and mobile report to the same PostHog project.** Keep `NEXT_PUBLIC_POSTHOG_HOST` and
   `EXPO_PUBLIC_POSTHOG_HOST` in step, or the two apps' events split across projects.

## Person properties are a privacy decision

The app calls PostHog `identify` with the Supabase user id after sign-in, and today also sets
the account's `email` as a person property. That makes email "linked to the user" in PostHog,
which the App Store privacy label and the Play Data safety form must then declare
([permissions and privacy](permissions-and-privacy.md)). Declare it, or stop sending it; don't
leave it undeclared.

## The Play Stats API is this play's own reporting

`apps/web/src/app/api/dashboard/v1/` is what the stats dashboard reads (AGENTS.md,
non-negotiable 2). Its contract comes from your stats dashboard (its docs or MCP), **never from memory**, including
from `docs/PLAY_API.md` or this file. The `play-api` skill walks through it. Counts it shares
with the admin panel come from `apps/web/src/lib/dashboard-stats.ts` ([database](database.md)).

## Where this differs from template-web

template-web's analytics rule is a typed `track()`/`trackServer()` taxonomy over PostHog alone,
with generic events (`element_clicked`, `flow_started`). This repo's taxonomy is the plays
platform's canonical catalog across three sinks, because the platform's email automation and
the stats dashboard both read it. The shared ground is the same: one registry, typed call
sites, `snake_case`, no personal data in properties.
