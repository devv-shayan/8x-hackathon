# Mobile releases: builds, tracks and versions

Most changes ship as OTA updates ([OTA updates](ota.md)). This rule is for the ones that need
a store build, and for the release plumbing both paths share.

## Versions and build numbers

- **The user-facing version** (`expo.version` in `apps/mobile/app.json`, "1.4.0") is bumped
  deliberately, for a store release that people will notice. With the fingerprint runtime
  policy, changing it is a native change: it needs a store build.
- **The build number** (iOS `buildNumber`, Android `versionCode`) is EAS's job.
  `cli.appVersionSource: "remote"` in `apps/mobile/eas.json` keeps it on EAS's servers and
  `autoIncrement: true` on the `production` profile bumps it on every build. Build-number
  values in `app.json` are ignored under the remote source; don't set them. To start from the
  number a store already has, sync it once with `eas build:version:set`.
- **Local builds don't ask EAS.** A build made straight from Xcode or Gradle uses whatever the
  generated native project holds. Before uploading one, confirm its build number is higher than
  the last one the store has; the store rejects a duplicate at upload.

## The path to production

1. **`store-review` passes** ([store review](store-review.md)).
2. **Build** with the `production` profile (EAS Build, or locally; see
   [OTA updates](ota.md#local-builds) for what a local build must contain to receive updates,
   and record its runtime version: EAS keeps it for its own builds, nothing does for yours).
3. **Upload to the test track first:** TestFlight on iOS, the internal testing track on Play.
   Install it, check the change, and check that an OTA update on the `production` channel
   reaches it.
4. **Submit for review** with review notes, and a demo account when login is required (a human
   provides it; see [store review](store-review.md)).
5. **Release in phases.** App Store phased release for automatic updates; a staged rollout
   percentage on Play. Watch Sentry and the funnel before widening.

Submission (`eas submit`) is a release. It runs from a build of `main`, after a merged PR, and
only when the person you are working for asks for it ([deployment](deployment.md)).

## The minimum-version gate

A native bug can't be fixed over the air, and a phone on an old runtime can't receive new
updates. `GET /api/app/v1/config` returns `min_supported_version` per platform; on launch the
app compares it with its native version (`expo-application`) and shows a full-screen "Update
required" with a store link (`components/UpdateRequiredGate.tsx`; the response shape is in
[OTA updates](ota.md#the-minimum-version-gate)). Raise the minimum when a build is broken
beyond what an update can fix, or when a `v1` route is being retired
([mobile data](mobile-data.md)). Raising it locks people out until they update, so it is a
decision for a human, stated in the PR.

## Sentry source maps, every build and every update

Crashes without source maps are minified noise.

- **Builds:** the `@sentry/react-native/expo` config plugin in `app.json` uploads the build's
  maps and debug files during the build when `SENTRY_AUTH_TOKEN` is available to the builder
  (an EAS environment variable with `secret` visibility; see [secrets](secrets.md)). Replace the
  plugin's placeholder `organization` and `project` with the play's own. A failed upload fails
  the build; `SENTRY_DISABLE_AUTO_UPLOAD=true` skips it, which is for a local build nobody will
  ship, never for a release. A local release build needs the token in the shell that builds it.
- **Updates:** the publish workflow (`apps/mobile/.eas/workflows/publish-update.yml`) uploads
  each update's maps on EAS, with the same `secret` `SENTRY_AUTH_TOKEN`, and fails the run when
  they don't upload. An update published by hand needs
  `npx sentry-expo-upload-sourcemaps dist` straight after it, with the token in your own shell
  ([OTA updates](ota.md#shipping-an-update)).

A release whose maps did not upload is not finished.

## Native directories stay out of git

`apps/mobile` uses Continuous Native Generation: `ios/` and `android/` are generated from
`app.json` and the config plugins (`npx expo prebuild`) and are not committed. Every native
setting is expressed in `app.json` or a config plugin, so the next prebuild reproduces it.

If a play ever commits `ios/` or `android/`, it has left CNG: from then on native changes are
made in those directories by hand, and **a bare `expo prebuild` must never be run there again**,
because it overwrites them. Record that decision in `docs/memory/` the day it is made.
