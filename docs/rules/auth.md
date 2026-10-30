# Auth

Supabase Auth is the identity provider for both apps. It owns sign-in, sessions and tokens.
It is never a path to application data ([database](database.md)): **Supabase owns auth,
Prisma owns every other byte**, and that boundary does not blur.

## One identity, two transports

| Caller                      | The session travels as                                                                                      | The server verifies it with                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The website and admin panel | **HttpOnly cookies**, set by `@supabase/ssr` and refreshed on every request by `apps/web/src/middleware.ts` | `createServerSupabaseClient()` → `auth.getUser()` in a Server Component, route handler or server action    |
| The mobile app → `apps/web` | **`Authorization: Bearer <access token>`**, the current session's token from `supabase.auth.getSession()`   | The route, server-side: `auth.getUser(token)` on the secret-key client, `requireUser()` with `/api/app/v1` |

- **The app never sends a user id the server trusts.** Identity comes from the verified token,
  never from the request body; otherwise anyone can act as any account. `/api/lifecycle/session`
  is the reference: it reads the bearer token, resolves the user with Supabase, and only then
  writes. `/api/delete-account` accepts the app's bearer token the same way.
- **A route the app calls authenticates by bearer token only.** No cookies, so no ambient
  credential a third-party page could ride on (no CSRF surface). A route the website calls
  uses the cookie session.
- **Tokens expire.** The app refreshes them (`autoRefreshToken`, restarted when the app returns
  to the foreground in `apps/mobile/lib/supabase.ts`). Always read the token from
  `getSession()` at request time; never cache one in app state.
- `profiles.id` **is** the Supabase auth user's UUID, set when the profile row is created,
  never generated separately. RevenueCat's app user id is the same UUID
  (`Purchases.logIn(session.user.id)`), which is how the RevenueCat webhook finds the profile.
  Keep that call.

## The clients, and what each may do

| Client                                                                 | Where it runs                      | May                                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/supabase/server.ts` (`createServerSupabaseClient`)   | Server Components, routes, actions | Read the person's session                                                                     |
| `apps/web/src/lib/supabase/browser.ts` (`createBrowserSupabaseClient`) | The browser                        | Sign in and out                                                                               |
| `apps/web/src/lib/supabase/secret-key.ts` (`createSecretKeyClient`)    | **Server code only**               | Auth's admin API (verify a bearer token, look up, list and delete users), signed storage URLs |
| `apps/mobile/lib/supabase.ts` (publishable key)                        | The device                         | Sign in and out, hold and refresh the session                                                 |

Each web wrapper returns `AuthOnlySupabaseClient` (`src/lib/supabase/auth-only.ts`,
`Pick<SupabaseClient, 'auth' | 'storage'>`), so `.from()` and `.rpc()` fail `npm run typecheck`,
and ESLint bans importing `@supabase/*` anywhere but those files and `src/middleware.ts`. The
mobile client is narrowed the same way: `apps/mobile/lib/supabase.ts` exports
`Pick<SupabaseClient, 'auth'>`, and is the only file in `apps/mobile` allowed the import.

## Keys

- Clients get the **publishable** key: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (web) and
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (app). It is public by design.
- Only server code gets the **secret** key, `SUPABASE_SECRET_KEY`. It bypasses RLS and every
  other check; it never reaches a browser or a phone ([secrets](secrets.md)).
- The legacy `*_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` JWT names are read only as
  fallbacks for older deployments. New setups use the publishable and secret keys.

## Sign-in methods and the stores

The template offers email one-time codes, Sign in with Apple (Apple's native sheet on iOS,
exchanged with `supabase.auth.signInWithIdToken`; Supabase's OAuth flow elsewhere) and Google
through Supabase's OAuth flow.
Two store rules follow from any sign-in change ([store review](store-review.md)):

- **Apple 4.8:** if the iOS app offers any third-party login, it offers Sign in with Apple too.
  The template meets it natively (`expo-apple-authentication`, see `app/(auth)/login.tsx`),
  and `check:store` holds it there.
- **Apple 5.1.1(v), Google Play:** an app that lets you create an account lets you delete it
  from inside the app, and Play also needs a web deletion link (`/delete-account`). Deletion is
  a server route using the secret-key client's auth admin API, after the route has verified who
  is asking. It emits `account_deleted` (the platform's erasure hook, `docs/EVENTS.md`).

A login required to use the app means App Review needs a demo account in the review notes:
that is a human's job, and `store-review` says so rather than guessing.

## Admin sign-in

The admin panel is the web app's cookie session plus an admin check. See
[authorization](authorization.md).
