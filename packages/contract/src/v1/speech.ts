import { z } from 'zod'
import { uuid } from './common'

// /api/app/v1/speech: what the person says, as text, and the students' questions, as audio.
// Audio travels as base64 WAV inside JSON, like every other v1 body. Nothing is stored.
//
// POST speech/transcriptions → the text of one recording (a held answer, or a piece of a
//                              spoken explanation)
// POST speech/questions      → a class or warm-up question, spoken by the student who asks it

/** The longest recording one request takes: a held answer stops itself here. */
export const MAX_SPEECH_SECONDS = 60
/** 16 kHz mono 16-bit WAV, the format the app records in. */
export const SPEECH_SAMPLE_RATE = 16_000
/** MAX_SPEECH_SECONDS of that WAV in base64, with room for the header. */
export const MAX_SPEECH_BASE64_CHARS = 2_600_000
/** The text already said, sent so a piece of a longer explanation reads on from it. */
export const MAX_SPEECH_PROMPT_CHARS = 1000

export const transcribeSpeechBody = z
	.object({
		audio_base64: z.string().min(1).max(MAX_SPEECH_BASE64_CHARS),
		prompt: z.string().max(MAX_SPEECH_PROMPT_CHARS).optional()
	})
	.strict()

export const transcribeSpeechResponse = z.object({
	/** Empty when the recording held no speech. */
	text: z.string()
})

/** Which question to speak: the server finds its text, and only in the caller's own rows. */
export const speakQuestionBody = z.union([
	z.object({ class_id: uuid, turn_id: uuid }).strict(),
	z.object({ warm_up_id: uuid }).strict()
])

export const speakQuestionResponse = z.object({
	/** WAV. */
	audio_base64: z.string(),
	student_name: z.string()
})

export type TranscribeSpeechBody = z.infer<typeof transcribeSpeechBody>
export type SpeakQuestionBody = z.infer<typeof speakQuestionBody>
export type SpeakQuestionResponse = z.infer<typeof speakQuestionResponse>
