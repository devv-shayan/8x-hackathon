import { Platform } from 'react-native'
import type { SpeechFormat } from '@app/contract'

// What both recorders give the voice hooks, so the hooks don't care which one runs: the web's
// (recorder.web.ts, raw samples as they arrive) or the phone's (recorder.ts, an m4a file).

export type RecorderFailure = 'denied' | 'unsupported'

/** Where the person turns the microphone back on, for "allow the microphone in …". */
export const MIC_SETTINGS = Platform.OS === 'web' ? 'your browser' : 'Settings'

export class RecorderError extends Error {
	constructor(readonly reason: RecorderFailure) {
		super(reason)
	}
}

/** A finished recording, ready for the speech route. */
export type RecordedAudio = { base64: string; format: SpeechFormat; seconds: number }

export type Recording = {
	/** Stops and returns what was recorded; null when it was streamed instead (`keepAudio`). */
	stop: () => Promise<RecordedAudio | null>
	/** Stops and throws the audio away. */
	cancel: () => void
	/** How loud the last moment was, 0 to 1, for the wave. */
	level: () => number
	seconds: () => number
}

export type RecordingOptions = {
	/** Runs once `maxSeconds` have been recorded. */
	onLimit?: () => void
	/** Each new piece at 16 kHz, as it arrives. Only where `streams` is true. */
	onSamples?: (samples: Float32Array) => void
	/** MAX_SPEECH_SECONDS unless given: one request's worth. */
	maxSeconds?: number
	/** False when `onSamples` handles the audio: `stop` then returns null. */
	keepAudio?: boolean
}

export type Recorder = {
	/** Whether the samples arrive while recording (the web), or only as a file at the end. */
	streams: boolean
	/**
	 * Starts recording. Asks for the microphone the first time; rejects with a RecorderError if
	 * it's refused or missing.
	 */
	start: (options?: RecordingOptions) => Promise<Recording>
}
