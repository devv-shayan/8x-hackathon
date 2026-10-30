# Mobile data: the app talks to the API, never to tables

> **Status.** In force. Every data read and write the app makes goes through
> `apps/mobile/lib/api.ts` to a `v1` route below; its Supabase client is typed to sign-in only;
> and no table keeps a policy or a grant an app could use ([database](database.md)). The one
> other request the app makes is its session announcement, a plain `fetch` in
> `apps/mobile/lib/lifecycle.ts` to `/api/lifecycle/session`, outside `v1`
> ([below](#the-routes)).

The mobile app reads and writes data through `apps/web`, not through Supabase.

## Why

An installed app cannot be forced to update. If a phone talks to tables directly, **the
database schema becomes a public API, frozen by the oldest build still installed.** Renaming a
column breaks every user who never updated, and nothing can fix it over the air if the old
query is in their build's JavaScript and they never open the app again. With an API in
between, the route is the contract: `v1` stays until no supported build calls it, and the
schema changes freely behind it.

It is also one authorization path to review instead of two (RLS policies _and_ route code),
and it is what the money non-negotiable already requires for entitlement writes.

## The rule

- **The device calls typed routes under `apps/web/src/app/api/app/v1/`**, and nothing else, for
  data. The Supabase client on the device does auth only: `apps/mobile/lib/supabase.ts` types
  it `Pick<SupabaseClient, 'auth'>` so `.from()` and `.rpc()` don't compile, and ESLint bans
  importing `@supabase/*` anywhere else in `apps/mobile`.
- **Every route** validates its input with Zod and returns a typed response. Every route but
  `config`, which is public, also authenticates with the bearer token the app sends
  ([auth](auth.md)), runs `requireUser()`, and reads and writes through Prisma
  ([database](database.md)).
- **One contract, both sides.** `packages/contract` (`@app/contract`) holds the Zod schema for
  every `v1` route's input and output. The web validates with it; the app parses every response
  with it. A shape is defined once.
- **One client on the device, for data.** `apps/mobile/lib/api.ts` is a typed `fetch` wrapper:
  it attaches the current session token, parses the response with the contract, and **throws**
  on any non-2xx or unparseable body. A failed request is an error the UI shows, never an empty
  list ([error handling](error-handling.md)). Hooks wrap it in TanStack Query
  ([state management](state-management.md)). The session announcement in `lib/lifecycle.ts` is
  the one request outside it: fire-and-forget bookkeeping with no response to parse, whose
  failure is swallowed so it never blocks the app from opening. Anything that returns data
  goes through `api.ts`.

## `v1` is a promise

- **Never change a `v1` response shape once a store build calls it.** Add `v2` instead. When
  unsure whether a store build calls a route, assume one does.
- **Never make a `v1` input stricter** (a new required field, a narrower type): old builds send
  the old input.
- A route is retired only when no supported build calls it. The minimum-version gate
  ([OTA updates](ota.md), [mobile releases](mobile-releases.md)) is how old builds stop being
  supported.
- An OTA update can move the JavaScript onto `v2`; a build that never updates keeps calling
  `v1` for as long as it is installed and supported.

## The routes

Each is one entry in `packages/contract/src/v1/endpoints.ts`, and one file under
`apps/web/src/app/api/app/v1/` built from it by `createAppRoute`
(`apps/web/src/server/api/app-route.ts`): the bearer check, the input parsed with the contract
(a bad query or body is a 400 with its issues), and the response parsed with the contract
before it is sent (a mismatch is a 500, never a partial 200).

- `profile` (GET, PATCH): the person's own. PATCH takes the display name, the avatar, the
  locale and marketing consent, and any other key is a 400; `plan` is read-only.
- `items` (GET, POST), `items/{id}` (GET), `tasks?item_id=` (GET), `tasks` (POST): the
  person's own, never another's; someone else's item is a 404, like one that doesn't exist.
- `activity` (GET, optionally `?item_id=`), `notifications` (GET).
- `account` (DELETE): deletes whoever the token belongs to.
- `uploads` (POST): a signed upload URL for an avatar (below).
- `config` (GET, public): the minimum supported versions ([OTA updates](ota.md)).

Every list takes `?limit=` (1 to 100) and `?cursor=`, and answers `next_cursor`: pass it back
verbatim for the next page, until it is null. A create takes an optional `id` the device
generates, so a retry is safe: the same id again answers 200 with the row it made, and an id
that is someone else's is a 409. Errors are `{ error: { code, message } }`, and `message` is
written for the person.

Two routes outside `v1` stay: `/api/lifecycle/session` (bearer token; emits
`user_signed_up`, stamps `last_seen_at` and `region`), which the app still calls on every cold
start and sign-in, with a plain `fetch` from `lib/lifecycle.ts` rather than `api.ts` (it is
not in the contract), and `/api/delete-account`, which app builds from before `/api/app/v1`
existed still call (newer ones call `DELETE account`). Each stays until no supported build
calls it.

## The client, `apps/mobile/lib/api.ts`

`api('listItems', { query: { limit: 20 } })`: the endpoint by its contract name, its params,
query and body typed from the contract, the response parsed with it. What it does with each
failure, on purpose:

- **Not configured** (no `EXPO_PUBLIC_SITE_URL`, or no Supabase for a signed-in route):
  `not_configured`, with no request. Screens say "Not connected yet"; a development build also
  names the variable to set.
- **Offline**: `offline` at once when the phone has no connection. TanStack Query runs
  requests offline (`networkMode: 'always'`) so the screen can say so, and refetches when the
  connection comes back. Connected but no answer from the server is `unreachable`, retried.
- **Timeout**: `timeout` after 15 seconds (30 for account deletion); retried.
- **401**: one token refresh and one retry; a second refusal signs the device out of the dead
  session and says so once. A 503 is never read as signed out.
- **A response that breaks the contract**: `invalid_response`, reported to Sentry, never a
  partial result.

`components/QueryError.tsx` is the shared error state; a list's "Show more" pages with the
`next_cursor` the API returned.

## Storage: signed upload URLs

Uploads never go through a storage policy. The app asks `POST /api/app/v1/uploads`; the route
authorizes the person, creates a signed upload URL with the secret-key client
(`createSignedUploadUrl`), and returns it; the device uploads the file straight to storage with
that URL. No storage policies to write, and authorization stays in one place.

Avatars are the one kind today, in the private `user-uploads` bucket, which enforces the
allowed types and the 5 MB limit on the upload itself. The route picks the path,
`<user id>/avatar/<uuid>.<ext>`; the device then sends it as `avatar_path` on `PATCH profile`,
which accepts only a path in the caller's own folder, and `GET profile` answers a signed
download URL for it, valid for an hour. A new avatar removes the person's older files, and
deleting the account removes them all (`apps/web/src/server/storage/avatars.ts`).

## Money stays on the server

- Purchases happen on the device through RevenueCat. Entitlement is written by the RevenueCat
  webhook (`apps/web/src/app/api/webhooks/revenuecat/route.ts`), which finds the profile by the
  app user id. `Purchases.logIn(session.user.id)` is what makes that id the Supabase user id:
  keep it.
- The app may read RevenueCat's `CustomerInfo` to decide what to show. It never writes
  `plan_type`, `premium_*` or a subscription row, through any route (AGENTS.md,
  non-negotiable 3).

## Never in the app

- A database driver, Prisma, or any Node-only server library. `apps/mobile` has no server.
- The secret key, or any value a server must hold ([secrets](secrets.md)).
- A query shaped by what the device sends. The route decides what the person may see.
