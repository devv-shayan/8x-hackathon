# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The marketing site, admin panel and API live in `apps/web`. The Expo app in `apps/mobile` has its own
record (`apps/mobile/PRODUCT.md`); this file holds the product truth both share.

## Users

- **Primary: the play engineer.** An engineer who clones this template to start a new consumer
  subscription app (a "play": in this repo, play and app mean the same thing). They rebrand it in an afternoon and have weeks, not months, to ship
  to the App Store and Google Play. They are not a designer and should not have to become one.
- **Secondary: each play's end users.** Consumers on iOS and Android who arrive through an app store
  listing or the play's marketing site. Who they are changes with every play; the template never
  assumes one audience.
- **Tertiary: operators.** Whoever runs a live play uses the admin panel for users, grants, funnel
  and retention.

## Product Purpose

A brand-neutral starting point that is already a finished product: Expo app, Next.js marketing site
and admin, Supabase backend, analytics, paywall, onboarding and the engineering standards, wired
together. Success is a fresh clone that looks and feels like a premium, shipped app on day one; a
rebrand that takes one preset choice, one accent colour and a name; and nothing in the design a play
has to undo before it can launch.

## Positioning

Its design is not invented for the template. It is the craft of two shipped plays, carried back
into the base every new play starts from, so the next play begins where the best ones ended.

## Operating Context

- A play is cloned, renamed (`@app/*`), rebranded in `packages/brand`, then built on for a few
  weeks before its store submission. After launch most mobile changes ship as OTA updates.
- The marketing site's job is to show the app and send people to the stores or the waitlist.
- App Review and Google Play review every store build (see the store-review rules).

## Capabilities and Constraints

- **One brand source.** Colours, type, radii, elevation and motion live in `packages/brand`; both
  apps read from it. No hardcoded hex anywhere else.
- **Two finished presets, chosen with one setting** (decided 2026-09-24): `dusk`, dark and
  editorial, derived from one of those plays; `daylight`, light and warm, derived from the other.
  Structure, components and motion are shared; a preset changes the world, not the layout.
- **Every user-visible change registers its events first** (the `events` skill); an unregistered
  event is dropped silently.
- **Store-review rules bind the UI**: paywall shows price, period, trial terms, Restore, Terms of Use
  and Privacy links; account deletion reachable in the app; permissions asked in context.
- **Mobile motion stack is already installed** (Reanimated 4, gesture handler, blur, gradient, SVG,
  haptics, expo-image), so design work adds no native modules and ships OTA. There is no bottom
  sheet library: sheets are the app's own `Sheet` component on React Native's `Modal`.
- Demonstration content is synthetic and must be marked as such and easy to replace.

## Brand Commitments

- The two presets and their sources are binding. The references' own names, copy, photography,
  mascots and brand colours are not: the template takes their craft, never their identity.
- The `🎨 BRAND` / `REPLACE` marker convention stays: anything a play must change is findable by
  searching for it.

## Evidence on Hand

None of its own. The template has no users, testimonials, press, prices or metrics, and must not
invent any: pricing, social proof and store ratings ship as clearly marked placeholders.

## Product Principles

1. **Finished on day one.** A clone should be demoable before anyone touches it.
2. **One edit rebrands.** If a play has to hunt for a colour, the template failed.
3. **Craft from shipped plays, not from a moodboard.** Every pattern here has survived a real launch.
4. **Honest by default.** Placeholders look like placeholders; nothing claims what a play hasn't earned.
5. **Instrumented and store-safe out of the box.** Design never outruns the events or the review rules.

## Accessibility & Inclusion

WCAG 2.2 AA contrast in both presets, including text over imagery. Reduced motion respected on both
platforms (`prefers-reduced-motion`, Reanimated's reduced-motion setting). Touch targets at least
44pt. Text survives iOS Dynamic Type and Android font scaling at the large sizes without clipping.
