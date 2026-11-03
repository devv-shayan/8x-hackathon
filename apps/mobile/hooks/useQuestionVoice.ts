import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'
import type { SpeakQuestionBody } from '@app/contract'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'
import {
	canPlayVoice,
	playWav,
	speakWithDevice,
	type Playing,
	type Progress
} from '@/lib/voice/playback'

// A student saying their question aloud (docs/voice-requirements.md, R9–R11). The server
// makes the voice from the question's ids; it takes a few seconds, so the text shows at once
// and the voice plays when it's ready. Each question is fetched once and kept for Replay.
// If there's no voice, the browser's own speech reads it; failing that, it stays text.

export type VoiceSurface = 'class' | 'warm_up'
/** off: no voice in this build. loading: being made. speaking: playing. ready: Replay. */
export type VoiceState = 'off' | 'loading' | 'speaking' | 'ready'

// Generous: a long question is spoken in pieces, and Orpheus can be slow.
const VOICE_TIMEOUT_MS = 30_000
// A voice that turns up after this long is left for Replay, not played over the person.
const AUTOPLAY_WINDOW_MS = 10_000

function voiceKey(source: SpeakQuestionBody) {
	return ['speech', 'question', 'warm_up_id' in source ? source.warm_up_id : source.turn_id]
}

function voiceQuery(source: SpeakQuestionBody) {
	return {
		queryKey: voiceKey(source),
		queryFn: () => api('speakQuestion', { body: source, timeoutMs: VOICE_TIMEOUT_MS }),
		staleTime: Infinity,
		gcTime: 30 * 60_000,
		retry: false
	}
}

/** Starts making the voices of questions that are likely next (hands up), before a pick. */
export function usePrefetchQuestionVoices(sources: SpeakQuestionBody[]) {
	const queryClient = useQueryClient()
	const keys = sources.map((source) => voiceKey(source).join(':')).join(',')
	useEffect(() => {
		if (!canPlayVoice) return
		for (const source of sources) void queryClient.prefetchQuery(voiceQuery(source))
		// `keys` names the sources; the array itself is new on every render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [keys, queryClient])
}

export function useQuestionVoice({
	surface,
	source,
	text,
	student
}: {
	surface: VoiceSurface
	/** The question on screen, or null when there's none yet. */
	source: SpeakQuestionBody | null
	text: string | null
	student: string | null
}): {
	state: VoiceState
	replay: () => void
	/** How far the voice playing now has got, or null when nothing is playing. */
	progress: () => Progress | null
	/** Counts each time the voice starts, so a Replay starts showing the words again. */
	plays: number
} {
	const focused = useIsFocused()
	const enabled = canPlayVoice && source !== null && focused
	const query = useQuery({ ...voiceQuery(source ?? { warm_up_id: '' }), enabled })
	const key = source ? voiceKey(source).join(':') : null
	const [speaking, setSpeaking] = useState(false)
	const [plays, setPlays] = useState(0)
	const current = useRef<Playing | null>(null)
	const played = useRef(new Set<string>())
	const shownAt = useRef(new Map<string, number>())

	const stop = useCallback(() => {
		current.current?.stop()
		current.current = null
		setSpeaking(false)
	}, [])

	const play = useCallback(
		(replay: boolean) => {
			if (!student || !text) return
			stop()
			const audio = query.data?.audio_base64
			const playing = audio ? playWav(audio) : speakWithDevice(text)
			if (!playing) return
			current.current = playing
			setSpeaking(true)
			setPlays((n) => n + 1)
			playing.started
				.then(() =>
					track('voice_question_played', {
						surface,
						student,
						replay,
						source: audio ? 'groq' : 'browser'
					})
				)
				.catch(() => {})
			void playing.done.then(() => {
				if (current.current === playing) {
					current.current = null
					setSpeaking(false)
				}
			})
		},
		[query.data, stop, student, surface, text]
	)

	// A new question: note when it appeared, and stop the last one's voice.
	useEffect(() => {
		if (key && !shownAt.current.has(key)) shownAt.current.set(key, Date.now())
		return stop
	}, [key, stop])

	// Leaving the screen silences it.
	useEffect(() => {
		if (!focused) stop()
	}, [focused, stop])

	// Speak each question once, as soon as its voice (or the fallback) is ready.
	useEffect(() => {
		if (!enabled || !key || played.current.has(key)) return
		if (query.status === 'pending') return
		played.current.add(key)
		const late = Date.now() - (shownAt.current.get(key) ?? 0) > AUTOPLAY_WINDOW_MS
		if (!late) play(false)
	}, [enabled, key, play, query.status])

	const state: VoiceState = !enabled
		? 'off'
		: speaking
			? 'speaking'
			: query.status === 'pending'
				? 'loading'
				: 'ready'
	return {
		state,
		replay: () => play(true),
		progress: () => current.current?.progress() ?? null,
		plays
	}
}
