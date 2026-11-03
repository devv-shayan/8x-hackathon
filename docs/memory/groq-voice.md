---
name: groq-voice
description: Voice runs on Groq (Whisper for speech to text, Orpheus for the students' voices), on the web and in the phone app; the limits, the voices, and the traps found setting it up
metadata:
  type: project
---

Voice (docs/voice-requirements.md, shipped in PRs #41–#44 on 2026-11-02) runs on Groq, chosen by
Shayan over Gemini and local models. `GROQ_API_KEY` lives in `apps/web/.env.local` and Vercel only;
the app never needs it, so keep it out of `apps/mobile/.env.local`.

- **Speech to text:** `whisper-large-v3-turbo`. About 1 s for 8 s of audio, word-perfect on clear
  speech. Names come out wrong without context ("Matt Cuts"), so each request sends the video's
  title or the question as `prompt`.
- **Voices:** `canopylabs/orpheus-v1-english`, Maya `autumn`, Omar `daniel`
  (`apps/web/src/server/speech/speech.ts`). 200 characters per request; longer questions are
  spoken in pieces and joined.
- **Orpheus needs its terms accepted once** by the Groq organisation's admin in the console, or every
  request is a 400 `model_terms_required`. Shayan accepted them on 2026-11-02. A new Groq account or
  organisation needs it again.
- **Limits (free tier, from Groq's docs, not confirmed in the console):** Whisper about 20
  requests a minute and 2,000 a day per organisation; Orpheus 10 a minute and **100 a day**. A
  class uses about 4–6 voice requests, so Orpheus runs out after roughly 15–20 classes a day and
  the students fall back to the browser's own voice. Real use needs Groq's paid tier.
- **Phones (#46, 2026-11-03):** expo-audio records 16 kHz mono AAC m4a (Android can't record WAV),
  sent whole at stop, so a phone explanation is written down at the end, not live. Shayan confirmed
  it works in Expo Go on a real phone. Installed builds need a store build for it, and none exists:
  `app.json`'s `updates.url` is still the `REPLACE_WITH_YOUR_EAS_PROJECT_ID` placeholder. With
  that build, the privacy labels and Play's Data safety form must add Audio data.
- **expo-audio turns background playback on by default** (an iOS background mode and an Android
  foreground service that both stores ask you to justify): `app.json` turns it off explicitly.
- **Testing without a microphone:** in the browser, replace `navigator.mediaDevices.getUserMedia`
  with a stream from a WAV (`say -o x.wav --file-format=WAVE --data-format=LEI16@16000 "…"`, with
  `[[slnc 900]]` for pauses). That's how phases 3 and 4 were checked live.

Related: [[app-name]].
