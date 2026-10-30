# Error handling

Two kinds of failure get two different responses. Don't blend them.

- **The person did something the product doesn't allow** (a declined payment, a plan limit, a
  code that expired): an expected error, with a message written for them. Normal control flow,
  not a bug. It is counted in PostHog, never sent to Sentry.
- **Something actually broke** (an unexpected null, a timeout, a real bug): let it throw.
  Report it with `log.error`, and show the person a generic, safe message. Never the raw error.

## The rules

1. **Nothing raw reaches the person.** No stack trace, database error string or internal code
   in a response body, a toast, an alert or an error screen. Verbose errors are free
   reconnaissance for an attacker. Log the detail server-side; show a message they can act on.
2. **A failed request is an error the UI shows, never an empty list.** A screen that renders
   "No items yet" because the fetch failed is lying. Loading, empty and failed are three states
   and each gets its own UI. On mobile, the API client (`apps/mobile/lib/api.ts`) throws on
   any failure and the TanStack Query error state renders it (`components/QueryError.tsx`); a
   hook never catches a failure to return `[]`.
3. **Unexpected errors go through the logger's `log.error`,** never a direct
   `Sentry.captureException` or `console.error` in feature code. One call means one place for
   context and redaction, and the same line reaches whatever the app reports to. Pass the
   error itself as `{ error }` so its stack survives.
4. **Don't report what you expected.** An expected error sent to Sentry or logged as an error
   is noise, and noise is how the reports stop being read. A handled failure is `log.warn` at
   most.

## What each app has

- **Mobile:** Sentry (`@sentry/react-native`) is initialised in `apps/mobile/app/_layout.tsx`,
  enabled only in release builds with `EXPO_PUBLIC_SENTRY_DSN` set, with performance tracing
  off. The mobile logger (`apps/mobile/lib/logger/`) is the reporting helper: in a release
  build, `log.error` sends the error to Sentry (an exception when an `Error` is passed as
  `{ error }`, a message otherwise), and every other line is a breadcrumb, so the lines before
  a crash arrive with it ([logging](logging.md)). The root `ErrorBoundary` catches render
  errors, shows a generic fallback and reports through `log.error`; the API client reports a
  response that breaks the contract the same way. Source maps must be uploaded for every build
  and every OTA update, or crashes are unreadable ([mobile releases](mobile-releases.md)).
- **Web:** no Sentry. Server code reports with the Pino logger's `log.error`
  (`apps/web/src/server/lib/logger/`), a structured line on stdout that Vercel's log drain
  collects. The `/api/app/v1` routes throw `ApiError` (`src/server/api/app-errors.ts`) for an
  expected failure, with a message written for the person; `createAppRoute` turns anything
  else into a 500 with a generic message and logs the detail. Other routes return their JSON
  errors directly. Client Components have no error reporting.

Neither app has template-web's `AppError`, `captureError` or `captureClientError`; don't import
them, and don't write a second helper beside `log.error`.

## template-web's helpers, for a play that adds Sentry to the web

The standard is template-web's pair:

- `AppError` (`src/lib/errors/app-error.ts`): the expected error, with a user-facing message, a
  status and a code. Route and action factories translate it into the response.
- `captureError(error, context)` (server) and `captureClientError(error, context)` (client):
  report an unexpected error to Sentry and return `{ userMessage, status, isExpected }`, where
  `userMessage` is always safe to show.

This repo hasn't adopted them, or Sentry for `apps/web`. A play that adds Sentry to the web
adopts the pair whole rather than scattering `Sentry.captureException` calls. Until then: throw
and catch plainly, return a generic message from routes, and report through `log.error` in
both apps.

## Mobile-specific

- **The app must work offline and degraded.** `OfflineBanner` / `OfflineOverlay` handle no
  network; a request that fails for any other reason still shows its error state, not a
  spinner forever.
- **An unconfigured build must say so.** Without `EXPO_PUBLIC_SITE_URL` the API client throws
  `not_configured` before any request, and screens show "Not connected yet"; without Supabase
  credentials every sign-in method says sign-in isn't set up. The fake `200 null` fetch that
  once made such a build silently show nothing (what App Review would have seen, Apple 2.1) is
  gone; don't bring the pattern back anywhere.
- **A native crash cannot be fixed over the air.** An OTA update can fix a JavaScript error; a
  crash in native code needs a store build, and the minimum-version gate to move people off the
  broken one ([OTA updates](ota.md)).
