# Voice — requirements

Status: draft for Shayan, 2026-11-02. Design: the canvas "Chalkback voice class"
(https://claude.ai/artifact/SEk2abvM3j87Yatnv6enB4) and the earlier mockups 03-warm-up,
04-explain and 05-class. Feedback 3 (Thursday 5 Nov) demos the web build.

## Problem

Teaching happens by typing. Explaining a video in a text box and typing answers to Maya and
Omar feels like filling in a form, not teaching a class. At Feedback 2 the reviewer asked for
"live" question answering instead of typing back and forth. Today the students' questions are
only text, and the person can only type.

## What is there today (main at `e3c3c26`)

- **Explain** (`apps/mobile/components/class/ExplainStep.tsx`): a text box, at least
  `MIN_EXPLANATION_LENGTH` characters, then "I'm done, start the class" (`class_started`).
- **Class** (`components/class/ClassStep.tsx`): the open turn's question, a text box, "Answer",
  "Skip this one". Answers go to `POST /api/app/v1/classes/:id/turns/:turn`
  (`answerTurnBody`: an outcome and up to 5000 characters).
- **Warm-up** (`app/warm-up/[gapId].tsx`): the question, a text box, "Answer" and "I don't
  remember", through `POST /api/app/v1/warm-ups/:id/answer`.
- **API routes** are built by `createAppRoute` from `@app/contract` endpoints: bearer auth,
  Zod-parsed JSON in and out. There is no binary or multipart route, so audio travels as base64
  in JSON. Vercel caps a request body at about 4.5 MB.
- **AI calls** go through `apps/web/src/server/ai/` (Gemini only today), which logs ids and
  timings, never text.
- **Phones:** the app has no audio recording or playback module, and the microphone is blocked
  on Android unless the research widget is on. Recording on a phone needs a store build. The
  web build can record and play audio with the browser's own APIs.
- **Error codes** in the contract have no "rate limited". Adding a code would change a shape
  installed builds parse, so a busy provider answers `unavailable` (503).

## Groq, as documented (check the console before relying on the numbers)

- **Speech to text:** `whisper-large-v3-turbo` at `/openai/v1/audio/transcriptions`. Accepts
  WAV, takes an optional `prompt` of up to 224 tokens. Free tier reportedly about 20 requests a
  minute and 2,000 a day per organisation, 28,800 audio-seconds a day, each request counted as
  at least 10 seconds.
- **Text to speech:** `canopylabs/orpheus-v1-english` at `/openai/v1/audio/speech`. Six voices
  (autumn, diana, hannah, austin, daniel, troy), input at most 200 characters, WAV out.
  Listed limits: **10 requests a minute and 100 a day**.

## Success criteria

- **Voice is used:** the share of `class_answered` with `method: 'voice'`, and of
  `class_started` with `method: 'voice'`. No target yet: the first week sets the baseline.
- **Voice doesn't lose people:** class completion (`class_started` → `class_finished`, not
  ended early) does not drop in the week after release.
- **Transcription is good enough:** the share of voice answers sent without editing the
  transcript (`edited: false`).

With a handful of users these are a sanity check, not proof.

## Requirements

**Speech to text**

- R1. Explain can be spoken. "Start speaking" records; the words appear in the box phrase by
  phrase while the person speaks, about a second behind: earlier text muted, the newest phrase
  in ink with a caret. A stop button ends it, and the timer shows how long it ran.
- R2. After stopping, the whole explanation stays in the box and can be edited before "I'm
  done, start the class". The existing minimum length applies to the text, however it was
  made.
- R3. In the class and in a warm-up, "Hold to answer" records while it is held. Letting go
  transcribes what was said; sliding off the button cancels with nothing sent. A recording
  stops itself at 60 seconds.
- R4. After letting go, "Check what you said" shows the transcript, editable, with "Send to
  <student>" and "Record again". Nothing is sent to the student until the person sends it.
- R5. "Type instead" is always one tap away on explain, in the class and in a warm-up, and
  switches back to voice ("Answer out loud"). Typing works exactly as it does today.
- R6. If the microphone is blocked, missing or unsupported, the screen says so in a line and
  shows the typed answer box. Voice is never the only way in.
- R7. If transcription fails or Groq is busy, no audio is lost: a live explanation keeps
  recording and sends the rest when the person stops; a held answer offers "Try again" with the
  same recording, and typing.
- R8. Audio is never stored: not on our server, in storage or in logs. It goes to Groq and is
  discarded. Logs carry ids, durations and sizes, never transcript text.

**Text to speech**

- R9. When a question appears in the class or a warm-up, the asking student says it aloud in
  their own voice: one fixed Orpheus voice for Maya, one for Omar. The text is on screen too.
- R10. A "Replay" control next to the student's name plays the question again without a new
  request.
- R11. If speech can't be made (Groq busy, the daily limit reached, an error), the browser's own
  speech reads the question instead. If the browser has none, the question stays text-only.
  The class never waits on a voice.
- R12. The voice route only speaks questions from the caller's own class or warm-up, found by id
  on the server. It never speaks text the app sends.

**Where it runs**

- R13. Voice runs on the web build. On phones nothing changes until a store build adds
  recording and playback; phones show no voice controls until then.
- R14. The new routes are new `v1` endpoints, and existing endpoints only gain optional fields.
  No database change.
- R15. `GROQ_API_KEY` is read only on the server, declared in the env schema and
  `.env.example`. Unset, voice answers `not_configured` and the app shows typing only.
- R16. The privacy policy names Groq as processing voice recordings and generating the
  students' voices.

## Events

All in the app's registry (`apps/mobile/lib/analytics.ts`, `EventName`), PostHog only. The server
fires none of them. Not a money moment, and no lifecycle change.

- **The aha:** an answer sent by voice: `class_answered` with `method: 'voice'`.
- **Expected drop-off:** hold → recording → transcript → sent. People may stop at the microphone
  prompt, after a bad transcript, or by switching to typing.

| Event                           | When                                          | Properties                                                                      |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| `voice_recording_started` (new) | Recording starts                              | `surface`: `explain` \| `class` \| `warm_up`                                    |
| `voice_recording_failed` (new)  | Voice couldn't be used or a transcript failed | `surface`, `reason`: `denied` \| `unsupported` \| `transcribe_failed` \| `busy` |
| `voice_typed_instead` (new)     | "Type instead" tapped                         | `surface`                                                                       |
| `voice_question_played` (new)   | A question is spoken                          | `surface`, `student`, `replay`: boolean, `source`: `groq` \| `browser`          |
| `class_started` (exists)        | Gains properties                              | `method`: `voice` \| `typed`, `edited`: boolean (voice only)                    |
| `class_answered` (exists)       | Gains properties                              | `method`, `edited` (only when `outcome` is answered or needed_help)             |
| `warm_up_answered` (exists)     | Gains properties                              | `method`, `edited`                                                              |

`surface` is the discriminator on every voice event.

## Out of scope

- Voice on phones (needs a store build: a recording module, the microphone permission and its
  purpose string, and the store privacy forms).
- A full duplex conversation (talking over the students, interruptions, Groq's or Gemini's
  realtime APIs).
- Spoken private help, results or home.
- Choosing voices in settings, or a mute setting that persists.
- Keeping or replaying the person's own recordings.

## Open questions

1. **Voices:** which Orpheus voice is Maya and which is Omar? Proposed: Maya `autumn`, Omar
   `daniel`.
2. **Orpheus's 100 requests a day:** a class asks about 4–6 questions, and a long question takes
   two requests (200 characters each). That's roughly 15–20 classes a day before every voice
   falls back to the browser's. Enough for the demo; real use needs Groq's paid tier. Accept for
   now?
3. **Free tier and privacy:** confirm the Groq account's limits and data terms in the console
   before real users record their voices.
