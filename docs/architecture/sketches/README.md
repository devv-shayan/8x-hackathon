# Sketches

Hand-drawn maps of what a developer on Chalkback needs to know, drawn in the style of
[Ian Xiaohei Illustrations](https://github.com/helloianneo/ian-xiaohei-illustrations) by Ian
(MIT). Xiaohei, the small black creature, does the work each one is about. Open
[index.html](index.html) in a browser to see them all at once.

| Sketch                                       | What it explains                                                                                  | In the code                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [01 System map](01-system-map.svg)           | The app reaches everything through one door, `/api/app/v1`; it never touches tables               | `apps/mobile/lib/api.ts`, `apps/web/src/app/api/app/v1/`, `packages/contract/`             |
| [02 One request](02-one-request.svg)         | The four checks every route runs: who's asking, the input, rows by `userId`, the response's shape | `apps/web/src/server/api/app-route.ts`                                                     |
| [03 The learning loop](03-learning-loop.svg) | Video → explain → class → results; missed ideas become gaps that come back as warm-ups            | `apps/web/src/server/gaps/schedule.ts`, `apps/mobile/app/warm-up/`                         |
| [04 A class turn](04-class-turn.svg)         | An answer is saved first, two Gemini calls run at once, and the app catches up after a timeout    | `apps/web/src/server/classroom/class-session.ts`, `apps/mobile/components/class/shared.ts` |
| [05 Voice](05-voice.svg)                     | What you say goes to Whisper as text you can fix; the students' questions come back as voices     | `apps/web/src/server/speech/`, `apps/mobile/lib/voice/`, `docs/memory/groq-voice.md`       |
| [06 Shipping](06-shipping.svg)               | Branch → local gates → CI → `main` → Vercel; for phones, an update or a store build               | `AGENTS.md`, `docs/rules/ota.md`, `.claude/skills/ship/`                                   |

Redraw a sketch when what it shows changes. The style rules live in the `xiaohei-dev-sketches`
skill.
