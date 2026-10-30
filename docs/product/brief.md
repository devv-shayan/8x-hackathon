# Product brief

Playmakers C2 · theme: learning that sticks · pair: Shayan Khan and Sayed Arif
Status: draft for the pair to review, 2026-10-29 (day 2)

## The idea

You only understand something if you can teach it. The user watches a
YouTube video, explains it in their own words, then teaches it to AI
students who ask questions. The video is the source of truth, so every gap
the app points out is tied to what the video actually said.

**Who it's for:** self-learners who study from YouTube and want to know
whether it stuck. We test with biology and psychology videos first; history
is harder to judge (dates and interpretation).

## What already exists

From each product's home page, 2026-10-29:

| Product                                            | What it does                                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [LaoshiAI](https://www.laoshiaiapp.com/)           | YouTube, PDF or audio in; explain out loud to an AI learner (age 5, 12, 16 or 22); shows what you missed; spaced-repetition flashcards. Closest to our idea                |
| [NotePal](https://www.notepal.net/)                | YouTube, PDF or lecture in; notes, quizzes, flashcards; a "Feynman AI" student with an understanding meter                                                                 |
| [TeachBack](https://tryteachback.app/)             | Teach AI students in a virtual classroom from uploaded notes; scores clarity, accuracy, completeness; XP, ranks, streaks. Doesn't list YouTube. Also the name we can't use |
| [Reasonate](https://www.tryreasonate.com/)         | Teach the AI; it voices plausible misconceptions for you to correct; mastery levels and leaderboards                                                                       |
| [GapFinder](https://github.com/katjaweb/gapfinder) | Open-source: YouTube transcript to diagnostic questions to a gap report that points to sections to rewatch                                                                 |

"Paste a video, explain it, teach an AI, find gaps" is not new, and neither
are classrooms, XP or links back into the video. Two things none of their
home pages mention:

1. **Students who remember you.** The same students return in later
   sessions and ask about what you taught them before. LaoshiAI and NotePal
   use flashcards for review; TeachBack uses streaks.
2. **Getting unstuck without leaving the class.** When a student asks
   something the user can't answer, the user says "I'll be back", learns it
   in a private help panel, and returns to answer.

## Why it fits the theme

| 8x's rule                      | How the app answers it                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Coming back on day 3 and day 7 | Every gap is re-asked by a student on a schedule: 2 days after it's found, then 5 days after a right answer (below) |
| Practice, not just content     | Explaining and answering questions is active recall                                                                 |
| Small and daily                | A class is about 10 minutes, capped at 4 questions; a warm-up is about a minute                                     |
| Seeing progress                | Each topic shows its gaps closing over time                                                                         |

Known weakness: nothing reaches the user outside the app yet. The home
screen shows due warm-ups only when they open it. An email reminder is the
real fix, listed under "Next".

## The core loop

1. **Add a video.** Paste a YouTube link. The app transcribes it with
   timestamps, then finds the key concepts in the transcript. Private,
   silent or over-length videos get a clear message instead.
2. **Warm-up.** While the video is being read, a student from a past class
   asks about a gap that's due. This fills the wait.
3. **Explain it.** The user explains the new video in their own words.
4. **Teach the class.** Students raise hands and ask about what the user got
   wrong or left out. The user picks who to answer. Up to 4 questions.
5. **"I'll be back."** If the user can't answer, they open the help panel,
   learn it from the transcript, and return to answer.
6. **Assessment.** Which key concepts were explained correctly ("6 of 8"),
   which were missed or wrong with their video timestamps, and how each
   question went: answered, needed help, or skipped. Students add a short
   in-character reaction.

**Gap schedule.** Every missed or wrong concept becomes a gap. It's due
for a warm-up 2 days later. Answered right, it's due again 5 days later;
right again, it's closed. Answered wrong, it's due again in 2 days. That puts
reviews at roughly day 2–3 and day 7.

## Scope

Per `docs/rules/feature-approach.md`: the smallest version that proves the
loop.

**MVP (whole loop working by feedback session 2, Mon Nov 2)**

- Add a video: transcript and key concepts
- Explain, class, help panel, assessment, all text-based
- Students and gaps saved, warm-ups on the gap schedule
- Home and a topic page
- A phone-first Expo app, also run in the browser for the demo
- Email-code sign-in, from the template

**Next (if the MVP is solid before Nov 5)**

- Voice: explain and answer out loud
- Email reminder when a warm-up is due
- More student personas, avatars, hand-raise animation and other playful
  touches (Arif's idea from call 3)

**Not now:** inputs other than YouTube, store releases, deploying (8x said
localhost is fine), and XP or streaks, which competitors already have and
which wouldn't set us apart.

## Screens

1. **Home.** Link box ("What did you learn today?"), due warm-ups, recent
   topics.
2. **Explain.** Video title, a text box, "I'm done".
3. **Class.** Left: students, raised hands, the conversation, an answer box.
   The private help panel slides up from the bottom. "End class".
4. **Assessment.** The results from step 6, with links into the video.
5. **Topic.** One video's gaps and how each warm-up went.

## How the AI works

The Expo app never calls AI directly. It calls `/api/app/v1` on the Next.js
server, and all AI calls go through `apps/web/src/server/ai/gemini.ts`, which
logs what each one used. Reading the video uses `gemini-3.5-flash-lite` in
static mode, the best of the models we tested on speed and timestamp
accuracy.

| Step                 | Input                                                                    | Output                                                           |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Read the video       | YouTube link                                                             | Full transcript with timestamps. Nothing else                    |
| Find key concepts    | Transcript                                                               | Title, 5–10 key concepts, each with an exact quote and timestamp |
| Score an explanation | Explanation, key concepts, transcript                                    | Each concept correct, missed or wrong                            |
| Student turn         | Transcript, gaps, the class so far, the student's persona and past turns | Who raises a hand and what they ask, or "no more questions"      |
| Help panel           | Transcript and the student's question                                    | A short explanation from the transcript                          |
| Assessment           | The whole class and the transcript                                       | Per-concept and per-question results, student reactions          |
| Warm-up              | A due gap and its transcript                                             | One in-character question, then right or wrong                   |

Every AI output the UI treats as data is structured and validated with Zod.
The video is transcribed once per topic; every later step reads the stored
transcript, never the video again.

Key concepts are the checklist every result is measured against, so a wrong
one skews everything after it. Three safeguards: code drops any concept
whose quote isn't in the transcript; extraction is tested on 5–6 real
videos before anything is built on it; and the user can flag a concept as
"not in the video", which removes it from their results.

To check first, on day 2: that Gemini accepts a YouTube link with our key
and model, and that the timestamps are accurate enough to link to. If they
aren't, we show concepts without a timestamp rather than a wrong one.

## Data model (sketch)

- **Topic:** YouTube link, title, transcript, key concepts (quote,
  timestamp)
- **Student:** name, persona (beginner or critical thinker)
- **Class:** topic, the explanation, per-concept results, reactions
- **ClassTurn:** class, student, question, answer, outcome (answered,
  needed help, skipped)
- **Gap:** topic, concept, open or closed, next due date
- **WarmUp:** gap, student, question, answer, right or wrong, date

## Proposed split

Split by feature, so each of us builds and demos whole features (8x rates
us individually). Both of us are full-stack.

| Shayan                                                              | Arif                                         |
| ------------------------------------------------------------------- | -------------------------------------------- |
| Gemini module; reading the video; key concepts and their safeguards | Home and the explain screen                  |
| Class screen: students, questions, raised hands                     | Scoring and the assessment screen            |
| Help panel                                                          | Gaps, the gap schedule, warm-ups, topic page |

Together on day 2: the database schema and the shape of the transcript and
key concepts, so Arif can build on sample data before the AI side is ready.
Shared: testing the whole loop with real videos, demos, the README.

## Plan to the deadline

| Day | Date       | Goal                                                                                                 |
| --- | ---------- | ---------------------------------------------------------------------------------------------------- |
| 2   | Thu Oct 29 | Agree this brief, the split and the schema; transcript and key concepts tested on real videos        |
| 3   | Fri Oct 30 | **Feedback 1.** Idea, how it differs, the retention answer, the split, video to key concepts working |
| 3–5 | Fri–Sun    | Explain, class, help panel, assessment                                                               |
| 6   | Mon Nov 2  | **Feedback 2.** Whole loop with real videos, including a warm-up from a seeded past class            |
| 7–8 | Tue–Wed    | Act on feedback, topic page, UI polish, voice if time allows                                         |
| 9   | Thu Nov 5  | **Feedback 3.** Final demo                                                                           |
| 10  | Fri Nov 6  | Fixes from feedback 3, final updates                                                                 |

## Open decisions

- **One student or two.** Two (beginner and critical thinker) is Shayan's
  classroom; one is simpler and was Arif's preference in call 4. The loop
  works with either.
- **Name.** Shortlist: Recallio (Arif's pick in call 4), Nowly, Mentiq,
  Knowly, LearnLoop. None checked for availability yet.
- **The split above** is a proposal.
- **Longest video we accept**, to keep cost and wait time down.
