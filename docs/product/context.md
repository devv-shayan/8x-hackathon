# Project context

Read this first, then [brief.md](brief.md) for the product and `AGENTS.md` for the engineering
rules. Update this file when something here stops being true.

## What we're building

A phone-first app, for 8x Playmakers C2 (theme: learning that sticks). The user pastes a YouTube
video, explains it in their own words, then teaches it to AI students who ask about what they
missed. Each gap comes back days later as a one-minute warm-up from a student who remembers them.

The app is called Chalkback: you're at the chalkboard, and the class talks back.

## The loop

1. Add a video: transcript, then key concepts.
2. Warm-up, while the video is read, if a gap is due.
3. Explain the video in your own words. Scoring stays hidden until the class ends.
4. Teach the class: up to 4 student questions, aimed at what was missed or wrong.
5. "I'll be back": a private help panel, as a bottom sheet, when stuck.
6. Assessment: "6 of 8" concepts, gaps with timestamps, how each question went.

Gap schedule: due 2 days after it's found. Right: due again 5 days later. Right again: closed.
Wrong: due again in 2 days.

## How the code fits together

```
apps/mobile (Expo app, the product) ──▶ /api/app/v1 ──▶ apps/web (Next.js) ──▶ Supabase Postgres
                                                              └──▶ Gemini, yt-dlp
```

- The app never calls AI or the database. It calls `/api/app/v1` through `apps/mobile/lib/api.ts`.
- Every route is defined once in `packages/contract/src/v1/`, then built with `createAppRoute`.
- Queries live in stores in `apps/web/src/server/db/`, never in routes.
- AI calls go through `apps/web/src/server/ai/gemini.ts`.
- Supabase is for sign-in only. All data goes through Prisma.

## What's built

| Area            | Where                                                               |
| --------------- | ------------------------------------------------------------------- |
| Add-video route | `apps/web/src/app/api/app/v1/videos/route.ts`                       |
| Reading a video | `apps/web/src/server/video/read-video.ts`, `youtube-info.ts`        |
| Key concepts    | `apps/web/src/server/video/find-key-concepts.ts`, `key-concepts.ts` |
| Saved videos    | `apps/web/src/server/db/topics.ts`                                  |
| Schema          | `apps/web/prisma/schema/learning.prisma`                            |
| Home screen     | `apps/mobile/app/(tabs)/index.tsx`                                  |

In production, reading a video goes to Gemini first, then Supadata's captions if Gemini can't
read it. Locally it tries captions through yt-dlp, then Supadata, then Gemini.
The limit is 90
minutes with captions and 30 without. Key concepts keep only quotes found in the transcript, and
the timestamp comes from the transcript, not the model.

The learning tables (`students`, `classes`, `class_turns`, `gaps`, `warm_ups`) have no stores or
routes yet. Explore, Activity and the items, tasks and notifications code are template demos: don't
build on them.

## Run it

Use Node 22. You also need `yt-dlp` or `uv`, or every video goes through Gemini.

```bash
npm install
npm run web:dev
cd apps/mobile && npx expo start --web
```

The README has the full setup. Get env values from your teammate privately, and never commit them.
For Supabase, use the pooler addresses and URL-encode the password (see `apps/web/.env.example`).

## Adding a feature

1. Register events first (`apps/mobile/lib/analytics.ts`), as `AGENTS.md` requires.
2. Add the route's schemas to `packages/contract/src/v1/` and to `endpoints.ts`.
3. Add a store in `apps/web/src/server/db/`, and the route in `apps/web/src/app/api/app/v1/`.
4. Build the screen in `apps/mobile/app/`, using `components/ui/` and brand tokens.

For a new table, change `apps/web/prisma/schema/`, then add the RLS migration that
`docs/rules/migrations.md` describes.

## Working together

- Work on a branch, open a PR, wait for green CI. Don't push to `main`.
- Commits are Conventional: `type(scope): subject`, using the scopes in `AGENTS.md`. `logs` isn't
  one, so session-log commits are plain `docs: ...`.
- Move your Linear issue to In Progress when you start, and Done when it merges.
- Commit session logs separately from code, just before pushing.
- Don't edit a migration that has already been applied.

## Known problems

- Gemini often answers 503 under load. The app retries once.
- YouTube rate-limits caption fetches, so test sparingly.
- Gemini's reads of videos over about 30 minutes can lose text or return wrong timestamps, without
  any error.
- Hosted sign-in codes need custom SMTP. Until then, emailed-code sign-in only works on local Supabase.
- `next build` breaks a running dev server: restart it afterwards.
