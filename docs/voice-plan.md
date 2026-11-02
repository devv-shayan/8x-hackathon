# Voice — plan

Goes with [voice-requirements.md](voice-requirements.md). The demo on Thursday 5 Nov runs on the
web build, so every phase targets the web. All of it is JavaScript and server code: it ships to
the web on merge and to phones as an update that shows them nothing new (R13). One PR per
phase, each with green CI.

## Phase 1 — Groq on the server, the two routes, the events

**Files:**

- `apps/web/src/lib/env.ts`, `apps/web/.env.example`: `GROQ_API_KEY` (optional, server only).
- `apps/web/src/server/ai/groq.ts` (new): the only file that calls Groq, with `fetch` (no new
  dependency). `transcribe(context, wav, prompt)` and `speak(context, text, voice)`. Logs
  feature, model, latency, audio bytes and characters; never text. Unset key → `not_configured`;
  Groq 429 or 5xx → `unavailable`.
- `apps/web/src/server/speech/` (new):
  - `wav.ts`: read a WAV header, join WAV clips of one format (for questions over 200
    characters), with tests.
  - `split.ts`: split a question into pieces of at most 200 characters at sentence, then word,
    boundaries, with tests.
  - `questions.ts`: find the question and its student for a class turn or a warm-up, by id and
    the caller's `userId` in the query (a turn or warm-up that isn't theirs is a 404).
- `packages/contract/src/v1/speech.ts` (new), `endpoints.ts`, `index.ts`:
  - `transcribeSpeech`: `POST /api/app/v1/speech/transcriptions`, body `{ audio_base64, prompt? }`
    (WAV, at most 60 seconds of 16 kHz mono, so about 2.6 MB of base64; the prompt at most 1,000
    characters, the tail of what was already said), response `{ text }`.
  - `speakQuestion`: `POST /api/app/v1/speech/questions`, body
    `{ class_id, turn_id } | { warm_up_id }`, response `{ audio_base64, student_name }`.
- `apps/web/src/app/api/app/v1/speech/transcriptions/route.ts`,
  `.../speech/questions/route.ts` (new), each with a route test: no session (401), a turn that
  isn't yours (404), no key (503), Groq busy (503), a happy path with Groq faked.
- `apps/mobile/lib/analytics.ts`: register `voice_recording_started`, `voice_recording_failed`,
  `voice_typed_instead`, `voice_question_played`, and document `method` and `edited` on
  `class_started`, `class_answered` and `warm_up_answered` (the `events` skill).
- `apps/web/src/app/privacy/page.tsx`: Groq processes voice recordings and makes the students'
  voices; recordings are not kept (R16).

**Verify:** `npm test` (contract, route, wav and split tests), `npm run check:env`,
`npm run check:events`, then with a real key on `localhost:3001`: a curl of each route with a
signed-in bearer token returns text and playable audio.

## Phase 2 — The students speak

**Files (`apps/mobile/`):**

- `lib/voice/playback.web.ts` and `playback.ts` (new): play WAV from base64 with the browser's
  `Audio`; the native file reports unsupported. `speakWithBrowser(text)` uses
  `speechSynthesis` when present.
- `hooks/useQuestionVoice.ts` (new): when a question id appears, fetch its audio once
  (`speakQuestion`), play it, keep it in memory for Replay; on failure fall back to
  `speakWithBrowser`. Fires `voice_question_played`. Stops when the screen loses focus or the
  question changes.
- `components/class/ClassStep.tsx`, `app/warm-up/[gapId].tsx`: "Replay" beside
  "<Student> · …" (R10), web only.

**Verify:** a class and a warm-up on the web build: each new question is heard in the right
student's voice, Replay repeats it without a network request, and with the key removed the
browser's voice reads it instead. A render test for Replay with playback mocked.

## Phase 3 — Hold to answer, in the class and warm-ups

**Files (`apps/mobile/`):**

- `lib/voice/wav.ts` (new): 16-bit PCM to WAV, with a test.
- `lib/voice/recorder.web.ts` and `recorder.ts` (new): `getUserMedia`, an `AudioWorklet` that
  hands back 16 kHz mono PCM, start, stop, cancel, a level for the wave, and a 60-second cap.
  The native file reports unsupported. `isVoiceSupported()` decides whether voice controls show.
- `hooks/useTranscribe.ts` (new): WAV to base64 to `transcribeSpeech`, keeping the recording so
  "Try again" resends it (R7).
- `components/voice/HoldToAnswer.tsx` (new): the button (press records, release transcribes,
  sliding off cancels), the recording strip (timer, live wave) and "Let go to send".
- `components/voice/CheckAnswer.tsx` (new): "What you said · tap to fix a word", "Send to
  <student>", "Record again", "Skip this one".
- `components/class/ClassStep.tsx`, `app/warm-up/[gapId].tsx`: voice first where supported, "Type
  instead" / "Answer out loud" to switch, the microphone-blocked line (R6). The answer still goes
  through `answerTurn` / `answerWarmUp` unchanged; `class_answered` and `warm_up_answered` gain
  `method` and `edited`.

**Verify:** on the web build, answer one class question and one warm-up by voice, one by typing,
cancel one by sliding off, and deny the microphone once (the typed box shows). Render tests for
the hold → check → send flow with the recorder and API mocked. PostHog shows the new
properties.

## Phase 4 — Explain out loud, live

**Files (`apps/mobile/`):**

- `lib/voice/segmenter.ts` (new): cuts the PCM stream at a pause (about 400 ms below a level)
  or at 6 seconds, whichever comes first, with tests on synthetic audio.
- `hooks/useLiveTranscript.ts` (new): sends each piece in order, with the tail of the text so
  far as `prompt`; appends each result; if Groq is busy, holds the pieces and sends them as one
  when the person stops (R7).
- `components/class/ExplainStep.tsx`: the 04-explain layout: "Type instead" in the top bar, the
  words with the newest phrase in ink and a caret, the timer, the wave and the lime stop
  button. After stopping, the text is editable (R2). `class_started` gains `method` and
  `edited`.

**Verify:** explain the Matt Cutts video out loud for about a minute on the web build: text
appears phrase by phrase, about a second behind; stop, fix a word, start the class. Repeat with
Groq faked busy halfway: the rest arrives at stop. Tests for the segmenter and for the hook's
ordering and busy fallback.

## Phase 5 — Ship and record

- `npm run check:store` and the `store-review` skill (phones get JavaScript that hides voice, so
  this is an update, not a store build).
- `docs/memory/`: a note on Groq (model ids, limits found in the console, the voices chosen).
- The Thursday demo script: explain out loud, answer Omar by voice, a warm-up by voice.

## Risks

- **Orpheus's 100 requests a day.** The demo fits; real use doesn't. The browser's voice is the
  fallback (R11), so nothing breaks when the limit is hit. A paid Groq tier is the fix.
- **Whisper's 20 requests a minute per organisation.** Live explain sends a piece every few
  seconds. Two people explaining at the same time can hit it; the busy fallback (R7) keeps the
  audio and finishes at stop.
- **Request size.** A 60-second WAV is about 2.6 MB in base64, under Vercel's 4.5 MB. The
  recorder's cap and the contract's limit keep it there.
- **Browser support.** `AudioWorklet` and `getUserMedia` need a secure context (https or
  localhost) and are missing in some in-app browsers; R6 covers it.
- **Abuse.** A signed-in person could send audio to transcribe in a loop. The size cap limits each
  call; a per-user rate limit is a follow-up if it shows up in the logs.
- **No money, entitlement, auth or Play Stats API code is touched**, and no migration.

Sources for the Groq figures: [Speech to text](https://console.groq.com/docs/speech-to-text),
[Orpheus](https://console.groq.com/docs/text-to-speech/orpheus),
[Rate limits](https://console.groq.com/docs/rate-limits).
