import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { File, Paths } from 'expo-file-system'
import * as Speech from 'expo-speech'

// Playing the students' voices on a phone: the server's WAV through expo-audio (written to a
// cache file first, since the player takes a file), or the phone's own text-to-speech when the
// server has none. The web build plays them in the browser (playback.web.ts).

/**
 * Something playing, which can be stopped. `started` rejects if it can't start; `done`
 * settles when it ends, is stopped or fails.
 */
export type Playing = { stop: () => void; started: Promise<void>; done: Promise<void> }

export const canPlayVoice = true

let clips = 0

/** Plays a base64 WAV. */
export function playWav(base64: string): Playing {
	const file = new File(Paths.cache, `question-${Date.now()}-${clips++}.wav`)
	file.write(base64, { encoding: 'base64' })
	const player = createAudioPlayer({ uri: file.uri })
	let finish = () => {}
	const done = new Promise<void>((resolve) => {
		let ended = false
		finish = () => {
			if (ended) return
			ended = true
			subscription.remove()
			player.remove()
			try {
				file.delete()
			} catch {
				// Already cleaned up.
			}
			resolve()
		}
	})
	const subscription = player.addListener('playbackStatusUpdate', (status) => {
		if (status.didJustFinish) finish()
	})
	// Sound even with the ringer switched off: the student is talking to you.
	const started = setAudioModeAsync({ playsInSilentMode: true }).then(() => player.play())
	started.catch(() => finish())
	return {
		stop: () => {
			player.pause()
			finish()
		},
		started,
		done
	}
}

/** Reads `text` with the phone's own voice. */
export function speakWithDevice(text: string): Playing | null {
	const done = new Promise<void>((resolve) => {
		Speech.speak(text, {
			language: 'en-US',
			onDone: () => resolve(),
			onStopped: () => resolve(),
			onError: () => resolve()
		})
	})
	return { stop: () => void Speech.stop(), started: Promise.resolve(), done }
}
