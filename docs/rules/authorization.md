# Authorization

Authentication answers _who are you_ ([auth](auth.md)). This file answers _what may you do_.
The answer is always decided **in server code, before the query**, never by the client and
never by what the client sends. Both apps reach their data only through server routes, so the
route is the one authorization path to review, rather than RLS policies and route code both.

## Who calls, and the guard that decides

| Caller                               | Guard                                                                                                                                                              | Where                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| A signed-in person (web or app)      | `requireUser()` (the app's bearer token) or the session (the website), then scope every query to that user id                                                      | Every route that touches a person's data                            |
| An operator in the admin panel       | Pages: the `admin/(protected)/layout.tsx` guard (session, then `profileStore.isAdmin`). Routes and actions: `requireAdmin()` (`apps/web/src/lib/require-admin.ts`) | Every page under `admin/(protected)/`; every admin route and action |
| The stats dashboard (Play Stats API) | `requireDashboardKey()` (`apps/web/src/lib/dashboard-api-auth.ts`): `DASHBOARD_API_KEY` bearer, constant-time compare, 503 when unset                              | `apps/web/src/app/api/dashboard/v1/*`                               |
| A cron                               | The `CRON_SECRET` bearer, constant-time (`apps/web/src/server/api/cron-auth.ts`), 503 when unset                                                                   | `apps/web/src/app/api/cron/*`                                       |
| A webhook (RevenueCat)               | The webhook's shared secret (`REVENUECAT_WEBHOOK_SECRET` bearer), constant-time, 503 when unset, before the body is read                                           | `apps/web/src/app/api/webhooks/*`                                   |

Rules that hold for all of them:

1. Resolve the caller first; reject when absent (401).
2. Check the caller may touch the _specific_ rows before the query, not after it (403).
3. Never scope a query by a client-supplied id alone. The user id comes from the verified
   session or token.
4. A server action is a public endpoint. The admin layout's guard does not protect an action;
   each action re-checks `requireAdmin()` itself.
5. Unset secret means closed, not open: a guard whose key is not configured answers 503, never
   "allow" ([secrets](secrets.md)). The RevenueCat webhook is the money path, so a Vercel
   production build also fails without a valid `REVENUECAT_WEBHOOK_SECRET` (`docs/ENV_SETUP.md`).
   The legacy edge function `supabase/functions/revenuecat-webhook`, which skipped its check
   when its own secret was unset, is deleted; a play that deployed it deletes it from the
   project too ([migrations](migrations.md), "Supabase-specific").

## Admins today

Admin access is `profiles.is_admin`, a server-controlled column: nobody can promote themselves.
No API role holds any privilege on `profiles` (`check:rls` fails if one could write it). Grant
it in SQL, as `docs/ENV_SETUP.md` shows.

Two guards check the same two things, a valid session and `is_admin = true`:

- **Admin pages:** `admin/(protected)/layout.tsx` resolves the session with `getUser()`, checks
  `profileStore.isAdmin`, and redirects anyone else to `/admin/login`. Every page under that
  group is guarded by it. It can't use `requireAdmin()`, which answers with a `NextResponse`
  that a layout has no way to return.
- **Admin API routes and server actions:** `requireAdmin()` returns `{ user }`, or a 401/403
  `response` the route returns as it is; an action refuses on it.

The `admin` skill (`.claude/skills/admin/SKILL.md`) is how a screen is added.

## Where this is going: template-web's admin RBAC

The standard is template-web's `src/lib/rbac/`: staff-ness as its own table (`AdminMember`)
rather than a column on the person, an ordered role tier (`read_only ⊂ support ⊂ admin ⊂
super_admin`) plus additive per-person permission grants, a permission catalog, and
`requirePermission(permission)` as the real per-capability gate. The route and action factories
take an `authorize` option so a route can't forget its gate. A guard throws a 401/403 error; it
never builds a response by hand.

This repo hasn't adopted it: `is_admin` is the model. A play that needs more than one admin tier
adopts template-web's `src/lib/rbac/` whole rather than inventing roles on `profiles`.

RBAC governs **staff** only. End users are not a role: what a user may see is decided by
ownership (their own rows), not by an RBAC tier.

## RLS is the backstop, not the boundary

RLS on every table with no policies denies the `anon` and `authenticated` roles everything
([database](database.md)). It protects against the Data API being switched on by accident. It
does not authorize anything the app does; the guards above do.
