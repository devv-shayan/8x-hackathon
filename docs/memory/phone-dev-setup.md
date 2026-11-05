---
name: phone-dev-setup
description: How to run the app on a real phone from a Mac or a Windows PC (Expo Go on the same Wi-Fi, the API on the LAN or the live site), and the traps that broke it
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
   It holds no secret, but `.claude/settings.json` denies Claude Code every env file, this one
   included (reading, writing, even `ls` or `mv`): the person writes it.
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

## On Windows, against the live site

Sayed ran it this way on an Android phone in Expo Go on 2026-11-05, with the PC on the phone's
own hotspot. No local API: the phone called `https://chalkback.vercel.app`.

1. `apps/mobile/.env.local` holds `EXPO_PUBLIC_SITE_URL=https://chalkback.vercel.app` (the API;
   `chalkback-app.vercel.app` is the app's browser build), `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase dashboard (Project Settings → API
   Keys). EAS cannot pull them yet: `app.json` still has a placeholder owner.
2. The address: `ipconfig`, the Wi-Fi adapter's IPv4.
3. Expo: the `expo-go` entry in `.claude/launch.json` (`node ../../node_modules/expo/bin/cli
start --go --lan --clear` from `apps/mobile`). Expo's log says `env: load .env.local` and
   which names it exported.
4. In Expo Go, `exp://<IPv4>:8081`.

Traps, all hit that day:

- **The env file at the repo root.** Expo reads only `apps/mobile`. The app then warns "Supabase is
  not configured" and sign-in is off.
- **`EXPO_PUBLIC_SITE_URL` copied from a local setup** (`http://127.0.0.1:3000`): sign-in works,
  because it goes straight to Supabase, but every screen is empty. Check where the app calls.
- **The browser preview cannot use the live API.** Its CORS allows only
  `https://chalkback-app.vercel.app`, so `localhost:8081` gets "We couldn't reach our server" on
  every screen. Test on the phone, or against a local API.
- **Windows Firewall drops the phone silently**, and Metro logs no Android bundle. The allow rules
  were for other copies of Node (Herd, Cursor), not `C:\Program Files\nodejs\node.exe`, and
  Windows had made the hotspot a Public network. The person fixed it, as administrator: the
  hotspot set to Private (`Set-NetConnectionProfile -Name "<network>" -NetworkCategory Private`),
  and an inbound rule for that `node.exe` on TCP 8081, Private profile only. An agent must not
  change firewall or network settings.
- **The hotspot hands out a new address** (`192.168.18.5` → `10.183.126.165` within the hour).
  Restart Expo so it announces the new one, and open the new `exp://` link.
