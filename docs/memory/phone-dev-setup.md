---
name: phone-dev-setup
description: How to run the app on a real phone from a Mac (Expo Go on the same Wi-Fi, the API on the LAN), and the traps that broke it
metadata:
  type: reference
---

Shayan ran the app this way on his Android phone in Expo Go on 2026-11-02 and 2026-11-03, voice
included (8X-27). It needs no build.

1. Put the phone and the Mac on the same Wi-Fi.
2. Start the API where the phone can reach it: `npx next dev -p 3001 -H 0.0.0.0` from `apps/web`.
   Without `-H 0.0.0.0` it only answers the Mac itself.
3. Find the Mac's address: `ipconfig getifaddr en0`.
4. Point the app at it in `apps/mobile/.env.development.local` (git-ignored, and it wins over
   `.env.local` in development), holding one line: `EXPO_PUBLIC_SITE_URL=http://<Mac IP>:3001`.
   It holds no secret; an agent may write it, but never reads `.env.local`.
5. Start Expo from `apps/mobile`: `../../node_modules/.bin/expo start --go --lan --clear`.
6. In Expo Go on the phone, open `exp://<Mac IP>:8081`.

Traps:

- **The Mac's IP changes** (`.11` → `.12` on 2026-11-01, `.12` → `.2` on 2026-11-02). The app
  then says "We couldn't reach our server". Redo steps 3–5; `--clear` is needed, because
  `EXPO_PUBLIC_*` values are baked into the bundle.
- **`npx expo start` inside the workspace runs from the repo root**, and the web bundle fails with
  `Unable to resolve "../../App"`. Use the binary from `apps/mobile`, as in step 5.
- **`next build` breaks a running `next dev`**: restart the API after a build.
- **Sign-in by email code** only reaches the Supabase team's addresses until custom SMTP is set up
  (8X-45). Use a signed-in session or Google.
- **Expo Go must match the app's SDK (55).** If it refuses the project, install the SDK 55 Expo Go,
  or make a development build with `npx expo run:android` from `apps/mobile`.
- **Voice on a phone:** allow the microphone at the first prompt. An explanation is written down
  when you tap stop, not as you speak ([[groq-voice]]).
