# OTA updates: the default way to ship a mobile change

A store build means days in review. An OTA update (EAS Update) reaches users in minutes.
**Ship every mobile change as an OTA update unless it cannot be one, or must not be one.** Do
not ask the developer to build and submit when an update would do.

An update only reaches binaries that have `expo-updates` with this configuration, so **the
first store build of a play is the one that switches OTA on**. Everything installed before it
can only be updated through the store.

## The decision, for every mobile change

```
Did anything native change?
  - a dependency with native code added, removed or upgraded (anything with a config
    plugin, anything with ios/ or android/ in its package)
  - app.json / app.config native fields: plugins, permissions, infoPlist, entitlements,
    icons, splash, bundle id / package, scheme, associated domains, version
  - an eas.json build profile or its cli block (the submit block is not native)
  - an Expo SDK or React Native upgrade, or the expo-updates config itself
  Fastest check: the runtime version differs from the latest store build's.

  YES -> it needs a store build and review. Say so, and say which change forced it.
  NO  -> it ships as an OTA update. Do not ask the developer to build.

Then, for an OTA, is it ALLOWED? It is not if it:
  - changes what the app is, or adds a new product category (Apple 2.5.2)
  - adds purchasable digital content outside in-app purchase (3.1.1)
  - turns on a feature that was hidden from App Review (2.3.1)
  - needs a new permission, a new privacy disclosure, or a new tracking prompt
  Any of these -> store build and review, even though it is technically OTA-able.
```

The fastest check, from `apps/mobile`:

```bash
npx expo-updates runtimeversion:resolve --platform ios   # this checkout's runtime version
eas build:list --platform ios --channel production --status finished \
  --runtime-version <that hash>                          # a store build that can take it?
eas fingerprint:compare --build-id <last store build> --environment production  # what differs
```

No finished `production` build with that runtime version means no installed app can take the
update: it needs a store build. Run it for `android` too; the two platforms fingerprint
separately. A build made outside EAS isn't in `build:list`: record its runtime version when you
ship it (see [local builds](#local-builds)).

Say which it is in the PR, in so many words: "ships as an OTA update", or "needs a store build
because <change>" ([pull requests](pull-requests.md)).

## How it is configured

```json
// apps/mobile/app.json (excerpt)
"runtimeVersion": { "policy": "fingerprint" },
"updates": {
  "url": "https://u.expo.dev/REPLACE_WITH_YOUR_EAS_PROJECT_ID",
  "checkAutomatically": "ON_LOAD",
  "fallbackToCacheTimeout": 0,
  "requestHeaders": { "expo-channel-name": "production" }
}
```

```json
// apps/mobile/eas.json (excerpt): every profile that produces a release build has a channel
"preview":    { "channel": "preview",    "distribution": "internal", "environment": "preview" },
"production": { "channel": "production", "autoIncrement": true,      "environment": "production" }
```

- **`fingerprint`, not `appVersion`.** The fingerprint policy changes the runtime version
  automatically whenever native code changes, so an update can never be served to a binary
  that lacks the native module it needs. `appVersion` depends on someone remembering to bump
  the version on every native change, and at 11pm nobody will.
- **`checkAutomatically: ON_LOAD` and `fallbackToCacheTimeout: 0`**: every launch asks for an
  update, and never waits for the answer. A downloaded update applies on the next launch.
- **A channel per release profile.** `development` has none on purpose: a development build
  loads its JavaScript from Metro. A release build without a channel never receives an update,
  and `check:standards` (`ota-configured`) fails on one.
- **`updates.url`** carries the EAS project id. `app.json` ships without
  `extra.eas.projectId`; once per play, `eas init` writes it, and `eas update:configure` then
  rewrites `updates.url` to match, in that order. It keeps `runtimeVersion` as it is, but adds
  `"channel": "development"` to the `development` profile; delete that line, or leave it, it
  does no harm.
- **`requestHeaders.expo-channel-name`** is for builds made outside EAS. EAS Build writes the
  profile's `channel` over it, so an EAS preview build asks the `preview` channel.

### What changes the runtime version

The fingerprint hashes everything native: the autolinked native modules, the evaluated app
config (so every `app.json` field above), the config plugins' code, and `eas.json`. By default
it hashes `eas.json` byte for byte, which means a Prettier reformat or an App Store Connect id
added to `submit` gives the next update a runtime version no installed build has: it publishes
cleanly and reaches nobody.

So `apps/mobile/fingerprint.config.js` hashes `eas.json` as data instead: every build profile
and the `cli` block, whatever the key order and whitespace, and not `submit`, which configures
`eas submit` and never reaches a binary. Measured with `@expo/fingerprint` 0.16.7:

| Edit to `eas.json`                                 | Runtime version |
| -------------------------------------------------- | --------------- |
| Whitespace, indentation, key order                 | unchanged       |
| `submit.production.ios.ascAppId` added             | unchanged       |
| A build profile's `channel`, `node` or `ios.image` | changes         |
| A new build profile                                | changes         |
| `cli.version`                                      | changes         |
| `eas.json` no longer valid JSON                    | changes         |

Never add `eas.json` to a `.fingerprintignore`: measured, that also hides an Xcode image change
in a build profile. `apps/mobile/__tests__/fingerprintConfig.test.ts` fails if the config ever
leaves out more than `submit`.

### Local builds

Plays are often built locally with Xcode or Gradle rather than on EAS Build. OTA still works:
the update URL, the runtime version policy and the channel all come from `app.json`, so a local
release build asks the `production` channel (change `requestHeaders` before building to point
one at `preview`). Two steps EAS Build does for you:

- **Create the channel once**, if no EAS build ever did: `eas channel:create production`.
- **Confirm the built app.** On iOS, `Expo.plist` must contain `EXUpdatesURL`,
  `EXUpdatesRuntimeVersion` and `EXUpdatesRequestHeaders` → `expo-channel-name`; on Android,
  the merged `AndroidManifest.xml` must carry `expo.modules.updates.EXPO_UPDATE_URL`,
  `EXPO_RUNTIME_VERSION` and `UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY`. **A build without
  them silently never receives an update.**

```bash
cd apps/mobile
npx expo prebuild --platform ios --no-install      # or read the one you are about to build
plutil -p ios/*/Supporting/Expo.plist
# "EXUpdatesRequestHeaders" => { "expo-channel-name" => "production" }
# "EXUpdatesRuntimeVersion" => "file:fingerprint"
# "EXUpdatesURL" => "https://u.expo.dev/<your-eas-project-id>"
```

`file:fingerprint` is right: with the fingerprint policy the runtime version is computed during
the native build and written into the app, as `EXUpdates.bundle/fingerprint` inside the `.app`
and `assets/fingerprint` inside the APK. It must equal `npx expo-updates runtimeversion:resolve`
for the commit you built; that value is what to record for the release. (EAS Build writes the
hash itself into `Expo.plist` instead.) `ios/` and `android/` are generated and ignored by git
here, so a prebuild is safe; a play that has committed its native directories reads its own
and never runs a bare prebuild ([mobile releases](mobile-releases.md)).

## Shipping an update

Through the EAS workflow, from `main`:

```bash
cd apps/mobile
eas workflow:run .eas/workflows/publish-update.yml --ref main \
  -F target=preview -F message="fix(paywall): show the yearly price per month"
# install the preview build, confirm the change on a real device, then:
eas workflow:run .eas/workflows/publish-update.yml --ref main \
  -F target=production-rollout -F message="fix(paywall): show the yearly price per month"
```

The workflow (`apps/mobile/.eas/workflows/publish-update.yml`) runs `eas update` on EAS's
servers with the target's EAS environment, and uploads that update's source maps to Sentry
with `SENTRY_AUTH_TOKEN` from the same environment. `--ref main` needs the EAS project linked
to the GitHub repository, with `apps/mobile` as its base directory (EAS project settings →
GitHub); without it, drop `--ref` and run it from a clean checkout of `main`, which uploads
that directory instead.

Without the workflow, the same thing by hand:

```bash
cd apps/mobile
eas update --channel preview --environment preview \
  --message "fix(paywall): show the yearly price per month"
npx sentry-expo-upload-sourcemaps dist   # needs SENTRY_AUTH_TOKEN in your own shell
```

- **`npm run check:store` and the `store-review` skill first**, every time
  ([store review](store-review.md)).
- **`--environment` is required** by `eas update` on this Expo SDK (55). The update then reads
  `EXPO_PUBLIC_*` values only from that EAS environment, not from `.env` files or `eas.json`
  ([secrets](secrets.md)). The workflow sets it from the target.
- **Preview first, always.** A preview build on the `preview` channel is the only place to see
  an update before users do.
- **Staged rollout** for anything beyond a copy fix: `production-rollout` publishes to 10% of
  users (by hand: `--rollout-percentage=10`). Widen it with
  `eas update:edit <group-id> --rollout-percentage=50`, then `100`. Back an in-progress rollout
  out with `eas update:revert-update-rollout --group <group-id>`. One rollout per branch at a
  time.
- **Rollback:** republish the last good update group
  (`eas update:republish --group <group-id>`), or send users back to the bundle inside their
  binary (`eas update:roll-back-to-embedded --channel production --runtime-version <hash>`).
  `eas update:list --branch production` shows the group ids. Read `eas update --help` for your
  eas-cli version before an incident, not during one.
- **Source maps for every update.** Sentry cannot symbolicate an OTA'd crash unless that
  update's maps are uploaded. The workflow's update jobs set `upload_sentry_sourcemaps: true`:
  a failed upload turns the run red after the update is published, which means the release is
  not finished. By hand, `sentry-expo-upload-sourcemaps` reads `SENTRY_AUTH_TOKEN` from your
  shell (a `secret` EAS variable is never readable on your machine) and the Sentry
  organization and project from the plugin in `app.json`, and prints how many bundles it
  uploaded: zero means the export had no maps, so read the output.
- **An update is a release.** Conventional commit, PR, green CI, merged, _then_ publish to
  `production` from `main`. Never from a feature branch, never from a dirty tree. A preview
  update from a branch is fine; that is what preview is for (`--ref <branch>`).

Flags verified against eas-cli 24.7.0's source (`update`, `update:edit`, `update:republish`,
`update:roll-back-to-embedded`, `update:revert-update-rollout`) and the workflow's update job
against EAS's published workflow schema, on 2026-09-24.

## The minimum-version gate

OTA cannot fix a native bug, and a phone on an old runtime cannot receive new updates. So on
launch the app asks `GET ${EXPO_PUBLIC_SITE_URL}/api/app/v1/config` for the oldest native
version each platform still supports, compares it with its own (`expo-application`'s
`nativeApplicationVersion`, the `version` in `app.json` when it was built) and, below it, shows
a full-screen "Update required" with a link to the store listing. Without it, a broken native
build stays broken for everyone who installed it. It is also how a `v1` API route eventually
retires ([mobile data](mobile-data.md)).

The route's response, validated on both sides with `appConfigSchema` from `@app/contract`: the
route checks what it sends, and `apps/mobile/lib/api.ts` parses what the app receives:

```json
{
	"min_supported_version": { "ios": "1.3.0", "android": "1.3.0" },
	"store_url": {
		"ios": "https://apps.apple.com/app/id1234567890",
		"android": "https://play.google.com/store/apps/details?id=com.yourcompany.myapp"
	}
}
```

- A version is `major`, `major.minor` or `major.minor.patch`, numbers only; `null` means no
  minimum for that platform. A store URL is `https`, and it is required wherever a minimum is
  set: the gate never shows a screen with nowhere to go.
- `v1` is frozen once a store build reads it: fields may be added (the app ignores ones it does
  not know), never renamed, removed or retyped.
- **It never blocks on the network.** No `EXPO_PUBLIC_SITE_URL`, offline, a timeout (10 s), a
  404 (the route is not deployed yet), a server error, a body that is not this shape, a version
  that will not parse: the app opens normally. A body that breaks the contract is logged as an
  error, so it reaches Sentry. Only a valid response naming a higher minimum shows the gate.
- It checks once per launch, never in Expo Go (which reports its own version) and never on the
  web. `update_required_viewed` and `update_required_store_link_tapped` say how many people a
  raised minimum locked out and how many went to update.
- Raising the minimum locks people out until they update: a decision for a human, stated in the
  PR ([mobile releases](mobile-releases.md)).

**Setting it.** The web answers from four environment variables, so a play changes the minimum
without a code change or a deploy of new code: `APP_MIN_VERSION_IOS`, `APP_STORE_URL_IOS`,
`APP_MIN_VERSION_ANDROID`, `APP_STORE_URL_ANDROID` (Vercel → Environment Variables, then
redeploy). Unset means no minimum. A minimum without its store URL, a malformed version or a
non-`https` URL stops the web server at boot rather than serving a body the app would ignore.
The route (`apps/web/src/app/api/app/v1/config/route.ts`) is public and cached for 60 seconds,
and its schema is `appConfigSchema` in `@app/contract`.

## Never over the air

- Anything hidden from App Review, then switched on (Apple 2.3.1).
- A change to what the app is, a new product category, or a storefront (2.5.2).
- Digital goods sold outside in-app purchase (3.1.1).
- Anything that needs a new permission, purpose string, privacy disclosure or tracking prompt
  ([permissions and privacy](permissions-and-privacy.md)).
