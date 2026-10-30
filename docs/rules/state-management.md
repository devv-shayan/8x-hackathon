# State management

## Mobile (`apps/mobile`)

- **Server state is TanStack Query.** One `QueryClient`, created once in
  `apps/mobile/lib/queryClient.ts` and provided in `app/_layout.tsx`. Data hooks live in
  `apps/mobile/hooks/` (`useProfile`, `useItems`, …) and wrap `useQuery` / `useMutation`.
  Screens call hooks; they don't fetch.
- **A hook's query function throws on failure.** TanStack Query's error state is how a screen
  learns a request failed; a query function that catches and returns `[]` turns an outage into
  "nothing here yet" ([error handling](error-handling.md)). Every query function calls the
  typed API client, which throws on any failure and parses the response with the shared
  contract ([mobile data](mobile-data.md)). Lists are `useInfiniteQuery` over the API's
  cursor, and signing out clears the cache, so nothing one person loaded shows to the next.
- **After a mutation, invalidate the queries it changed** rather than patching several caches
  by hand.
- **Entitlement is not client state you own.** `SubscriptionContext` reads RevenueCat's
  `CustomerInfo` to decide what the UI shows, but the server decides what a person is entitled
  to (`profiles.plan_type`, written by the RevenueCat webhook). Never write entitlement from
  the app ([database](database.md)).
- **Contexts are for app-wide concerns** that aren't server data: the toast queue, the
  subscription state. Not a place to cache fetched data.
- **Client-only UI state** (a modal, a wizard step, a selected tab) is local `useState` /
  `useReducer`, or a route param when it should survive navigation.

## Web (`apps/web`)

- **Server Components load; route handlers and server actions change.** Keep Client Component
  boundaries small and do data access on the server.
- **No client data library by default.** When a Client Component genuinely needs to fetch or
  mutate after the first render, use TanStack Query, with the `QueryClient` created inside a
  `useState` initializer, never at module scope: a module-level client on the server is shared
  across requests and leaks one person's cached data into another's response.
- **Client-only UI state** is local state or URL search params.

## Neither

No global store by default. Add one only when shared client state genuinely can't be a URL
param, a route param or a context; Zustand is the recommended pick then, added deliberately.
