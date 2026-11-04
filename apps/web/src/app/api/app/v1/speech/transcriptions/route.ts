import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { speechDeps, transcribeRecording } from '@/server/speech/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/app/v1/speech/transcriptions: the text of one recording the app made, a held
 * answer or a piece of a spoken explanation: WAV from the web build, m4a from a phone. `prompt` is what was already said, so a piece
 * reads on from it. The audio goes to Groq and nowhere else: it is never stored.
 */
export const POST = createAppRoute(endpoints.transcribeSpeech, async ({ body }) => {
	const text = await transcribeRecording(speechDeps, body.audio_base64, body.prompt, body.format)
	return { body: { text } }
})
