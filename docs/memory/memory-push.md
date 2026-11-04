---
name: memory-push
description: What to do by hand after Maya's memory is live, and how to turn on phone reminders once the app is in the stores
metadata:
  type: reference
---

The green board works in the browser and on a phone build without reminders. Reminders are
phone-only. The website never sends or shows one. Written 2026-11-05.

## After this is merged, for the board

The Home row labeled **Maya's memory** already opens the screen. No second link.

1. Let CI write the migration for `push_tokens` and `memory_marks`, then add each table's
   lock in the following migration: row security on, and nothing granted to `anon` or
   `authenticated`. Production applies that on the deploy. Until those tables exist, saving
   a class or a warm-up still succeeds; the reminder mark is skipped and logged.
2. The live website keeps working. Visitors do not get a push, and the browser cannot show one.

The board on a phone needs a build that includes `expo-notifications`. That package is native,
so an over-the-air update cannot add it to a binary that was built without it. `eas init` has
to have written `extra.eas.projectId` into the build. The screen itself does not need the
keys below.

## Later, once the app is on the App Store or Google Play

Do this when a store build is installed and you want the daily note. Skip it until then.

1. In the Expo account, create an access token (Account settings → Access tokens). Put it in
   Vercel as `EXPO_ACCESS_TOKEN`. Do not put it in the repo. Leave it unset and the daily job
   sends nothing.
2. Confirm `CRON_SECRET` is set on Vercel. The lifecycle job already uses it. Vercel calls
   `/api/cron/memory` at 09:00 UTC with that secret.
3. **Apple (APNs).** In Apple Developer, create a key with Apple Push Notifications service
   enabled, and download the `.p8` file once. In the Expo project (Credentials → iOS), upload
   that key with its key id and the team id. Expo uses it to deliver the note. The app id is
   `com.chalkback.app`.
4. **Google (FCM).** In Firebase, add the Android app `com.chalkback.app` if it is not there,
   and download a service account JSON (Project settings → Service accounts → Generate new
   private key). In the Expo project (Credentials → Android → FCM V1), upload that JSON.
   The older FCM server key is not the one to use.
5. On a store build, open Maya's memory and allow notifications. The board still works if
   the person says no. The next morning the job sends at most one note, naming one concept,
   and it opens Maya's memory.

A browser, and Expo Go on this SDK, cannot receive the note.
