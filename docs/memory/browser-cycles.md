---
name: browser-cycles
description: How the local browser walk of Chalkback was checked, and the last result, without the runner in the repo
metadata:
  type: reference
---

A browser walk of the signed-in app, written 2026-11-05. The runner is Playwright against the
local Expo web app and the local API. It is not part of this play. The scripts stay on this
machine, in the git stash `wip before 8x-52: cycles, logs, playwright` (`cycles/run.mjs`,
`cycles/core.mjs`, `cycles/lesson.mjs`, and `cycles/lib/`). Do not pop that stash onto a
feature branch, and do not commit `cycles/`. Reports and failure screenshots land in
`cycles/runs/`, which is gitignored.

## How a run was started

From the repo root, with both servers already up:

```bash
npm run web:dev
npm run mobile:start -- --web --port 8081
npm run test:cycles
```

`test:cycles` was `node cycles/run.mjs`. Playwright was a root dev dependency, and the browser
was the Chrome already installed (`CYCLE_BROWSER` overrides the channel). The page is 390 by 844. `CYCLE_APP_URL` defaults to `http://localhost:8081` and `CYCLE_API_URL` to
`http://127.0.0.1:3000`. The runner waits up to 90 seconds for each server.

```bash
npm run test:cycles -- --full          # core, then the class
npm run test:cycles -- welcome sign-in # named cycles only
npm run test:cycles -- --headless      # no window
```

One signed-in browser is shared. A failure skips every cycle after it. The last report is
`cycles/runs/latest.json`. A run also writes `cycles/runs/<timestamp>.json` and, on failure,
`cycles/runs/<cycle>.png`.

Sign-in creates a throwaway mailbox each run and reads the six-digit code from it. The app
refuses the usual disposable-mail domains, so the mailbox has to be on a domain the app accepts.

## Core

1. **welcome.** Open the app. Heading matches "Teach it back". Buttons "Get started" and
   "I already have an account" are visible.
2. **sign-in.** "Get started", heading "Sign in to Chalkback", fill Email, "Email me a code",
   heading "Check your inbox", fill "Six-digit code". Then either "teach it to these two" or
   "What did you learn today" is visible.
3. **onboarding.** If "What did you learn today" is already showing, stop. Otherwise
   "teach it to these two", Continue, "What should we call you", name "Sam", Finish, then
   the home heading. Last run failed here (2026-11-03): the welcome screen was still up, and
   `POST /api/lifecycle/session` answered 401.
4. **home.** Heading "What did you learn today", a "YouTube link" field, and "Teach it".

## The class (`--full` only)

The same short video every time: `https://www.youtube.com/watch?v=sQKbsXmxsfo`. Reading it
is allowed up to six minutes. Each later step waits up to 90 seconds.

1. **add-video.** Paste the link, "Teach it", then "Explain it to the class" is visible.
2. **explain.** That button, heading "Teach it like they never saw it", fill "Your explanation"
   with a short photosynthesis paragraph, then "done, start the class". A button matching
   "Let … ask", "I'll be back", or "End class" shows.
3. **teach.** "Let … ask" if it is there, then "be back", heading "What the video says", wait
   until "Looking in the video" is gone, "I'm back, answer", fill the Answer field, "Answer",
   "End class".
4. **assessment.** "Back to home", text matching "of N ideas", and "How each question went".

## Maya's memory

This walk does not open the board. The green board is the signed-in screen and the dev preview
at `/dev/memory`. White and grey stay in `apps/mobile/app/dev/memory.tsx` and render only when
`SHOW_SAVED_BOARDS` is on. The checks that ship with the board are `apps/mobile/__tests__/chalk.test.ts`,
`apps/mobile/__tests__/memoryScreen.test.tsx`, `apps/web/src/server/gaps/memory.test.mts`,
`apps/web/src/server/memory/reminders.test.mts`, `apps/web/src/server/memory/expo-push.test.mts`,
and `apps/web/src/app/api/app/v1/memory/route.test.mts`.
