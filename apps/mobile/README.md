# @app/mobile — the Expo app

The play's product: a production-ready Expo / React Native app. Supabase for sign-in only;
every read and write goes through the web app's API (`/api/app/v1`, typed by
`@app/contract`). RevenueCat subscriptions, Sentry, PostHog and TanStack Query are all
pre-wired, so you build features, not boilerplate.

> **📦 Part of a monorepo.** This app is the `@app/mobile` workspace of the monorepo
> (root [`README.md`](../../README.md)). Several things live at the repo root and are shared
> with `apps/web`:
>
> - **Install** — `npm install` once, at the root; it installs every workspace.
> - **Database** — the schema is Prisma's, in `apps/web/prisma/schema/`, and the
>   `supabase/` folder (`config.toml` for the local stack) is at the **monorepo root**. Run
>   `supabase start` / `npm run db:reset` there, not here.
> - **Run this app** — `npm run mobile:start` from the root (or `npm start` here).
> - **Checks** — `npm run typecheck`, `npm run mobile:test` and `npm run check:store` run
>   from the root, and CI runs them on every pull request.
>
> Your `.env.local` still lives here in `apps/mobile/` (see `.env.example`).

---

## What's pre-built

| Feature                 | What you get                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| **Auth**                | Passwordless OTP email — no passwords, no user support headaches                              |
| **Social login**        | Google + Apple OAuth wired via Supabase — buttons work, just add credentials                  |
| **Onboarding**          | Name and appearance, saved to the profile through `PATCH /api/app/v1/profile`                 |
| **Auth routing**        | Three-zone guard (public → onboarding → authenticated) — zero manual navigation               |
| **Subscriptions**       | RevenueCat IAP fully wired — `useSubscription().isPremium` anywhere in the app                |
| **Paywall**             | Full upgrade screen — monthly/yearly packages, savings badge, restore, promo code redeem      |
| **Data fetching**       | A typed client over `/api/app/v1` and TanStack Query: paged lists, and every failure shown    |
| **Database**            | Items, tasks, notifications, activity feed — behind the API; RLS on, nothing granted          |
| **Toast system**        | Animated bottom toasts with success/error/info variants — `useToast()` anywhere               |
| **Bottom sheet modals** | All confirmations slide up from the bottom — no jarring center popups                         |
| **Settings**            | Toggle preferences persisted to AsyncStorage — survive app restarts                           |
| **Error tracking**      | Sentry wired and disabled in dev — zero noise during development                              |
| **Analytics**           | PostHog with typed event names + automatic screen tracking on every navigation                |
| **Feature flags**       | `useFeatureFlag('flag')` hook backed by PostHog — safe rollouts from day one                  |
| **Offline UX**          | Mid-session banner + full launch-offline overlay — handles both cases                         |
| **OTA updates**         | expo-updates, fingerprint runtime, `preview` / `production` channels, an EAS publish workflow |
| **Update required**     | Full-screen gate when the server's minimum version is above this build — never blocks offline |
| **CI/CD**               | The root CI: typecheck, lint, Jest, store readiness and more on every push and PR             |
| **Tests**               | Jest + jest-expo suites in `__tests__/`, plus `packages/brand`'s contrast and token tests     |
| **Deep linking**        | App scheme + Android intent filter; universal links are an optional launch step               |
| **Dev skip**            | "Skip to the app" / "Skip to onboarding" on sign-in, in development only — no network call    |
| **Design system**       | `packages/brand` presets (dusk / daylight) + one accent hex, via a ThemeProvider              |
| **Typography**          | Inter + the preset's display face via `@expo-google-fonts` — `<Text>` maps weight to family   |
| **Component library**   | Buttons, cards, lists, sheets, alerts, toasts, skeletons, OTP input, glass tab bar — themed   |
| **Navigation**          | Expo Router file-based routing — add a file, get a screen                                     |
| **i18n**                | i18next with English locale ready — drop a JSON file to add a language                        |
| **RevenueCat webhook**  | `apps/web`'s `/api/webhooks/revenuecat` syncs `plan_type` on every subscription event         |

---

## Stack

From `apps/mobile/package.json`:

| Layer          | Package                                  | Version            |
| -------------- | ---------------------------------------- | ------------------ |
| Framework      | expo                                     | ~55.0.31           |
| Runtime        | react-native / react                     | 0.83.10 / 19.2.0   |
| Language       | TypeScript                               | ~5.9.2             |
| Routing        | expo-router                              | ~55.0.18           |
| Styling        | nativewind + tailwindcss                 | ^4.2.3 / ^3.4.19   |
| Sign-in        | @supabase/supabase-js (auth only)        | ^2.100.0           |
| Data           | @tanstack/react-query + @app/contract    | ^5.99.0            |
| Validation     | zod                                      | ^4.6.5             |
| Subscriptions  | react-native-purchases (+ -ui)           | ^9.15.2            |
| OTA updates    | expo-updates                             | ~55.0.31           |
| Error tracking | @sentry/react-native                     | ~7.11.0            |
| Analytics      | posthog-react-native                     | ^4.39.3            |
| i18n           | i18next + react-i18next                  | ^26.0.4 / ^17.0.2  |
| Animations     | react-native-reanimated                  | 4.2.1              |
| Icons          | lucide-react-native + @expo/vector-icons | ^1.7.0 / ^15.0.2   |
| Testing        | jest + jest-expo                         | ^29.7.0 / ~55.0.22 |

---

## Prerequisites

Install these once on your machine.

```bash
# Node.js 22, 22.18 or a later 22.x (the repo root has an .nvmrc: `nvm use`)
# https://nodejs.org/en/download

# EAS CLI 21 or newer, for builds, updates and submissions (eas.json's cli.version requires it)
npm install -g eas-cli

# Supabase CLI, for the local stack
# macOS:
brew install supabase/tap/supabase
# Windows:
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
# Other: https://supabase.com/docs/guides/cli/getting-started

# Docker Desktop, which the local Supabase stack runs in
# https://www.docker.com/products/docker-desktop
```

There is no global Expo CLI to install: the `expo` package in this workspace carries it, and
`npx expo …` (or `npm run mobile:start` from the root) runs it. The old global `expo-cli`
package is deprecated: don't install it.

For running on a device or simulator:

- **iOS**: Xcode (Mac only) — install from the App Store
- **Android**: Android Studio — install from developer.android.com

---

## Starting a new play

The app is one workspace of the monorepo, so a play starts from the whole repository, not
from this folder.

### Step 1 — Create the play's repository and install

Create the play's repository from the template monorepo (GitHub's **Use this template**, or
clone it and push to a new, empty repository), then, from its root:

```bash
nvm use
npm install      # every workspace, from the committed package-lock.json
```

If `npm install` fails, don't delete `package-lock.json`: it pins every version CI and EAS
Build install, across all four workspaces, and regenerating it pulls whatever is newest.
Instead:

- Check you are on Node 22 at the repository root (`nvm use`), not inside `apps/mobile/`.
- `npm ci` installs exactly what the lockfile pins, from a clean `node_modules/`.
- Add or upgrade an Expo package with `npx expo install <package>` from `apps/mobile/`, so it
  gets the version this SDK supports, and commit the lockfile it changes.

### Step 2 — Rename the app

The whole list, for both apps, is "Renaming for your play" in the root
[`README.md`](../../README.md#renaming-for-your-play). For this app:

- **`app.json`** — `name`, `slug`, `scheme` (and the same scheme in
  `android.intentFilters`), `ios.bundleIdentifier`, `android.package`, `owner` (your Expo
  account or organization), and the `@sentry/react-native/expo` plugin's `organization` and
  `project`. `app.json` ships without `extra.eas.projectId`: `eas init` writes it, then
  `eas update:configure` rewrites `updates.url` to match, in that order
  ([Shipping updates over the air](#shipping-updates-over-the-air)). Universal links
  (`ios.associatedDomains`) are off; turning them on is an optional launch step
  ([`docs/LAUNCH_TODO.md`](../../docs/LAUNCH_TODO.md#optional-universal-links)).
- **`lib/constants.ts`** — `APP_SCHEME` must equal `app.json`'s `scheme`: the Apple and Google
  browser sign-in returns to `<scheme>://auth/callback`. Also `APP_SUPPORT_EMAIL` (the Support
  screen, and the fallback when account deletion fails), `APP_DOCS_URL`, `APP_TAGLINE` and
  `APP_DESCRIPTION`. `APP_NAME` comes from `brand.config.ts`.

### Step 3 — Set your brand

Open `packages/brand/brand.config.ts` (shared with the website) and set:

```ts
preset: 'dusk',        // or 'daylight'
accent: '#6366f1',     // any hex, or 'default' for the preset's own
appName: 'YourApp',
siteName: 'YourApp',
```

Every accent role (fill, text-on-ground, text-on-fill, tints, borders, gradient) is
derived from that one hex with WCAG AA contrast, proven by the contrast test
(`npm test -w @app/brand`). Read colours in components with `useColors()` /
`makeStyles()`. No colour lives anywhere else (a test enforces it).

On a preset change, also set the splash, adaptive-icon and Android status-bar colours in
`app.json` to the new preset's ground: the values are in `brand.config.ts`'s comment. They are
baked into the native build, so they ship with the next store build, not over the air.

### Step 4 — Replace the app icons

Drop your own images into `assets/`, under the names `app.json` uses:

| File              | Size                       | Used for                                                                       |
| ----------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `icon.png`        | 1024×1024                  | App Store / Play Store icon, the Android adaptive-icon foreground, web favicon |
| `splash-icon.png` | 1024×1024 (shown 200 wide) | The splash screen's centre image (`expo-splash-screen` → `imageWidth`)         |

Tip: [appicon.co](https://appicon.co) — upload one 1024×1024 PNG and it exports all required sizes.

### Step 5 — Start Supabase locally

From the repository root, with Docker running, follow the root
[Quickstart](../../README.md#quickstart): copy both env files, then

```bash
supabase start
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres
export DIRECT_URL=$DATABASE_URL
npm run db:reset   # resets the stack, applies the Prisma migrations
```

`supabase start`, and `supabase status` any time after, prints the local API URL,
`http://127.0.0.1:55321` (the port is `[api]` in `supabase/config.toml`), and the
**publishable key** (`sb_publishable_…`). Those two are all this app needs.

### Step 6 — Fill in your .env.local

`apps/mobile/.env.local`, copied from `.env.example` in the quickstart:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<the publishable key from supabase status>
# apps/web: every read and write the app makes goes through its /api/app/v1 (npm run web:dev)
EXPO_PUBLIC_SITE_URL=http://127.0.0.1:3000

# Leave empty — these degrade gracefully when unconfigured:
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_POSTHOG_KEY=
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
EXPO_PUBLIC_RESEARCH_PRODUCT_KEY=
```

`127.0.0.1` is your computer only from the iOS Simulator. On an Android emulator use
`10.0.2.2`, and on a real phone your computer's LAN address, in both URLs.

`.env.local` is gitignored and never committed. `lib/env.ts` is the full list of what the app
reads; an empty value or a `REPLACE_…` placeholder means "not configured", and that feature
switches itself off instead of crashing. For builds, see
[Environment variables](#environment-variables).

### Step 7 — Run the app

```bash
npm run web:dev        # from the root: the API the app reads, on :3000
npm run mobile:start   # from the root (or `npx expo start` here)
```

`expo-dev-client` is installed, so the dev server serves a **development build**: the app's
native code, built once, loading its JavaScript from Metro. Build it on your machine with
`npx expo run:ios` or `npx expo run:android` (from `apps/mobile`), or on EAS for a phone with
the `development` profile (`eas build --profile development`). Build it again after any native
change. Then:

- Press `i` → the iOS simulator (Mac only), `a` → the Android emulator
- Scan the QR code → a phone with the development build installed
- Press `s` → switch to Expo Go, for screens that need no native module Expo Go lacks

**Signing in locally:** enter any email; no real email is sent. The six-digit code lands in the
local mail catcher at <http://127.0.0.1:55324> (`[local_smtp]` in `supabase/config.toml`).
Apple and Google sign-in need the hosted setup in
[`docs/LAUNCH_TODO.md`](../../docs/LAUNCH_TODO.md#sign-in).

> RevenueCat requires a native build: test purchases in a development build, never Expo Go.

---

## How the app is structured

```
app/
  _layout.tsx          Root layout — all providers + auth routing
  index.tsx            Public landing page
  upgrade.tsx          Paywall (always accessible)
  privacy.tsx          Privacy policy placeholder
  terms.tsx            Terms of service placeholder
  settings.tsx         Preferences — persisted to AsyncStorage
  support.tsx          FAQ accordion + contact links
  (auth)/
    login.tsx          OTP email + Google/Apple OAuth
  (onboarding)/
    index.tsx          Name, then appearance — runs once after the first sign-in
  (tabs)/
    _layout.tsx        Tab bar config
    index.tsx          Home — stats, recent items, activity feed
    explore.tsx        Search + filter all items
    activity.tsx       Notifications with read/unread state
    profile.tsx        Profile, subscription badge, sign out
  detail/
    [id].tsx           Item detail — tasks, metrics, status

contexts/
  SubscriptionContext.tsx   isPremium + purchase/restore/refresh
  ThemeContext.tsx          The brand theme: useTheme(), useColors(), the light/dark choice
  ToastContext.tsx          useToast() — show toasts from anywhere

hooks/                 Each wraps lib/api.ts in TanStack Query; lists page with the API's cursor
  useItems.ts          Items list + single item + item tasks
  useNotifications.ts  User notifications
  useProfile.ts        Authenticated user profile
  useActivityFeed.ts   Activity feed (optional item filter)

lib/
  constants.ts         🏷️ APP_NAME, APP_SCHEME, support contacts — rebrand here
  account.ts           In-app account deletion (DELETE /api/app/v1/account)
  lifecycle.ts         Tells the web app a session exists: user_signed_up, last seen
  themedStyles.ts      makeStyles / useThemedStyles / makeThemed, cached per palette
  themePref.ts         Stored light/dark/system choice, preloaded before first paint
  motion.ts            Springs, easings, enter(i) stagger, shake — from the preset
  haptics.ts           Meaning-named haptics (press, select, snap, success…)
  fonts.ts             Preset font files for expo-font
  typography.ts        Role type scale + weight → family mapping
  featureFlags.ts      useFeatureFlag() backed by PostHog
  api.ts               The typed client over /api/app/v1 (@app/contract): bearer token, typed errors
  queryClient.ts       TanStack Query: retries what can succeed, refetches on reconnect
  env.ts               Every EXPO_PUBLIC_* variable, validated with Zod (the only process.env reader)
  logger/              log.info/warn/error: console in dev, Sentry in release, secrets redacted
  supabase.ts          Supabase, typed to sign-in only (the one file allowed @supabase/*)
  purchases.ts         RevenueCat helpers
  analytics.ts         PostHog wrapper with typed event names
  appConfig.ts         GET /api/app/v1/config, through lib/api.ts: the minimum-version gate's rule
  mockData.ts          Demo values with no API source yet, development builds only (devPlaceholders.ts)
  paywall.ts           Plans read from the store's offerings (price, period, trial)
  utils.ts             getInitials, formatDate, clamp, etc.
  i18n.ts              i18next init + language switching

components/
  ui/
    Text.tsx           Role type scale (variant), tones, weight → family, tabular numbers
    Button.tsx         primary / secondary / outline / ghost / destructive; 40 / 50 / 56
    Card.tsx           standard / raised / well / selected / hero
    List.tsx           ListRow (row-as-card), ListGroup, Section, SectionHeader
    PageHeader.tsx     Round back / close, ScreenTitle; Screen.tsx frames a screen
    Sheet.tsx          Throwable, keyboard-aware bottom sheet (RN Modal)
    AppModal.tsx       AlertModal (floating card) + ActionSheet
    CodeInput.tsx      Six boxes over one input: autofill and paste
    EmptyState, Skeleton, SegmentedControl, Toggle, SelectionRow, …
    Marks.tsx          LogoMark, Avatar, ProgressBar, Glow
  motion/              PressableScale, FadeSlideIn / StaggerList, NumberTicker
  onboarding/Shell.tsx Progress dots, floating CTA, refusal shake
  QueryError.tsx       The failed state for every query: not connected, offline, signed out, Try again
  TabBar.tsx           Floating glass tab bar with a sliding lens
  OfflineBanner.tsx    Pill under the status bar on a mid-session drop
  OfflineOverlay.tsx   Full-screen state when the app launches offline
  UpdateRequiredGate.tsx  Full-screen "Update required" below the minimum version

.eas/workflows/
  publish-update.yml   Publishes an OTA update on EAS, with its Sentry source maps
fingerprint.config.js  What in eas.json changes the runtime version (not submit, not formatting)
eas.json               Build profiles: each names its EAS environment, and holds no values

__tests__/             Jest suites: api, account, appConfig, env, fingerprintConfig, logger,
                       redact, theme, utils (npm run mobile:test also runs packages/brand's)
```

Outside this folder, at the repository root:

```
packages/contract/          The Zod schemas for /api/app/v1, shared with the web app
packages/brand/             brand.config.ts: preset, accent and names for both apps
apps/web/src/app/api/app/v1/  The routes this app calls
apps/web/prisma/schema/     The schema (Prisma), one file per domain, and its migrations
supabase/
  config.toml               The local Supabase stack (ports, auth, the avatar bucket)
  migrations/               Frozen history, inside the Prisma baseline
.github/workflows/ci.yml    Every gate (typecheck, lint, Jest, check:store, …) on every push and PR
```

---

## How auth routing works

```
isAuthed = false
  → landing page + login

isAuthed = true, onboarding not done
  → onboarding screen

isAuthed = true, onboarding done
  → tabs + all authenticated screens
```

Handled by `Stack.Protected` in `_layout.tsx` — no manual navigation needed. Auth state comes from Supabase session; onboarding state from `user.user_metadata.onboarding_completed`.

---

## How data fetching works

The app never reads a table ([docs/rules/mobile-data.md](../../docs/rules/mobile-data.md)).
Every screen uses a TanStack Query hook, and every hook calls `/api/app/v1` through
`lib/api.ts`, which sends the session's token, parses the response with `@app/contract`, and
throws a typed `ApiError` on any failure. A screen shows loading, empty and failed as three
states; `components/QueryError.tsx` is the failed one (not connected, offline, session over,
or the API's message with Try again).

```ts
// hooks/useItems.ts pattern: a page at a time, with the API's cursor
export function useItems() {
	return useInfiniteQuery({
		queryKey: ['items'],
		queryFn: ({ pageParam, signal }) =>
			api('listItems', { query: { limit: 20, cursor: pageParam }, signal }),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.next_cursor ?? undefined,
		select: (data) => data.pages.flatMap((page) => page.items.map(toItemSummary))
	})
}
```

With no `EXPO_PUBLIC_SITE_URL`, every screen says "Not connected yet" (and, in a development
build, which variable to set) instead of showing made-up rows.

Pull-to-refresh invalidates the relevant query keys:

```ts
await queryClient.invalidateQueries({ queryKey: ['items'] })
```

---

## How to add features

### Add a new tab

1. Create `app/(tabs)/newscreen.tsx`
2. Add to `app/(tabs)/_layout.tsx`:

```tsx
<Tabs.Screen name="newscreen" options={{ tabBarLabel: 'Label', tabBarIcon: ... }} />
```

### Add a new authenticated screen

1. Create `app/myscreen.tsx`
2. Register in the authenticated `Stack.Protected` block in `app/_layout.tsx`
3. Navigate: `router.push('/myscreen')`

### Gate content behind subscription

```tsx
const { isPremium } = useSubscription()

if (!isPremium) return router.replace('/upgrade')
```

### Add a data hook

New data is a route first: its schemas and an entry in `packages/contract/src/v1/endpoints.ts`,
then the route in `apps/web/src/app/api/app/v1/` (`createAppRoute`). The hook calls it by name:

```ts
export function useMyThings() {
	return useQuery({
		queryKey: ['my_things'],
		queryFn: ({ signal }) => api('listMyThings', { signal })
	})
}
```

It never catches to return `[]`: the screen renders the error state instead.

### Add a typed analytics event

Open `lib/analytics.ts`, add to `EventName`:

```ts
| 'your_event_name'
```

Then call it:

```ts
track('your_event_name', { property: 'value' })
```

### Show a toast

```tsx
const { showToast } = useToast()
showToast('Saved successfully', 'success')
showToast('Something went wrong', 'error')
```

### Use a feature flag

```tsx
import { useFeatureFlag } from '@/lib/featureFlags'

const showNewUI = useFeatureFlag('new_ui', false)
```

---

## Environment variables

**No key is ever pasted into a committed file.** Not `eas.json`, not `app.json`. A committed
file is copied into every clone and every fork, and the pre-commit secret scanner rejects keys
such as PostHog's `phc_…` anyway. Values live in two places:

| Where                         | Used by                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| `.env.local` (gitignored)     | `npx expo start`, including development builds (they load JS from Metro) |
| **EAS environment variables** | `eas build` and `eas update`, per environment                            |

Each build profile in `eas.json` names its EAS environment (`"environment": "production"`) and
carries **no `env` values**. EAS CLI merges a profile's `env` _over_ the EAS environment
(`{ ...eas, ...profile.env }` in `evaluateConfigWithEnvVarsAsync`), so a placeholder left in
`eas.json` would ship instead of the real value you set on EAS.

### Set them once per environment

Everything named `EXPO_PUBLIC_…` is compiled into the app and readable by anyone who downloads
it, so it is `plaintext`, and nothing secret ever gets that prefix.

```bash
# eas-cli 21 or newer, which eas.json's cli.version already requires.
# Repeat for --environment preview with your staging values.
eas env:set --environment production --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co
eas env:set --environment production --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_xxx
eas env:set --environment production --visibility plaintext \
  --name EXPO_PUBLIC_SITE_URL --value https://your-play.com
eas env:set --environment production --visibility plaintext \
  --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_xxxx
eas env:set --environment production --visibility plaintext \
  --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value goog_xxxx
eas env:set --environment production --visibility plaintext \
  --name EXPO_PUBLIC_SENTRY_DSN --value https://xxxx@o0.ingest.sentry.io/0
eas env:set --environment production --visibility plaintext \
  --name EXPO_PUBLIC_POSTHOG_KEY --value phc_xxxx

# Build-time only, never in the app: Sentry's source-map upload token. No --value:
# EAS CLI asks for it with the input hidden, so it stays out of your shell history.
eas env:set --environment preview --environment production --visibility secret \
  --name SENTRY_AUTH_TOKEN

eas env:list --environment production   # check
```

Run these yourself, in your own terminal. Never ask an agent to run them with a real value:
the command lands in its transcript ([secrets](../../docs/rules/secrets.md)).

- **`SENTRY_AUTH_TOKEN`** must be `secret` and must not appear in `eas.json`: EAS does not expand
  `$VAR` there, so `"SENTRY_AUTH_TOKEN": "$SENTRY_AUTH_TOKEN"` is the literal string. Until Sentry
  is set up, set `SENTRY_DISABLE_AUTO_UPLOAD=true` instead, or the iOS build fails at the upload.
- **EAS Update** uses the same variables: `eas update --environment production`, or the
  publish workflow, which takes the environment from its target and reads `SENTRY_AUTH_TOKEN`
  there to upload each update's source maps.
- **Local release builds** (Xcode, Android Studio, `npx expo run:ios --configuration Release`):
  run `eas env:pull --environment production --path .env.production.local` first. Expo reads
  `.env.production.local` ahead of `.env.local` when it bundles for release. Secret variables are
  not pulled; export `SENTRY_AUTH_TOKEN` in your shell.
- **Missing value:** the app still starts, and that service reports itself not configured
  (Supabase off, no purchases, no crash reports, no analytics, account deletion shows the
  support email).

---

## RevenueCat setup

1. Create products in App Store Connect + Google Play Console
2. Go to [app.revenuecat.com](https://app.revenuecat.com) → create project
3. Create an entitlement called `premium`, attach your products
4. Create a `default` offering with monthly + yearly packages
5. Get your public SDK keys → add to `.env.local`, and to EAS as in
   [Environment variables](#environment-variables):

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxxx
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxxx
```

If your entitlement name differs from `premium`, update `lib/purchases.ts`:

```ts
export const ENTITLEMENT_ID = 'your_entitlement_name'
```

---

## Deploying Supabase to production

The database is migrated from `main` by the repo's `deploy-migrations.yml` workflow, never by
hand: set the `production-database` environment and the `PRISMA_BASELINE_RESOLVED` variable
(`docs/rules/migrations.md` at the repo root).

Set the production URL and publishable key as EAS environment variables (see
[Environment variables](#environment-variables)), never in `eas.json`:

```bash
eas env:set --environment production --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co
eas env:set --environment production --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_xxx
```

Then set up sign-in on the hosted project: the email provider with a six-digit code in its
templates, Apple and Google, and the app's `<scheme>://auth/callback` redirect. The steps are
under "Sign-in" in [`docs/LAUNCH_TODO.md`](../../docs/LAUNCH_TODO.md#sign-in).

---

## Shipping updates over the air

Most changes ship as an OTA update, not a store build: [docs/rules/ota.md](../../docs/rules/ota.md)
says which is which. An update reaches only binaries built with `expo-updates` configured, so
**your first store build is the one that switches OTA on**.

Once per play, in this order (`app.json` ships without `extra.eas.projectId`, so `eas init`
has nothing to overwrite):

```bash
cd apps/mobile
eas init                 # creates and links the EAS project: writes extra.eas.projectId
eas update:configure     # points updates.url at it (keeps the fingerprint runtime)
```

Then, in the EAS project's settings, link the GitHub repository with `apps/mobile` as the base
directory, so the publish workflow can run from `main` itself.

Every update, after `npm run check:store` and the `store-review` skill, from `main`:

```bash
cd apps/mobile
eas workflow:run .eas/workflows/publish-update.yml --ref main \
  -F target=preview -F message="fix(paywall): show the yearly price per month"
# confirm it on a preview build, then target=production-rollout (10%), and widen:
eas update:edit <group-id> --rollout-percentage=100
```

Rollback: `eas update:republish --group <last-good-group-id>`, or
`eas update:roll-back-to-embedded --channel production --runtime-version <hash>`.

**Local builds** (Xcode, Android Studio) receive updates too: they ask the `production` channel
set in `app.json` → `updates.requestHeaders`. Run `eas channel:create production` once if no EAS
build ever created it, and check the built app as [docs/rules/ota.md](../../docs/rules/ota.md#local-builds)
shows.

---

## Building for the stores

```bash
# First time only: eas login, then eas init and eas update:configure (above)
eas login

# Development build (expo-dev-client; loads its JavaScript from Metro, gets no updates)
eas build --platform ios --profile development

# Test build (Android APK, receives updates on the preview channel)
eas build --platform android --profile preview

# Production
eas build --platform all --profile production

# Submit
eas submit --platform android
eas submit --platform ios
```

---

## Checklist before shipping

### Identity

- [ ] `app.json` — `name`, `slug`, `scheme` (+ `android.intentFilters`), `bundleIdentifier`, `package`, `owner`
- [ ] Optional: universal links, with the two files the site serves ([LAUNCH_TODO](../../docs/LAUNCH_TODO.md#optional-universal-links))
- [ ] `lib/constants.ts` — `APP_SCHEME` (equal to `app.json`'s `scheme`), `APP_TAGLINE`, `APP_DESCRIPTION`, `APP_SUPPORT_EMAIL`, `APP_DOCS_URL`
- [ ] `assets/icon.png` replaced (1024×1024; also the Android adaptive-icon foreground)
- [ ] `assets/splash-icon.png` replaced

### Branding

- [ ] `packages/brand/brand.config.ts` — `preset`, `accent`, `appName`, `siteName`
- [ ] `app.json` — splash, adaptive-icon and status-bar background match the preset's ground (values in `brand.config.ts`)
- [ ] `app/upgrade.tsx` — `PRO_FEATURES` list updated

### Legal

- [ ] Real privacy policy in `app/privacy.tsx`
- [ ] Real terms of service in `app/terms.tsx`

### Backend

- [ ] Supabase production project created, and migrated by `deploy-migrations.yml` (`PRISMA_BASELINE_RESOLVED`)
- [ ] Production Supabase URL + publishable key set as EAS `production` environment variables
- [ ] `EXPO_PUBLIC_SITE_URL` set for `preview` and `production` (every data call goes to its `/api/app/v1`)
- [ ] Sign-in set up on the hosted project: email code, Apple, Google, the `<scheme>://auth/callback` redirect ([LAUNCH_TODO](../../docs/LAUNCH_TODO.md#sign-in))

### Subscriptions

- [ ] Products created in App Store Connect + Google Play Console
- [ ] RevenueCat project set up, `premium` entitlement + default offering created
- [ ] RevenueCat public SDK keys set as EAS environment variables
- [ ] Tested purchase + restore on a real device

### Observability

- [ ] Sentry DSN set as an EAS environment variable (+ `app.json` plugin `project` + `organization`)
- [ ] `SENTRY_AUTH_TOKEN` set on EAS with `--visibility secret` (never in `eas.json`)
- [ ] PostHog project key set as an EAS environment variable
- [ ] `eas env:list --environment production` shows every variable above

### Updates

- [ ] `eas init`, then `eas update:configure`, run and committed: `extra.eas.projectId` and `updates.url` hold your EAS project id
- [ ] EAS project linked to the GitHub repository, base directory `apps/mobile`
- [ ] `SENTRY_AUTH_TOKEN` set on EAS for `preview` and `production` (the publish workflow uploads maps with it)
- [ ] Store listing URLs to hand for `/api/app/v1/config` once the app is live

### Final, from the repository root

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm test` — all tests passing
- [ ] `npm run check:store -- --strict` and the `store-review` skill — no blocker
- [ ] Full flow tested: landing → login → onboarding → home → profile → upgrade → sign out

---

## Common issues

**`supabase start` fails**
Make sure Docker Desktop is running. Try `supabase stop` then `supabase start`.

**RevenueCat not working in Expo Go**
Expected — RevenueCat requires native. Use `npx expo run:android` / `npx expo run:ios`.

**App shows blank screen on launch**
Check `.env.local` has a valid `EXPO_PUBLIC_SUPABASE_URL` and key, and `supabase start` is running.

**TypeScript errors after changes**

```bash
npm run typecheck
```
