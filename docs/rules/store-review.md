# Store review

> **Status.** The `store-review` skill (`.claude/skills/store-review/SKILL.md`) is the
> procedure, and `npm run check:store` (`scripts/check-store-readiness.mjs`) is its mechanical
> half, run by CI and `local-review` on every pull request. `ship` and `local-review` invoke the
> skill whenever `apps/mobile/` or `packages/` changed.

Apps get rejected for the thing nobody checked. Check it here, before a release, not after a
rejection.

The example this rule exists for: ads were added to an app, but the App Tracking Transparency
prompt was not shown at launch. Apple rejected the update: the app shows ads, and the reviewer
never saw the tracking permission request. Nobody had looked, because nothing made anyone look.

## When

Before **any** OTA update to `production`, any store build, and any submission. `ship` and
`local-review` run it whenever `apps/mobile` or `packages/` changed, and CI runs `check:store`
on every pull request.

## Two halves

- **`npm run check:store`** is the mechanical half: the rules below that can be decided by
  reading files, run as their mobile standards (`STORE_RULES` in
  `scripts/check-store-readiness.mjs`): purpose strings, the privacy manifest, minimal Android
  permissions, ATT when an ads SDK is present, in-app account deletion, paywall legal links,
  Sign in with Apple beside any other third-party login, and mock data in development builds
  only. It fails the build. An ads or attribution SDK in `apps/mobile/package.json` without
  `expo-tracking-transparency` fails CI. Whether OTA updates are configured is a
  `check:standards` check (`ota-configured`, [OTA updates](ota.md)), not one of these.
- **The `store-review` skill** is the judgement half. It runs `check:store`, then reads the diff
  since the last store release and applies the rule table. Whether a change "alters what the
  app is" is not something a script can decide.

## The steps

1. **Scope the change.** The diff since the last store release:
   `git diff <last-release-tag>...HEAD -- apps/mobile packages` (no tag yet:
   `origin/main...HEAD`). Classify it: **OTA** or **needs a build** ([OTA updates](ota.md)).
   Say which, and why.
2. **Run the mechanical gate.** `npm run check:store`. Any failure blocks. Show the real
   output.
3. **Apply the rule table.** For every row whose trigger appears in the diff, confirm the
   requirement is met. When a guideline's wording matters, read the current text rather than
   relying on memory: <https://developer.apple.com/app-store/review/guidelines/> and
   <https://play.google.com/about/developer-content-policy/>.
4. **Report** in the format below.

## The rule table

| Trigger in the diff                                                                                                                                                                                                    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Guideline                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| **An ads or attribution SDK** (`react-native-google-mobile-ads`, AppLovin, Unity Ads, ironSource, Meta Audience Network / `react-native-fbsdk-next`, AppsFlyer, Adjust, Branch with IDFA, Singular, TikTok events SDK) | `expo-tracking-transparency` installed with an honest `NSUserTrackingUsageDescription`; the prompt is **requested before the SDK initialises or the first ad loads**, early in the session; no feature is gated on accepting it; no pre-prompt that pressures or rewards. EEA/UK: a Google-certified consent message (UMP/CMP) before ads. Privacy manifest declares tracking domains. App Store privacy labels say "used to track you". Android: `com.google.android.gms.permission.AD_ID` and the Play Console Advertising ID declaration; Data safety updated. **Needs a build.** | Apple **5.1.2**; Play Ads + User Data                    |
| **A permission-using module** (camera, photos, microphone, location, contacts, calendar, Bluetooth, health, motion, Face ID, notifications)                                                                            | Purpose string specific to what the app does ("to scan receipts", not "to access the camera"); requested at the moment it is needed, never at launch; the app still works when denied. Android: the narrowest permission, the system photo picker over media permissions. **Needs a build.**                                                                                                                                                                                                                                                                                         | Apple **5.1.1**; Play Permissions, Photo and Video       |
| **Paywall or purchase code**                                                                                                                                                                                           | Price, billing period and what is unlocked are clear before purchase; trial length and what happens after it; **Restore purchases**; **links to Terms of Use (EULA) and Privacy Policy on the paywall**; auto-renew disclosure; digital goods only through in-app purchase, no link out to buy.                                                                                                                                                                                                                                                                                      | Apple **3.1.1**, **3.1.2**; Play Payments, Subscriptions |
| **A login method** added or changed                                                                                                                                                                                    | If any third-party login (Google, Facebook, …) is offered, Sign in with Apple is offered too, natively (`expo-apple-authentication`) on iOS.                                                                                                                                                                                                                                                                                                                                                                                                                                         | Apple **4.8**                                            |
| **Account creation** exists                                                                                                                                                                                            | Delete account reachable **in the app**, and it actually deletes (or starts deletion of) the account and its data; Play also needs a web deletion link (`/delete-account`).                                                                                                                                                                                                                                                                                                                                                                                                          | Apple **5.1.1(v)**; Play account deletion                |
| **User-generated content** (posts, comments, chat, uploaded images, public profiles)                                                                                                                                   | Report, block, filter, a way to contact the developer, terms the user accepts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Apple **1.2**                                            |
| **A feature flag, remote config or OTA that changes what a reviewer can see**                                                                                                                                          | Nothing is hidden from review. Features off during review and on afterwards are a rejection, or worse, removal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Apple **2.3.1**                                          |
| **OTA content**                                                                                                                                                                                                        | Fixes and features within the reviewed purpose only; no new app category, no storefront, no bypassing review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Apple **2.5.2**                                          |
| **Any new third-party SDK**                                                                                                                                                                                            | Privacy manifest entries and required-reason APIs; App Store privacy labels and Play Data safety form updated to what the SDK collects. **NEEDS A HUMAN** for the forms.                                                                                                                                                                                                                                                                                                                                                                                                             | Apple **5.1.1**, privacy manifests; Play User Data       |
| **Push notifications**                                                                                                                                                                                                 | Permission requested in context; no marketing pushes without explicit opt-in; the app works without push.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Apple **4.5.4**                                          |
| **A rating prompt**                                                                                                                                                                                                    | Only the system API (`expo-store-review`); no custom "rate us 5 stars" flow, no incentive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Apple **5.6.1**                                          |
| **Placeholder content, "coming soon", mock data, dead links**                                                                                                                                                          | None in a production build (`mockData.ts` not imported).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Apple **2.1**                                            |
| **Login required to use the app**                                                                                                                                                                                      | A demo account in the App Review notes. **NEEDS A HUMAN.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Apple **2.1**                                            |
| **Health, medical, financial or legal claims**                                                                                                                                                                         | Flag for a human.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Apple **1.4**, **5.1.3**                                 |
| **Audience includes children**                                                                                                                                                                                         | Kids category / Play Families rules; no third-party ads or analytics that are not certified for it. Flag for a human.                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Apple **1.3**; Play Families                             |

PostHog, Sentry and RevenueCat, as the template configures them, do **not** track in Apple's
sense (no IDFA, no sharing with data brokers), so they do not need the ATT prompt on their own.
They do belong in the privacy labels ([permissions and privacy](permissions-and-privacy.md)).
Turning on RevenueCat's `collectDeviceIdentifiers()` or an ad-network integration changes that:
treat it as the first row.

## The verdict

A table, one row per triggered rule, then exactly one verdict. Never "probably fine".

```markdown
| Trigger              | Requirement                                   | Met? | Guideline | Fix                             |
| -------------------- | --------------------------------------------- | ---- | --------- | ------------------------------- |
| Paywall copy changed | Terms of Use + Privacy links, Restore present | yes  | 3.1.2     |                                 |
| `expo-camera` added  | Specific purpose string, asked in context     | no   | 5.1.1     | Set the plugin's purpose string |

**Verdict: FIX FIRST** (needs a store build: `expo-camera` adds native code)

- Set a specific camera purpose string in the `expo-camera` config plugin.
```

- **SHIP**: OTA or store build, as classified in step 1.
- **FIX FIRST**: the list of what blocks, each with its fix.
- **NEEDS A HUMAN**: what lives outside the repo and a person must do or confirm: App Store
  Connect privacy labels, the Play Data safety form, review notes, a demo account, age rating,
  anything in rows marked "flag for a human".

## The template's own state

Every play cloned from this template inherits these, so they are fixed here rather than in
each play:

- In-app account deletion, the paywall's Terms of Use and Privacy Policy links, iOS purpose
  strings for `expo-image-picker`, Android storage permissions removed, an iOS privacy
  manifest, and `mockData.ts` kept out of release builds. `check:store` holds each one.
- The unconfigured-Supabase `200 null` fallback is gone: an unconfigured build says it isn't
  connected, and sign-in says it isn't set up.
- Native Sign in with Apple on iOS (`expo-apple-authentication`), beside Google: the
  login-method row is met, and `check:store` checks it as `sign-in-with-apple`.

## The reviewer account

Both stores sign in to the app before they approve it, so a build that needs a login needs a
reviewer account, entered in App Store Connect (App Review Information → Sign-in required) and
in Play Console (App content → App access).

- Use a dedicated account on a domain you own, e.g. `reviewer@yourapp.com`. Never a personal
  address, and never a real user's account.
- Sign-in here is an emailed code, which a reviewer cannot receive. Give that account a way in
  that works without the inbox (for example a password set on it in Supabase Auth, plus a
  sign-in path that accepts it), and say exactly how in the review notes.
- Give it the state a reviewer needs to see every gated screen: premium granted (an admin
  grant, not a real purchase), onboarding done, sample content present.
- The password lives in the store consoles and your password manager only, never in this
  repo, a log or a chat.
- Record the account's email (not its password) and what it can see in
  `docs/memory/` so the next session finds it when it reaches the submission step.
