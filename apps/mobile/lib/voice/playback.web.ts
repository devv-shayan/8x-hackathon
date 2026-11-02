// Playing the students' voices in the browser: a WAV from the server, or the browser's own
// speech when there's none. The native file (playback.ts) plays nothing until a store build
// adds an audio module.

/**
 * Something playing, which can be stopped. `started` rejects if the browser won't start it
 * (autoplay before any tap); `done` settles when it ends, is stopped or fails.
 */
export type Playing = { stop: () => void; started: Promise<void>; done: Promise<void> }

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
		done
	}
}

/** Reads `text` with the browser's own voice, or returns null if it has none. */
export function speakWithBrowser(text: string): Playing | null {
	const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
	if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return null
	synth.cancel()
	const utterance = new window.SpeechSynthesisUtterance(text)
	utterance.lang = 'en-US'
	const done = new Promise<void>((resolve) => {
		utterance.onend = () => resolve()
		utterance.onerror = () => resolve()
	})
	synth.speak(utterance)
	return { stop: () => synth.cancel(), started: Promise.resolve(), done }
}
