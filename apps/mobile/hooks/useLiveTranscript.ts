import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_SPEECH_PROMPT_CHARS, SPEECH_SAMPLE_RATE } from '@app/contract'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'
import { RecorderError, useRecorder } from '@/lib/voice/recorder'
import { MIC_SETTINGS, type RecordedAudio, type Recording } from '@/lib/voice/recording'
import { createSegmenter, type Segmenter } from '@/lib/voice/segmenter'
import { encodeWav, toBase64 } from '@/lib/voice/wav'
import type { VoiceFailure } from './useVoiceAnswer'

// Explaining out loud, written down as you go (docs/voice-requirements.md, R1, R2, R7). On the
// web, each piece the segmenter cuts goes to the speech route in order, with the tail of what
// was already said, and its text is added to the explanation. If Groq is busy, the pieces wait
// and are sent together when the person stops, so nothing said is lost. A phone's recorder
// hands over one file at the end (`streams` is false), so there the words come at stop.
// Audio lives in memory only.

/** idle: not recording (the text can be edited). recording. finishing: writing down the end. */
export type LivePhase = 'idle' | 'recording' | 'finishing' | 'failed'

const TRANSCRIBE_TIMEOUT_MS = 30_000
/** A spoken explanation stops itself here. */
const MAX_EXPLAIN_SECONDS = 5 * 60
/** Held-back audio is sent in requests of at most this long (the route takes up to 60 s). */
const BACKLOG_CHUNK_SECONDS = 55
const WAVE_BARS = 44
const TICK_MS = 100

function tail(text: string) {
	return text.slice(-Math.floor(MAX_SPEECH_PROMPT_CHARS * 0.6)).trim()
}

/**
 * The video's title as a sentence, for the first piece's context. Whisper copies its prompt's
 * style, so a bare title (no full stop) brings back text without punctuation.
 */
function titleSentence(title?: string | null) {
	const clean = title?.trim()
	return clean ? `Explaining the video “${clean}”.` : ''
}

function join(text: string, more: string) {
	return text ? `${text} ${more}` : more
}

/** `pieces` back to back, in runs of at most BACKLOG_CHUNK_SECONDS. */
function chunk(pieces: Float32Array[]): Float32Array[] {
	const max = BACKLOG_CHUNK_SECONDS * SPEECH_SAMPLE_RATE
	const runs: Float32Array[][] = [[]]
	let size = 0
	for (const piece of pieces) {
		if (size + piece.length > max && runs.at(-1)!.length > 0) {
			runs.push([])
			size = 0
		}
		runs.at(-1)!.push(piece)
		size += piece.length
	}
	return runs
		.filter((run) => run.length > 0)
		.map((run) => {
			const all = new Float32Array(run.reduce((sum, piece) => sum + piece.length, 0))
			let at = 0
			for (const piece of run) {
				all.set(piece, at)
				at += piece.length
			}
			return all
		})
}

/** `context` (the video's title) steers the first piece's spelling, before anything is said. */
export function useLiveTranscript(context?: string | null) {
	const [phase, setPhase] = useState<LivePhase>('idle')
	const [text, setTextState] = useState('')
	/** The newest phrase, drawn in ink while the rest is muted. */
	const [latest, setLatest] = useState('')
	const [failure, setFailure] = useState<VoiceFailure | null>(null)
	const [seconds, setSeconds] = useState(0)
	const [levels, setLevels] = useState<number[]>([])
	const textRef = useRef('')
	const spoken = useRef('')
	const queue = useRef<Promise<void>>(Promise.resolve())
	const backlog = useRef<Float32Array[]>([])
	/** A phone's whole recording, until it's written down. */
	const held = useRef<RecordedAudio | null>(null)
	const recorder = useRecorder()
	const recording = useRef<Recording | null>(null)
	const segmenter = useRef<Segmenter | null>(null)

	const setText = useCallback((next: string) => {
		textRef.current = next
		setTextState(next)
		setLatest('')
	}, [])

	const append = useCallback((more: string) => {
		const clean = more.trim()
		if (!clean) return
		textRef.current = join(textRef.current, clean)
		spoken.current = join(spoken.current, clean)
		setTextState(textRef.current)
		setLatest(clean)
	}, [])

	const transcribeAudio = useCallback(
		async (audio: Pick<RecordedAudio, 'base64' | 'format'>) => {
			const prompt = tail(textRef.current) || titleSentence(context)
			const { text: said } = await api('transcribeSpeech', {
				body: {
					audio_base64: audio.base64,
					format: audio.format,
					...(prompt ? { prompt } : {})
				},
				timeoutMs: TRANSCRIBE_TIMEOUT_MS
			})
			return said
		},
		[context]
	)

	const transcribe = useCallback(
		(samples: Float32Array) =>
			transcribeAudio({ base64: toBase64(encodeWav(samples)), format: 'wav' }),
		[transcribeAudio]
	)

	const send = useCallback(
		(samples: Float32Array) => {
			queue.current = queue.current.then(async () => {
				// Once one piece has failed, the rest wait too, so the text stays in order.
				if (backlog.current.length > 0) {
					backlog.current.push(samples)
					return
				}
				try {
					append(await transcribe(samples))
				} catch {
					backlog.current.push(samples)
				}
			})
		},
		[append, transcribe]
	)

	/** Sends the held-back audio, in order. False if some is still held back. */
	const drain = useCallback(async () => {
		const runs = chunk(backlog.current)
		backlog.current = []
		for (const [i, run] of runs.entries()) {
			try {
				append(await transcribe(run))
			} catch {
				backlog.current = runs.slice(i)
				return false
			}
		}
		return true
	}, [append, transcribe])

	/** Sends a phone's recording. False if it's still waiting. */
	const sendHeld = useCallback(async () => {
		if (!held.current) return true
		try {
			append(await transcribeAudio(held.current))
			held.current = null
			return true
		} catch {
			return false
		}
	}, [append, transcribeAudio])

	const settle = useCallback(async () => {
		await queue.current
		const sent = (await sendHeld()) && (backlog.current.length === 0 || (await drain()))
		if (sent) {
			setPhase('idle')
			return textRef.current
		}
		track('voice_recording_failed', { surface: 'explain', reason: 'busy' })
		setFailure({
			reason: 'busy',
			message: 'The end of what you said isn’t written down yet. Try again in a moment.'
		})
		setPhase('failed')
		return textRef.current
	}, [drain, sendHeld])

	const stop = useCallback(async (): Promise<string> => {
		const current = recording.current
		if (!current) return textRef.current
		recording.current = null
		setPhase('finishing')
		const audio = await current.stop()
		if (audio) held.current = audio
		segmenter.current?.flush()
		segmenter.current = null
		setPhase('finishing')
		return settle()
	}, [settle])

	const start = useCallback(async () => {
		if (recording.current) return
		setFailure(null)
		const pieces = recorder.streams ? createSegmenter(send) : null
		try {
			const started = await recorder.start({
				...(pieces ? { onSamples: pieces.push, keepAudio: false } : {}),
				maxSeconds: MAX_EXPLAIN_SECONDS,
				onLimit: () => void stop()
			})
			segmenter.current = pieces
			recording.current = started
			setSeconds(0)
			setLevels([])
			setLatest('')
			setPhase('recording')
			track('voice_recording_started', { surface: 'explain' })
		} catch (error) {
			const reason = error instanceof RecorderError ? error.reason : 'unsupported'
			track('voice_recording_failed', { surface: 'explain', reason })
			setFailure({
				reason,
				message:
					reason === 'denied'
						? `Your microphone is off. Type your explanation, or allow the microphone in ${MIC_SETTINGS} and try again.`
						: 'This device can’t record. Type your explanation instead.'
			})
			setPhase('failed')
		}
	}, [recorder, send, stop])

	/** After a failure: send what's still held back. */
	const retry = useCallback(async () => {
		setFailure(null)
		setPhase('finishing')
		return settle()
	}, [settle])

	useEffect(() => {
		if (phase !== 'recording') return
		const timer = setInterval(() => {
			const current = recording.current
			if (!current) return
			setSeconds(current.seconds())
			setLevels((bars) => [...bars.slice(-(WAVE_BARS - 1)), current.level()])
		}, TICK_MS)
		return () => clearInterval(timer)
	}, [phase])

	useEffect(() => () => recording.current?.cancel(), [])

	return {
		phase,
		text,
		setText,
		latest,
		failure,
		seconds,
		levels,
		waveBars: WAVE_BARS,
		/** Whether the person changed what was written down from what they said. */
		edited: text.trim() !== spoken.current.trim(),
		/** Whether the words appear while speaking (the web), or only once stopped (a phone). */
		streams: recorder.streams,
		/** Whether any of the text was spoken. */
		spoke: spoken.current.length > 0,
		start,
		stop,
		retry
	}
}
