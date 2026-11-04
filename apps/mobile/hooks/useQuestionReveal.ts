import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/motion'
import type { VoiceState } from '@/hooks/useQuestionVoice'
import type { Progress } from '@/lib/voice/playback'
import { splitWords, wordsSaid } from '@/lib/voice/reveal'

// A student's question shown word by word as they say it (docs/class-scene-requirements.md,
// R10–R13). The voice sets the pace; with no voice the words keep a speaking pace, and Reduce
// Motion, a tap or a voice that's slow to arrive shows the whole question.

/** How long a question waits for its voice before it's shown whole, in ms. */
const VOICE_GRACE_MS = 3000

type Mode = 'voice' | 'pace' | 'waiting' | 'all'

export type QuestionReveal = {
	words: string[]
	/** How many words are showing. */
	shown: number
	/** The word being said now, or null. */
	current: number | null
	/** The voice is on its way: nothing is said yet. */
	waiting: boolean
	/** Shows the whole question at once, until a Replay. Returns whether anything was hidden. */
	showAll: () => boolean
}

export function useQuestionReveal({
	text,
	voice
}: {
	text: string | null
	voice: { state: VoiceState; progress: () => Progress | null; plays: number }
}): QuestionReveal {
	const words = useMemo(() => splitWords(text ?? ''), [text])
	const reduceMotion = useReducedMotion()
	const [said, setSaid] = useState(0)
	const [tapped, setTapped] = useState(false)
	const [late, setLate] = useState(false)
	const shownAt = useRef(Date.now())
	const progress = useRef(voice.progress)
	progress.current = voice.progress

	// A new question starts from nothing.
	useEffect(() => {
		shownAt.current = Date.now()
		setSaid(0)
		setTapped(false)
		setLate(false)
	}, [text])

	// A Replay shows it again, word by word.
	useEffect(() => {
		if (voice.plays === 0) return
		setSaid(0)
		setTapped(false)
	}, [voice.plays])

	// A voice that's slow to arrive leaves the question shown whole, and plays over it.
	useEffect(() => {
		if (voice.state !== 'loading') return
		const left = VOICE_GRACE_MS - (Date.now() - shownAt.current)
		const id = setTimeout(() => setLate(true), Math.max(0, left))
		return () => clearTimeout(id)
	}, [voice.state, text])

	let mode: Mode = 'all'
	if (reduceMotion || tapped) mode = 'all'
	else if (voice.state === 'speaking') mode = 'voice'
	else if (voice.state === 'off') mode = 'pace'
	else if (voice.state === 'loading') mode = late ? 'all' : 'waiting'

	useEffect(() => {
		if (mode !== 'voice' && mode !== 'pace') return
		let frame = 0
		const tick = () => {
			const now =
				mode === 'voice'
					? progress.current()
					: { elapsed: (Date.now() - shownAt.current) / 1000, duration: null }
			const count = now ? wordsSaid(words, now) : 0
			setSaid(count)
			if (mode === 'voice' || count < words.length) frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
	}, [mode, words])

	const shown = mode === 'all' ? words.length : mode === 'waiting' ? 0 : said
	const current =
		(mode === 'voice' || (mode === 'pace' && shown < words.length)) && shown > 0 ? shown - 1 : null
	return {
		words,
		shown,
		current,
		waiting: mode === 'waiting',
		showAll: () => {
			const hidden = shown < words.length
			setTapped(true)
			return hidden
		}
	}
}
