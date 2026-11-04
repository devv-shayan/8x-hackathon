// Playing the students' voices in the browser: a WAV from the server, or the browser's own
// speech when there's none. The native file (playback.ts) plays nothing until a store build
// adds an audio module.

/**
 * How far something has played: seconds in, its length once known, and for a voice that says
 * which word it's on, how many characters of the text it has reached.
 */
export type Progress = { elapsed: number; duration: number | null; spokenChars?: number }

/**
 * Something playing, which can be stopped. `started` rejects if the browser won't start it
 * (autoplay before any tap); `done` settles when it ends, is stopped or fails. `progress` is
 * read while it plays, so the question can be shown word by word in time with it.
 */
export type Playing = {
	stop: () => void
	started: Promise<void>
	done: Promise<void>
	progress: () => Progress
}

/** Whether this build can play a student's voice at all. */
export const canPlayVoice = typeof window !== 'undefined' && typeof window.Audio === 'function'

/** Plays a base64 WAV. */
export function playWav(base64: string): Playing {
	const audio = new window.Audio(`data:audio/wav;base64,${base64}`)
	const started = audio.play()
	const done = new Promise<void>((resolve) => {
		audio.onended = () => resolve()
		audio.onpause = () => resolve()
		audio.onerror = () => resolve()
		started.catch(() => resolve())
	})
	return {
		stop: () => {
			audio.pause()
			audio.removeAttribute('src')
		},
		started,
		done,
		progress: () => ({
			elapsed: audio.currentTime,
			duration: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null
		})
	}
}

/** Reads `text` with the browser's own voice, or returns null if it has none. */
export function speakWithDevice(text: string): Playing | null {
	const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
	if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return null
	synth.cancel()
	const utterance = new window.SpeechSynthesisUtterance(text)
	utterance.lang = 'en-US'
	const startedAt = Date.now()
	// The browser says which word it's starting, so the words follow it exactly.
	let spokenChars: number | undefined
	utterance.onboundary = (event) => {
		if (event.name === 'word' || event.name === undefined) spokenChars = event.charIndex + 1
	}
	const done = new Promise<void>((resolve) => {
		utterance.onend = () => resolve()
		utterance.onerror = () => resolve()
	})
	synth.speak(utterance)
	return {
		stop: () => synth.cancel(),
		started: Promise.resolve(),
		done,
		progress: () => ({ elapsed: (Date.now() - startedAt) / 1000, duration: null, spokenChars })
	}
}
