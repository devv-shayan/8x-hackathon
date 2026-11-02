import 'server-only'
import {
	SPEECH_SAMPLE_RATE,
	MAX_SPEECH_SECONDS,
	type SpeakQuestionBody,
	type SpeechFormat,
	type SpeakQuestionResponse
} from '@app/contract'
import { SPEAK_MAX_CHARS, speak, transcribe } from '@/server/ai/groq'
import { ApiError } from '@/server/api/app-errors'
import { questionStore, type QuestionStore } from '@/server/db/questions'
import { splitForSpeech } from './split'
import { joinWavs, readWav } from './wav'

// The speech routes' work: a recording to text, and a student's question to their voice.
// Audio passes through memory only: nothing here writes it anywhere.

/** Each student's Orpheus voice. A student with another name speaks as Maya does. */
export const STUDENT_VOICES: Record<string, string> = { Maya: 'autumn', Omar: 'daniel' }
const DEFAULT_VOICE = 'autumn'
/** A recording may run a little over the cap: the app stops it on a timer, not to the sample. */
const SECONDS_GRACE = 2

export type SpeechDeps = {
	transcribe: typeof transcribe
	speak: typeof speak
	questions: QuestionStore
}

/** What the routes use; tests replace its members. */
export const speechDeps: SpeechDeps = { transcribe, speak, questions: questionStore }

/** An m4a's `ftyp` box, four bytes in: how an MPEG-4 file starts. */
function isMp4(bytes: Uint8Array) {
	return bytes.byteLength > 12 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp'
}

/** The text of a base64 recording the app made, read on from `prompt`. */
export async function transcribeRecording(
	deps: Pick<SpeechDeps, 'transcribe'>,
	audioBase64: string,
	prompt: string | undefined,
	format: SpeechFormat = 'wav'
): Promise<string> {
	const audio = new Uint8Array(Buffer.from(audioBase64, 'base64'))
	let seconds: number | null = null
	if (format === 'wav') {
		const info = readWav(audio)
		if (!info || info.sampleRate !== SPEECH_SAMPLE_RATE || info.channels !== 1) {
			throw new ApiError('invalid_request', "That recording didn't come through. Try again.")
		}
		if (info.seconds > MAX_SPEECH_SECONDS + SECONDS_GRACE) {
			throw new ApiError('invalid_request', 'That recording is too long. Keep it under a minute.')
		}
		seconds = Math.round(info.seconds)
	} else if (!isMp4(audio)) {
		// A phone's m4a has no length to check here: the body's size cap bounds it instead.
		throw new ApiError('invalid_request', "That recording didn't come through. Try again.")
	}
	return deps.transcribe(
		{ feature: 'transcribe', meta: seconds === null ? {} : { seconds } },
		audio,
		prompt?.trim() || undefined,
		format
	)
}

/** A question from the caller's own class or warm-up, spoken by the student who asked it. */
export async function speakQuestion(
	deps: SpeechDeps,
	userId: string,
	body: SpeakQuestionBody
): Promise<SpeakQuestionResponse> {
	const found =
		'warm_up_id' in body
			? await deps.questions.forWarmUp(userId, body.warm_up_id)
			: await deps.questions.forTurn(userId, body.class_id, body.turn_id)
	if (!found) throw new ApiError('not_found', "We couldn't find that question.")
	const voice = STUDENT_VOICES[found.studentName] ?? DEFAULT_VOICE
	const pieces = splitForSpeech(found.question, SPEAK_MAX_CHARS)
	if (pieces.length === 0) throw new ApiError('not_found', "We couldn't find that question.")
	// All at once: a long question takes as long as its slowest piece, not their sum. A
	// question is two pieces at most in practice, well inside Orpheus's per-minute limit.
	const clips = await Promise.all(
		pieces.map((piece, i) =>
			deps.speak(
				{ feature: 'speak_question', meta: { piece: i + 1, pieces: pieces.length } },
				piece,
				voice
			)
		)
	)
	const audio = clips.length === 1 ? clips[0]! : joinWavs(clips)
	return {
		audio_base64: Buffer.from(audio).toString('base64'),
		student_name: found.studentName
	}
}
