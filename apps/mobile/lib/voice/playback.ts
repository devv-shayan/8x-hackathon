// Phones: no audio module in this build, so the students' questions stay text-only until a
// store build adds one. The web build plays them (playback.web.ts).

export type Playing = { stop: () => void; started: Promise<void>; done: Promise<void> }

export const canPlayVoice = false

const NOTHING: Playing = { stop: () => {}, started: Promise.resolve(), done: Promise.resolve() }

export function playWav(_base64: string): Playing {
	return NOTHING
}

export function speakWithBrowser(_text: string): Playing | null {
	return null
}
