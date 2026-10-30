# Feature flags

> **Status.** Today the app has one helper, `useFeatureFlag(key, default)` in
> `apps/mobile/lib/featureFlags.ts`, over PostHog flags; it returns the default until PostHog
> answers: when PostHog is not configured, while flags load, and when the request fails or
> times out before any flag has loaded. After that, PostHog's answer wins. It reads the PostHog
> client directly, so it works outside `<PostHogProvider>`. The web has none. The standard is template-web's typed flag system
> (`src/lib/flags/`), which this repo hasn't adopted ([below](#where-this-is-going)). The rules
> below apply now, whichever implementation is underneath.

## The rules

1. **One typed registry of flag keys.** A flag name is never a bare string at a call site:
   declare every key in one place, with its type (on/off or a closed set of variants) and its
   default, and derive the call-site types from it. Until the registry exists, keep flag keys
   as named constants next to `useFeatureFlag`, not string literals in screens.
2. **The default is the safe, shipped behaviour.** A flag resolves to its default when PostHog
   is unreachable, unconfigured, or slow. A flag read never blocks a screen and never throws.
   Ship `false` (or `'control'`) for anything not fully rolled out.
3. **Nothing is hidden from App Review.** A flag, remote config value or OTA update must not
   turn on, after review, a feature that was hidden during it. That is Apple 2.3.1, and it ends
   in rejection or removal, not just a delay. A feature behind a flag is either reviewable (on
   for the reviewer, or described in the review notes with a way to reach it) or not in the
   binary. See [store review](store-review.md).
4. **A flag does not change what the app is.** Rolling out a new product category, a
   storefront, or something to buy outside in-app purchase behind a flag is the same violation
   as doing it over the air (Apple 2.5.2, 3.1.1).
5. **Flags are temporary.** When a rollout is done, delete the flag and the losing branch in
   the same PR. A flag nobody will ever flip again is dead code with a network call attached.
6. **Every flag that changes what a user sees is measured.** An experiment's variants get
   events like any other feature ([analytics](analytics.md)); a flag nobody can evaluate is a
   coin flip.

## Flags and OTA updates

A flag and an OTA update both change a shipped app without a store review, and the store rules
are the same for both. Use a flag to stage risk inside behaviour that is already reviewed (a
redesigned screen, a new onboarding step, a copy test). Use an OTA update to ship a fix or a
feature within the app's reviewed purpose ([OTA updates](ota.md)). Neither is a way around
review.

## Where this is going

template-web's system, when it is adopted here: a `FLAGS` registry (`as const`, typed by
`type: 'boolean' | 'variant' | 'experiment'`), resolved through an ordered provider chain
(database override, database flag, PostHog, static default), with server and client surfaces
and an admin toggle gated by permission. The web gets it directly. The app gets the typed
registry and the PostHog provider; database-backed overrides reach the app through the
`/api/app/v1/config` route, not a direct table read ([mobile data](mobile-data.md)).
