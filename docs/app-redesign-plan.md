# App redesign — plan

Goes with [app-redesign-requirements.md](app-redesign-requirements.md). Feedback 3 is Thursday
5 Nov and its demo runs on the web build (`chalkback-app`), so the web path comes first.
Phases 0 to 5 are JavaScript and assets only and ship as updates; only phase 6 (the icon and the
splash) needs a store build.

Claude builds every phase; Shayan reviews each PR. Each phase is one PR with green CI.

## Phase 0 — One pixel engine for both apps

**Files:**

- New `packages/pixel/` (`@app/pixel`), holding `noise.ts`, `dither.ts`, `fields.ts`,
  `students.ts` and `pixel.test.mts`, moved from `apps/web/src/components/landing/pixel/`, plus
  `package.json`, `tsconfig.json` and `index.ts`.
- `apps/web/src/components/landing/pixel/PixelField.tsx`, `PixelStudents.tsx`: import from
  `@app/pixel`.
- `apps/web/package.json`, `apps/web/next.config.mjs` (`transpilePackages`): add `@app/pixel`.
  The app adds it in phase 2, when it first draws with it.
- Root `package.json` (`typecheck`, `test`), `eslint.config.mjs`, `.github/workflows/ci.yml`
  comments: include the new workspace.

**Changes:**

- Pure TypeScript, no React or DOM: fields, palettes, student shapes, `renderField`. A move
  only: no behaviour changes, so the landing page draws exactly what it drew before. The app's
  scenes (the field for each screen and where the students stand) come in phase 2.
- The palettes live in this package, so the app's no-hex test still passes.

**Verify:**

- `npm run typecheck`, `npm test` (pixel tests move with the code), `npm run web:build`.
- The landing page looks and moves the same at `localhost:3000`.

## Phase 1 — Tokens, fonts and events

**Files:**

- `packages/brand/presets/landing.ts` (new): ink, paper, wash, hair, lime, muted and the type
  scale, from `apps/web/src/components/landing/landing.css`.
- `packages/brand/brand.config.ts`: switch the preset.
- `packages/brand/__tests__/contrast.test.ts`: cover the new pairs (ink on lime, muted on
  white, lime on ink).
- `apps/mobile/lib/fonts.ts`, `apps/mobile/package.json`: `@expo-google-fonts/inter-tight`
  and `@expo-google-fonts/jetbrains-mono` (JavaScript and font files only, so updates can ship
  them). Drop the unused Bricolage and Source Serif.
- `apps/mobile/lib/analytics.ts`: register `topic_viewed`, `topic_teach_again_tapped` and
  `class_help_clip_opened` (the `events` skill).

**Changes:** no dark mode. The preset has one light palette. The appearance step in onboarding
and the setting in `app/settings.tsx` go, with their `appearance_changed` call sites, and the
event is unregistered. `app.json` keeps `userInterfaceStyle` (changing it would need a store
build); the app simply ignores the system scheme.

**Verify:**

- `npm test -w @app/mobile` (theme and no-hex tests), `npm run check:events`.
- Today's screens still render in the new fonts in `npm run mobile:start -- --web`.

## Phase 2 — The backdrop and the sheet

**Files (the backdrop; components are new, in `apps/mobile/components/pixel/`):**

- `packages/pixel/src/scenes.ts` (new): each screen's field and where the students stand, as
  shares of the screen, so the web canvas and the WebView draw the same scene.
- `apps/mobile/package.json`: add `@app/pixel`.
- `PixelBackdrop.web.tsx`: a `<canvas>` behind the screen running `@app/pixel` at the website's
  frame rate. It pauses when the tab is hidden or the screen isn't focused (`useIsFocused`),
  and draws one frame under Reduce Motion.
- `PixelBackdrop.tsx` (native): a transparent `react-native-webview` behind the screen
  (`pointerEvents="none"`) loading a small inline page that runs the same `@app/pixel` engine on
  a canvas. The scene, whose hand is up and pause or play are posted to it as messages. The
  page is built from `@app/pixel` by `packages/pixel/scripts/build-backdrop.mjs` into one
  string module, so nothing loads from the network and it ships as an update.
- `PixelStudents` props: who's there, whose hand is up, and which student was tapped. Taps
  land on transparent pressables over each student, not on the canvas, so both platforms
  behave the same.

**Files (new, `apps/mobile/components/ui/`):**

- `SheetCard.tsx`: white, 47pt radius, inset 8, on top of the backdrop.
- `Highlight.tsx`: the lime word.
- `MonoLabel.tsx`: the mono label with an optional right side.
- `Button.tsx`: gains the black with lime variant.

**Verify:**

- A dev-only story route renders every scene on the web and on an iOS simulator.
- The canvas holds 24fps on a mid phone, on the web and in the WebView.
- The canvas costs nothing when the screen isn't focused.
- A phone build made before this change gets it as an update (the fingerprint doesn't change).
- Reduce Motion shows a still frame.

## Phase 3 — The class and private help

**Files:**

- `apps/mobile/app/class/[topicId].tsx`: split into `components/class/ExplainStep.tsx`,
  `ClassStep.tsx`, `HelpSheet.tsx` and `ResultsStep.tsx`. The route keeps the session state and
  mutations. This also takes it under the god-file limit.
- `ClassStep.tsx`: the gold backdrop with students whose hands follow the open turns. Tapping a
  student with a raised hand picks that turn (`class_hand_picked`). The sheet holds one
  question at a time. Answered turns move into a "So far" list inside the sheet.
- `HelpSheet.tsx`: the help panel (R12) with "Rewatch 20 seconds" (`class_help_clip_opened`).

**Changes:** the segmented control goes. The step follows the session state: no class means
explain, an open class means the class, and a finished class means results. Back still leaves
the class.

**Verify:**

- A full class on the web build with a real video: hands appear, a pick works, help opens and
  cancels without being counted, "End class" works.
- PostHog shows `class_started`, `class_hand_picked`, `class_help_opened`, `class_answered`
  and `class_finished` with the same properties as before.
- `npm test` and the class tests.

## Phase 4 — Home, explain, results, warm-up and onboarding

**Files:**

- `apps/mobile/app/(tabs)/index.tsx`, `components/RecentTopics.tsx`: the lime backdrop,
  headline, link card and recent rows with pixel bars. They use the new optional fields when
  present (phase 5) and plain rows until then.
- `components/class/ExplainStep.tsx`: the waves backdrop, the video card, the text box on the
  sheet (R10).
- `components/class/ResultsStep.tsx`: the ripples backdrop and R13. It keeps the quotes,
  clips, reactions and `assessment_viewed` properties from `lib/assessment.ts`.
- `app/warm-up/[gapId].tsx` (new) and `components/DueWarmUps.tsx`: the warm-up screen on the
  tunnel. It replaces the inline warm-up on home. The home card opens it; when a video starts
  being read and one is due, home goes straight to it with reading progress at the top, then on
  to explain. It keeps the `warm_up_offered`, `warm_up_started` and `warm_up_answered` call
  sites. `listDueWarmUps` gains an optional `student_name` (contract, store, route test).
- `app/(onboarding)/index.tsx`: a `meet` step first (R7), then the name step.

**Verify:**

- The whole loop on the web build: home → read → warm-up while reading → explain → class →
  results.
- Each step's existing events still fire. A `check:events` run shows no event that was fired
  before and isn't fired now.

## Phase 5 — The topic page and its data

**Files:**

- `packages/contract/src/v1/videos.ts`: `listedTopicSchema` gains optional `idea_count`,
  `ideas_taught`, `open_gaps` and `next_due_at`.
- `packages/contract/src/v1/endpoints.ts`, `.../videos.ts`: `getTopicGaps` (`GET
/api/app/v1/topics/:id/gaps`) and its response schema.
- `apps/web/src/server/db/gaps.ts`, `topics.ts`: read a topic's gaps and the latest class's two
  scores, filtered by `userId` in the query.
- `apps/web/src/app/api/app/v1/topics/[id]/gaps/route.ts`: `requireUser`, then the store.
- Tests next to each store: the shape, a topic that isn't yours (404), a closed gap.
- `apps/mobile/app/topic/[id].tsx` (new): the violet backdrop and R14, firing `topic_viewed` and
  `topic_teach_again_tapped`. Recent rows open it once a class has finished, and the class
  route otherwise.

**Changes:** no schema change. `gaps` has `nextDueAt`, `closedAt` and `rightStreak`, and
`classes.conceptResults` has both scores.

**Verify:**

- `npm test` (contract, store and route tests).
- Through the app: finish a class, open the topic from home, check that the due days match
  the gap schedule (missed: +2 days; right: +5 days).

## Phase 6 — The icon and the splash (store build)

**Files:**

- `apps/mobile/assets/images/icon.png`, `adaptive-icon.png`, `splash-icon.png`: from the
  mockup's icon at 1024.
- `apps/mobile/app.json`: the splash background.

**Changes:**

- Icons and the splash change the fingerprint, so this phase is a store build, not an update.
- If the WebView backdrop is too slow on phones, add `@shopify/react-native-skia` to the same
  build and give `PixelBackdrop.tsx` a Skia renderer.

**Verify:**

- `npm run check:store` and the `store-review` skill.
- A TestFlight or internal-track build shows the icon, the splash and the backdrops.

## Risks

- **Main moves under us.** Arif is still shipping. Phase 3 and phase 4 both touch
  `class/[topicId].tsx`, so phase 3's split lands first and phase 4 builds on it. Each phase
  starts from the latest main.
- **Performance.** A full-screen canvas on a low-end Android phone, and a WebView's memory on
  top of that. Mitigations: the website's cell sizes (4–6pt), a 24fps cap, one WebView per
  screen, pausing when unfocused, and a still under Reduce Motion. Skia is the fallback
  (phase 6).
- **The v1 contract.** Only optional fields are added, and `getTopicGaps` is new. Nothing
  existing changes shape, so installed builds keep working.
- **Lost analytics.** Restyling can drop a `track()` call by accident. Each screen PR lists its
  events before and after.
- **Dark mode removal** changes a stored preference: people who picked dark get light. The
  preference stays stored but goes unused, and nothing else depends on it.
- **No money, entitlement or Play Stats API code is touched.** The upgrade screen only gets
  the new tokens.
- **Bundle size.** The backdrop page is the engine plus a few kilobytes of HTML; no images.
