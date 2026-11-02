import { useCallback, useEffect, useRef, useState } from 'react'
import { track } from '@/lib/analytics'
import { api, ApiError, errorMessage } from '@/lib/api'
import { RecorderError, startRecording, type Recording } from '@/lib/voice/recorder'
import { encodeWav, toBase64 } from '@/lib/voice/wav'

// Answering out loud (docs/voice-requirements.md, R3–R8): hold to record, let go to turn it into
// text, check the text, send it. The recording lives only in memory: it's kept until the text
// comes back so "Try again" can resend it, and is never stored.

export type VoiceSurface = 'explain' | 'class' | 'warm_up'
/**
 * idle: ready to record. recording: the button is held. transcribing: being written down.
 * review: the text is back, to check and send. failed: see `failure`.
 */
export type VoicePhase = 'idle' | 'recording' | 'transcribing' | 'review' | 'failed'
export type VoiceFailure = {
	reason: 'denied' | 'unsupported' | 'transcribe_failed' | 'busy' | 'empty'
	message: string
}

const TRANSCRIBE_TIMEOUT_MS = 30_000
/** Shorter than this was a tap, not an answer. */
const MIN_SECONDS = 0.6
/** How many bars the wave shows. */
const WAVE_BARS = 44
const TICK_MS = 100

export function useVoiceAnswer(surface: VoiceSurface) {
	const [phase, setPhase] = useState<VoicePhase>('idle')
	const [transcript, setTranscript] = useState('')
	const [draft, setDraft] = useState('')
	const [failure, setFailure] = useState<VoiceFailure | null>(null)
	const [hint, setHint] = useState<string | null>(null)
	const [seconds, setSeconds] = useState(0)
	const [levels, setLevels] = useState<number[]>([])
	const recording = useRef<Recording | null>(null)
	const starting = useRef(false)
	/** What to do once the microphone is ready, if the hold already ended while it started. */
	const afterStart = useRef<'finish' | 'cancel' | null>(null)
	const lastWav = useRef<string | null>(null)

	const fail = useCallback(
		(next: VoiceFailure) => {
			if (next.reason !== 'empty') {
				track('voice_recording_failed', { surface, reason: next.reason })
			}
			setFailure(next)
			setPhase('failed')
		},
		[surface]
	)

	const transcribe = useCallback(
		async (wav: string) => {
			setPhase('transcribing')
			setFailure(null)
			try {
				const { text } = await api('transcribeSpeech', {
					body: { audio_base64: wav },
					timeoutMs: TRANSCRIBE_TIMEOUT_MS
				})
				if (!text.trim()) {
					fail({ reason: 'empty', message: 'We didn’t catch that. Hold the button and try again.' })
					return
				}
				lastWav.current = null
				setTranscript(text.trim())
				setDraft(text.trim())
				setPhase('review')
			} catch (error) {
				const busy = error instanceof ApiError && error.code === 'unavailable'
				fail({ reason: busy ? 'busy' : 'transcribe_failed', message: errorMessage(error) })
			}
		},
		[fail]
	)

	const finish = useCallback(() => {
		const current = recording.current
		if (!current) {
			// Let go before the microphone was ready (the permission prompt): stop once it is.
			if (starting.current) afterStart.current = 'finish'
			return
		}
		recording.current = null
		const samples = current.stop()
		if (samples.length < MIN_SECONDS * 16_000) {
			setPhase('idle')
			setHint('Hold the button down while you talk, then let go.')
			return
		}
		const wav = toBase64(encodeWav(samples))
		lastWav.current = wav
		void transcribe(wav)
	}, [transcribe])

	const cancel = useCallback(() => {
		if (starting.current) {
			afterStart.current = 'cancel'
			return
		}
		if (!recording.current) return
		recording.current.cancel()
		recording.current = null
		setPhase('idle')
		setHint('Cancelled. Nothing was sent.')
	}, [])

	const start = useCallback(async () => {
		if (recording.current || starting.current) return
		starting.current = true
		afterStart.current = null
		setHint(null)
		setFailure(null)
		try {
			const started = await startRecording({ onLimit: () => finish() })
			recording.current = started
			setSeconds(0)
			setLevels([])
			setPhase('recording')
			track('voice_recording_started', { surface })
			if (afterStart.current === 'finish') finish()
			else if (afterStart.current === 'cancel') cancel()
		} catch (error) {
			const reason = error instanceof RecorderError ? error.reason : 'unsupported'
			fail({
				reason,
				message:
					reason === 'denied'
						? 'Your microphone is off. Type your answer, or allow the microphone in your browser and try again.'
						: 'This browser can’t record. Type your answer instead.'
			})
		} finally {
			starting.current = false
		}
	}, [cancel, fail, finish, surface])

	/** Back to the button, for "Record again". */
	const reset = useCallback(() => {
		setPhase('idle')
		setDraft('')
		setTranscript('')
		setFailure(null)
		setHint(null)
	}, [])

	const retry = useCallback(() => {
		if (lastWav.current) void transcribe(lastWav.current)
		else reset()
	}, [reset, transcribe])

	// The timer and the wave, while recording.
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

	// Leaving the screen mid-recording throws the recording away.
	useEffect(() => () => recording.current?.cancel(), [])

	return {
		phase,
		seconds,
		levels,
		waveBars: WAVE_BARS,
		draft,
		setDraft,
		/** Whether the person changed the text before sending it. */
		edited: draft.trim() !== transcript,
		failure,
		hint,
		start,
		finish,
		cancel,
		reset,
		retry
	}
}
