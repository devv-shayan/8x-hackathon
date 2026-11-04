# Class scene — requirements

Agreed with Shayan through mockups on 2026-11-03: the bubble-only question, the narrow spotlight,
the word-by-word reveal, and seated version 1 (at a school desk, facing us).

## Problem

In a class, both students stand side by side with a hand up and look the same. The only sign of
who is asking is a small label in the sheet ("MAYA · NEVER SAW THE VIDEO"). The question sits in
the sheet at 30 pt, so a long one makes the sheet tall: it squeezes the students and, with the
keyboard up, used to slide under the top buttons (8X-48, fixed by capping the sheet). The voice
plays, but nothing on screen moves with it.

## Success criteria

You can tell at a glance who is asking and follow their question as they say it, without the
class feeling empty.

Measured with events that already exist:

- `class_answered` (`outcome: answered`) per `class_started`, and `class_finished` with
  `ended_early: false`. They shouldn't drop after this ships, and the demo is judged on them.
- `class_hand_picked` (`student`): people still switch to the waiting student, which shows the
  seated student still reads as tappable.

## Requirements

**The stage (pixel engine)**

R1. While a student asks, a narrow beam of light falls on that student only, about as wide as
them, ending in a pool at their feet. The rest of the gold room is darker.

R2. The asking student stands in front at the classroom scene's size, hand down. While their
voice plays, their mouth moves.

R3. A student with a question waiting sits at a school desk, facing us: a shorter torso, lap,
shins and shoes under a wood desk drawn in the engine's style (ink outline, dithered shading,
a lit top face), one forearm on the desk and the other hand raised. They're smaller than the
asking student, with their head about level with theirs, and in the room's shadow.

R4. The seated student stays tappable while their hand is up, and tapping them takes their
question. The two swap: the tapped student stands into the light and the other sits down at
the desk. The tap areas match the new poses.

R5. When no student is asking (hands up, nobody picked yet, or no hands left), both sit at
their desks and there's no spotlight.

R6. Every other scene (welcome, cards, portraits, warm-ups, results) and the website hero look
exactly as they do now.

**The question bubble**

R7. The question appears only in a speech bubble, never in the sheet. The bubble's tail points
down at the asking student's head, wherever the engine places them.

R8. The bubble sits just under the top buttons and stays there when the keyboard raises the
sheet, so the question can be read while typing. When the sheet covers the student, the bubble
still shows their name.

R9. A question that doesn't fit, or a large text size, scrolls inside the bubble. The bubble
never covers the top buttons or grows over the sheet.

R10. The question reveals word by word, in time with the voice, and the word being said is
highlighted lime. The bubble takes its full size from the start, so nothing jumps.

R11. The timing follows the audio's real progress: its length and how far playback has got,
with each word given time by its length. If the voice stalls or starts late, the words wait.

R12. Tapping the bubble shows the whole question at once. Replay reveals it again.

R13. The whole question shows at once under Reduce Motion, and to screen readers (the question
is one accessible header with the full text). If there's no voice at all, the words still
reveal at a speaking pace from when the question appears.

**The sheet**

R14. While a student asks, the sheet holds only: the progress line, who is asking with
Speaking/Replay, "X has a hand up too" when it applies, and the answer controls. Its height is
the same for every question.

R15. The "hands are up" and "no hands up" sheets stay as they are.

**Questions**

R16. The class question prompt asks for questions of at most about 140 characters, reaction
included, so they fit the bubble and the voice (Orpheus takes 200 characters a request).
Questions already saved can be longer, and R9 covers them.

## Events

Everything this needs to be judged already exists: `class_started`, `class_hand_picked`,
`class_answered`, `class_finished`, and `voice_question_played` (`surface`, `student`,
`replay`, `source`).

One new event is proposed (open question 1):

- `class_question_shown_all` (mobile, PostHog), metadata `{ student: string }`, when the person
  taps the bubble to show the whole question before the voice gets there. It answers whether
  the reveal is too slow. `student` is a discriminator, so Maya and Omar count separately on
  one day. Not a money moment, and no lifecycle change.

## Out of scope

- Warm-ups (one student, on the tunnel) keep their current layout. The bubble could move there
  later.
- Real word timings from the voice. Orpheus gives none, so timing is estimated (R11).
- New student art beyond the seated pose and the talking mouth: no side view, no walking
  between the desk and the front.
- The results scene, the website hero and every other scene (R6).
- Any server or API change beyond the prompt (R16). The `v1` contract is untouched.

## Open questions

1. Register `class_question_shown_all`, or leave the bubble tap unmeasured?
2. R5: with hands up and nobody picked, should both sit (as specified), or both stand with hands
   up as now until one is tapped?
3. For Thursday's demo (2026-11-05), is Phase 1 enough (the bubble and the trimmed sheet), with
   the stage and the reveal after, or is the whole redesign needed by then?
