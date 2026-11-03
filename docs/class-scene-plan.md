# Class scene — plan

Requirements: [class-scene-requirements.md](class-scene-requirements.md). Each phase ships as
its own OTA update: no native module, permission or `app.json` change, and the WebView's page
is inside the JavaScript bundle.

## Phase 1 — The question moves into a bubble

The smallest change that's visible in the demo, with no engine work.

**Files:**

- `packages/pixel/src/scenes.ts`: `studentHeads(scene, width, height, floor)`, where each
  student's head is in points (from the same `figures()` as `studentBounds`), for the tail.
- `apps/mobile/components/class/QuestionBubble.tsx` (new): the bubble under the top pills,
  its tail placed over the asking student's head, and scrolling when it's too tall (R7–R9).
- `apps/mobile/components/class/ClassStep.tsx`: the question leaves the sheet's scroll view
  for the bubble. The sheet keeps the progress line, the name with `QuestionVoice`, "has a hand
  up too" and `VoiceAnswer` (R14). The 8X-48 cap stays, for the keyboard.
- `apps/web/src/server/classroom/student-turn.ts`: `STUDENT_TURN_INSTRUCTION` asks for at most
  about 140 characters, reaction included (R16). Same for the follow-up wording.
- Tests: `apps/mobile/__tests__/classStep.test.tsx` finds the question in the bubble, not the
  sheet. A pixel test checks `studentHeads` against `studentBounds`. A web test checks that the
  prompt names the limit.

**Verify:** `npm test`, and on the iPhone simulator:

- a long question, a short one and a follow-up sit in the bubble with the tail on the asker;
- with the keyboard up, the bubble stays readable under the pills;
- the largest text size scrolls inside the bubble.

## Phase 2 — The stage: spotlight, the asker in front, the waiting student at a desk

**Files:**

- `packages/pixel/src/students.ts`:
  - a `pose` on `Figure` (`'standing' | 'seated'`) and `talking`;
  - the seated parts (shorter torso, lap, knees, shins, shoes, the forearm resting on the desk)
    and the mouth, drawn with the same outline and shading as today's parts;
  - the shoe palette.
- `packages/pixel/src/scenes.ts`:
  - a `stage` option for `renderScene`, `studentBounds` and `studentHeads`:
    `{ asking: StudentName | null, talking: boolean }`;
  - with it, the classroom puts the asker in front under a narrow light (R1), and the others at
    desks, smaller and shaded (R3, R5). The desk is drawn with the same distance-field shapes,
    in a wood palette;
  - without `stage`, every scene renders exactly as now (R6).
- `packages/pixel/src/backdrop.ts`: `stage` in `BackdropState`. A change of asker cross-fades
  over about 250 ms; Reduce Motion jumps straight to it.
- `packages/pixel/src/backdrop-html.generated.ts`: rebuilt with `npm run build:backdrop`. The
  pixel test fails if it's stale.
- `apps/mobile/components/pixel/types.ts`, `PixelBackdrop.tsx`, `PixelBackdrop.web.tsx`: pass
  `stage` through.
- `apps/mobile/components/pixel/StudentTargets.tsx`: boxes from `studentBounds` with the same
  `stage`, so tapping the seated student works (R4).
- `apps/mobile/components/class/ClassStep.tsx`: the stage is the open turn's student, with
  `talking` while `voice.state === 'speaking'`.
- Tests in `packages/pixel/src/pixel.test.mts`:
  - only palette colours, opaque;
  - the asker is lit and the seated student is not;
  - a seated student's bounds hold their raised hand;
  - without `stage`, the frame is identical to today's;
  - the generated page is current.

**Verify:** `npm test`, the `/dev/backdrops` screen, and in a class on the simulator: pick Maya,
then tap Omar and watch them swap, then end on "no hands up". Then the same on the web build, and
a frame-rate check on one Android phone in Expo Go.

## Phase 3 — Word by word, in time with the voice

**Files:**

- `apps/mobile/lib/voice/playback.ts` and `playback.web.ts`: `Playing` gains
  `progress(): { elapsed: number; duration: number | null }`:
  - phones: `currentTime` and `duration` from the expo-audio player;
  - web: the `<audio>` element;
  - the device voice: elapsed since it started, with no duration.
- `apps/mobile/lib/voice/reveal.ts` (new, pure): word weights by length, and how many words to
  show at a given elapsed time and duration. Without a duration, it uses a speaking pace of about
  2.8 words a second. Unit-tested.
- `apps/mobile/hooks/useQuestionVoice.ts`: returns `revealed` (words shown) and `revealAll()`,
  driven by a frame callback while speaking. Replay resets it.
- `apps/mobile/components/class/QuestionBubble.tsx`:
  - every word is laid out from the start, so the bubble keeps its size, and words not yet said
    are transparent;
  - the current word gets the lime highlight, and tapping the bubble shows all (R10–R12);
  - Reduce Motion and screen readers get the whole question (R13).
- `apps/mobile/lib/analytics.ts`: `class_question_shown_all`, if open question 1 says yes,
  registered with the `events` skill before the bubble fires it.
- Tests:
  - `reveal.ts` covers weights, a stall, no duration and the end;
  - the class step shows the whole question under Reduce Motion, and after a tap.

**Verify:** on the simulator, with Orpheus and then with the voice failing (the device voice):

- the words keep pace with the voice;
- a tap shows them all, and Replay starts the reveal again;
- with Reduce Motion on, the question is shown whole;
- with VoiceOver on, the whole question is read.

## Phase 4 — Ship

`/local-review`, `store-review` (one verdict for the update), then a PR per phase, or one PR with
a commit per phase if they land together. Each publishes as an OTA through `publish-update.yml`
after merge. Update `docs/product/context.md` and the `04-class-turn` sketch.

## Risks

- **Phone frame rate.** The seated student and the desk add about fifteen distance-field shapes
  for every pixel near them, inside a WebView at 24 fps. If an Android phone drops frames, render
  the room at the field's coarser cell, or draw the desk once and cache it.
- **Tap areas drifting from the art.** `studentBounds` must take the same `stage` as the render,
  or the seated student can't be tapped. A test ties the two together.
- **The stale WebView page.** Forgetting `build:backdrop` ships the old classroom to phones while
  the web build shows the new one. The existing test catches it in CI.
- **Timing is an estimate.** Orpheus gives no word timings, so a slow or uneven voice can run
  ahead of or behind the words. The highlight keeps it obvious, and a tap shows everything.
- **Questions already saved can be long** (older prompt). The bubble scrolls them (R9) rather
  than cutting them.
- Nothing here touches money, entitlement, auth, the Play Stats API or the `v1` contract.
