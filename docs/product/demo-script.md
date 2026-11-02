# Demo script: Feedback 3 (Thursday 5 Nov)

For Shayan and Arif. Feedback 2 asked two things: why would someone come back, and could
answering be live instead of typing. Lead with the first, show the second.

## Before the call

1. Use the web build that's already signed in. Production sign-in by email is limited to the
   Supabase team's addresses until custom SMTP is set up, so don't sign out.
2. Check `GROQ_API_KEY` is set wherever you demo (`apps/web/.env.local` locally, Vercel for the
   deployed app). Without it, voice falls back to typing and the browser's voice.
3. Make a warm-up due: `npm run db:seed-due-gap -- <your user id>`.
4. Allow the microphone once in the browser before the call, so the permission prompt doesn't
   appear on screen.
5. Mind the free tier: Orpheus allows 100 voices a day. Rehearse the morning before, not ten
   times in a row.

## The script (about 4 minutes)

**SHAYAN, the retention answer (30 s)**
"Last time you asked why someone would come back. Every idea you miss in class becomes a gap. A
student brings it back as a warm-up: two days after a miss, five after a right answer, until you
get it right twice and it closes. The app reminds you; you don't have to remember."

**SHAYAN, the warm-up, by voice (45 s)**
Paste a YouTube link. While it's read, Maya's warm-up comes up and she asks it out loud. Hold to
answer, say it, let go, show "What you said", send. "That's right. It comes back Saturday", or
"Two right in a row. This one is closed."

**ARIF, explaining out loud (60 s)**
"Explain your new video." Tap Start explaining and talk; the words appear as you speak. Stop,
fix a word, "I'm done, start the class."

**ARIF, the class (60 s)**
"Hands are up." Call on Omar; he says his question. Hold to answer, speak, send. Open "I'll be
back" once to show private help. Answer one more, then show the results: what you taught, what
you fixed in class, when each missed idea comes back.

**SHAYAN, the topic page and next steps (30 s)**
"Each video shows its gaps and when they come back. Next: a reminder when a warm-up is due, a
weekly check-in on home, and voice on phones with the store build."

## Words to say if you blank

- Explanation (Matt Cutts, _Try something new for 30 days_): "When you feel stuck in a rut, try
  something new for 30 days. Thirty days is long enough to build a habit and short enough to stick
  with it. Because each day is different, the month becomes memorable."
- Confidence: "Doing the challenges made him more confident. He went from sitting at his desk to
  climbing Mount Kilimanjaro."
- The novel: "Even a crazy goal fits in 30 days: he wrote a 50,000-word novel at about 1,667
  words a day."
- Small changes: "Small, sustainable changes stick. Giving up sugar for a month didn't last."
- Photosynthesis warm-up: "Leaves use sunlight to turn water and carbon dioxide into sugar. The
  soil only gives water and minerals."

## If something goes wrong

- A voice doesn't play: tap Replay, or keep going. The question is on screen.
- The microphone fails: tap Type instead and use the lines above.
- A class answer is slow: Gemini can take about 20 s per call. Talk over it ("the class is
  thinking"); the app catches up on its own.
