import 'server-only'
import { ApiError } from '@/server/api/app-errors'
import { log } from '@/server/lib/logger'

// Groq wrapper: the only file that calls Groq. Speech to text (Whisper) and the students'
// voices (Orpheus), over plain fetch. Every call logs what it used: ids, sizes and timings,
// never what was said.

export const TRANSCRIBE_MODEL = 'whisper-large-v3-turbo'
export const SPEAK_MODEL = 'canopylabs/orpheus-v1-english'
/** Orpheus takes at most this many characters per request. */
export const SPEAK_MAX_CHARS = 200

const BASE_URL = 'https://api.groq.com/openai/v1'
const TIMEOUT_MS = 30_000
/** Statuses a later try can get past: too many requests, or Groq itself struggling. */
const BUSY_STATUSES = [429, 500, 502, 503, 504]

export type GroqContext = {
	/** What the call is for, like `transcribe_answer`. */
	feature: string
	/** Ids, enums and numbers only: never text. */
	meta?: Record<string, string | number | boolean>
}

function apiKey(): string {
	const key = process.env.GROQ_API_KEY
	if (!key)
		throw new ApiError('not_configured', "Voice isn't set up yet. Type your answer instead.")
	return key
}

async function call(context: GroqContext, model: string, path: string, init: RequestInit) {
	const startedAt = Date.now()
	let response: Response
	try {
		response = await fetch(`${BASE_URL}${path}`, {
			...init,
			headers: { Authorization: `Bearer ${apiKey()}`, ...init.headers },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		})
	} catch (error) {
		if (error instanceof ApiError) throw error
		throw new ApiError('unavailable', 'Voice is busy right now. Try again, or type instead.', {
			cause: error
		})
	}
	log.info('ai call', {
		source: 'ai/groq',
		feature: context.feature,
		model,
		...context.meta,
		status: response.status,
		latency_ms: Date.now() - startedAt
	})
	if (response.ok) return response
	if (BUSY_STATUSES.includes(response.status)) {
		throw new ApiError('unavailable', 'Voice is busy right now. Try again, or type instead.')
	}
	// A 4xx other than 429 is our request or our key: the detail goes to the log, not the person.
	const detail = (await response.text().catch(() => '')).slice(0, 300)
	throw new ApiError('internal', 'Voice failed on our side. Type your answer instead.', {
		cause: new Error(`Groq ${response.status}: ${detail}`)
	})
}

/** The text of one WAV recording, read on from `prompt` (what was already said). */
export async function transcribe(
	context: GroqContext,
	wav: Uint8Array,
	prompt?: string
): Promise<string> {
	const form = new FormData()
	form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'speech.wav')
	form.append('model', TRANSCRIBE_MODEL)
	form.append('language', 'en')
	form.append('temperature', '0')
	form.append('response_format', 'json')
	if (prompt) form.append('prompt', prompt)
	const response = await call(
		{ ...context, meta: { ...context.meta, audio_bytes: wav.byteLength } },
		TRANSCRIBE_MODEL,
		'/audio/transcriptions',
		{ method: 'POST', body: form }
	)
	const body = (await response.json()) as { text?: unknown }
	return typeof body.text === 'string' ? body.text.trim() : ''
}

/** One WAV clip of `text` (at most SPEAK_MAX_CHARS) in `voice`. */
export async function speak(
	context: GroqContext,
	text: string,
	voice: string
): Promise<Uint8Array> {
	const response = await call(
		{ ...context, meta: { ...context.meta, input_chars: text.length } },
		SPEAK_MODEL,
		'/audio/speech',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: SPEAK_MODEL, input: text, voice, response_format: 'wav' })
		}
	)
	return new Uint8Array(await response.arrayBuffer())
}
