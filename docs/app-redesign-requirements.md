# App redesign — requirements

Status: agreed with Shayan, 2026-11-02. Claude designs and builds every screen; Shayan directs. Mockups (built with the App Designer kit, not the
app): eight screens and the icon, each step of the loop on one of the landing page's moving
pixel backgrounds.

## Problem

The app still wears the template's look. The website now has a clear identity: generated
pixel backgrounds, pixel Maya and Omar, Inter Tight, a lime highlight and black buttons. Someone
who taps "Start a class" on the site lands in an app that looks unrelated. The class itself is
a form (a segmented control, a list of turn cards, a text box), so the product's main idea, two
students with a hand up, isn't visible anywhere in the app.

## What is there today (main at `6862c34`)

- **Home** (`app/(tabs)/index.tsx`): link box, the paste-text fallback, "Ready to teach",
  `DueWarmUps` (warm-ups answered inline on home, and offered while a video is read:
  `fillingWait`), `RecentTopics`.
- **Class** (`app/class/[topicId].tsx`, 683 lines): one route with three tabs: Explain (text box),
  Teach (raised hands to pick from, turn cards, answer box, `HelpSheet`), Gaps (the assessment:
  two scores, concept cards with quotes and clips, reactions).
- **Onboarding** (`app/(onboarding)/index.tsx`): name, then appearance (system, light or dark).
- **No topic page.** A recent topic opens its class route.
- **Theme:** `packages/brand` presets `daylight` and `dusk`, light and dark palettes, Inter plus
  Bricolage or Source Serif. A test fails on any hex or `rgb()` literal under `apps/mobile`
  (`__tests__/theme.test.tsx`), so pixel palettes can't live in the app's code.
- **Drawing:** `react-native-svg` and Reanimated. There is no Skia and no canvas on native, but
  `react-native-webview` is already in the build, so a web page with a canvas can run inside the
  app with no new native code.
  The website's engine (`apps/web/src/components/landing/pixel/`) is plain TypeScript drawing to
  a `<canvas>`.
- **Data:** `ListedTopic` has no score, gap count or next due date. No endpoint returns a
  topic's gaps. The `gaps` table has everything needed (`nextDueAt`, `closedAt`,
  `rightStreak`), so the new data needs no schema change.

## Success criteria

The redesign changes no flow, so it's judged on the funnel the app already records:

- **Class completion:** `class_started` → `class_finished` (not ended early), then
  `assessment_viewed`. It should not drop after the redesign; the bet is it rises.
- **Coming back:** the share of due gaps that get a `warm_up_answered` within a day of
  `warm_up_offered`.
- **Topic page use:** `topic_viewed` per person per week (new, below).

Compare the week before and after the redesign. With a handful of users this is a sanity check,
not proof.

## Requirements

**Look**

- R1. Every screen uses the website's tokens: ink `11 11 11`, paper, wash, hair, lime, muted.
  Inter Tight for text and JetBrains Mono for small labels. The tokens live in
  `packages/brand`, never as literals in `apps/mobile`.
- R2. Each step of the loop has its own background, as on the website: onboarding uses the
  black tunnel with Maya's orange and Omar's violet cards; home uses lime; a warm-up uses the
  tunnel; explain uses the green waves; the class and help use gold; results use the red
  ripples; the topic page uses Omar's violet.
- R3. The backgrounds and students are drawn by the same code as the website (one shared
  engine), so the two can't drift apart.
- R4. Content sits on a white sheet with a 47pt radius, inset 8pt (concentric with the display
  corner). Primary actions are black with lime text; one key word per heading may be
  highlighted in lime.
- R5. Backgrounds move in real time on the web build and on phones, and pause off-screen and in
  the background. With Reduce Motion
  on, they show a still frame. A screen never waits on a background to show its content.
- R6. Every text colour on a sheet meets WCAG AA. Text never sits directly on a background,
  except the home headline, which is ink on the lime field and checked for contrast.

**Screens** (behaviour as today unless stated)

- R7. **Meet your class:** a first onboarding step introducing Maya and Omar, on their own
  backgrounds, each with a line in their voice. It doesn't replace the name step.
- R8. **Home:** the headline, the link box (the paste fallback keeps working), the due warm-up
  as one card, and recent videos with ideas taught shown as pixel bars and when the next
  warm-up is due.
- R9. **Warm-up:** its own screen (a route, no longer answered inline on home), with the
  student who asks (a raised hand), the question, the answer, and "I don't remember". Home's
  card opens it. When a video starts being read and a warm-up is due, the app goes straight to
  this screen, with reading progress at the top, and on to explain when both are done.
- R10. **Explain:** the video card (thumbnail, title, length, "N ideas, hidden") over the waves;
  the explanation box on the sheet; "I'm done, start the class".
- R11. **Class:** the students on the gold background, with raised hands drawn on whoever has a
  question. Tapping a student with a raised hand picks that question (as `RaisedHands` does
  now). The sheet holds one question: "Question N of 4", the question with its key word
  highlighted, the answer box, "Skip this one". "End class" and "I'll be back" sit at the top.
- R12. **Private help:** a sheet over the dimmed class: "Omar can't see this", what the video
  says, the time in the video, "Rewatch 20 seconds", and "I'm back, answer Omar". Cancelling
  keeps today's rule that help not stayed for isn't counted.
- R13. **Results:** the after-class score as the hero ("3 of 5 ideas taught"), one line on how it
  got there (explanation, then fixed in class), and every idea with its time in the video and
  its state: explained, fixed in class, or a warm-up on a named day. Quotes, clips and
  reactions from today's assessment stay, below the list.
- R14. **Topic page** (new route): one video's explanation score, after-class score and open gaps,
  every gap with its next warm-up day or "closed", and "Teach it again".
- R15. **App icon:** the 3x3 pixel mark with the lime raised hand, on the tunnel.

**Data**

- R16. `listTopics` adds optional fields: idea count, ideas taught after the latest class,
  open gaps, and the next due date. They're optional, so an older build still parses the
  response.
- R17. A new `getTopicGaps` endpoint returns a topic's gaps (concept title, time in the video,
  next due date, closed or open) and its latest class's two scores, for the caller's own topic
  only (`requireUser`, ownership checked in the query).

## Events

Registered in `apps/mobile/lib/analytics.ts` (`EventName`) before any screen fires them.
Nothing here touches the web registry; the server emits none of these.

| Event                             | When                                 | Properties              | Sinks   |
| --------------------------------- | ------------------------------------ | ----------------------- | ------- |
| `topic_viewed` (new)              | The topic page opens                 | `topic_id`, `open_gaps` | PostHog |
| `topic_teach_again_tapped` (new)  | "Teach it again" on the topic page   | `topic_id`              | PostHog |
| `class_help_clip_opened` (new)    | "Rewatch 20 seconds" in private help | `start_seconds`         | PostHog |
| `onboarding_step_viewed` (exists) | Gains the step value `meet`          | `step`, `index`         | PostHog |

Every other screen keeps its current events and call sites: `home_viewed`, `video_read`,
`explain_viewed`, `class_*`, `assessment_*` and `warm_up_*`. The redesign must not drop a
`track()` call; `npm run check:events` warns on registered events that are never fired.

## Out of scope

- Voice: explaining and answering out loud. The mockup shows a recording strip; the build
  keeps typing.
- Dark mode. The app has one light look, like the website.
- A tab bar redesign beyond restyling (Home and Profile stay).
- The profile, settings, upgrade, support and legal screens, which keep the new tokens and
  fonts but get no new layout.
- Email reminders, new student personas, XP or streaks.

## Decisions (2026-11-02)

1. **No dark mode.** The appearance step in onboarding and the setting go, and the brand keeps one
   light palette.
2. **Real-time backgrounds everywhere.** The web build draws to a canvas, as on the site. On
   phones a transparent WebView runs the same engine behind the screen. `react-native-webview`
   is already in the build, so this ships as an update. Skia stays an option for a later store
   build if the WebView is too slow.
3. **Claude designs and builds all of it;** Shayan reviews and directs. Arif's in-flight work is
   merged before each screen is restyled.
4. **The warm-up is its own screen** (R9).
5. **The server picks the warm-up's student up front:** `listDueWarmUps` gains an optional
   `student_name`, so home can say "Maya has a question".
