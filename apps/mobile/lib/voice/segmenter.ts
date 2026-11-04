import { SPEECH_SAMPLE_RATE } from '@app/contract'
import { loudness } from './wav'

// A spoken explanation, cut into pieces while the person talks, so each can be written down a
// moment after it's said (docs/voice-requirements.md, R1). A piece ends at a pause, or at
// MAX_SECONDS if they don't pause. A piece with no speech in it is dropped: it would cost a
// request and come back empty.

/** Quieter than this is silence, on `loudness`'s 0–1 scale. */
const SILENCE = 0.04
/** How long a pause ends a piece. */
const PAUSE_SECONDS = 0.45
/** A piece is at least this long before a pause can end it, so a breath isn't a piece. */
const MIN_SECONDS = 1.2
/** A piece ends here even without a pause. */
const MAX_SECONDS = 6

export type Segmenter = {
	/** Adds newly recorded samples (16 kHz). */
	push: (samples: Float32Array) => void
	/** Ends the last piece, if it held speech. */
	flush: () => void
}

export function createSegmenter(onPiece: (samples: Float32Array) => void): Segmenter {
	let parts: Float32Array[] = []
	let length = 0
	let quietFor = 0
	let heardSpeech = false

	const emit = () => {
		if (length > 0 && heardSpeech) {
			const piece = new Float32Array(length)
			let at = 0
			for (const part of parts) {
				piece.set(part, at)
				at += part.length
			}
			onPiece(piece)
		}
		parts = []
		length = 0
		quietFor = 0
		heardSpeech = false
	}

	return {
		push(samples) {
			parts.push(samples)
			length += samples.length
			const seconds = samples.length / SPEECH_SAMPLE_RATE
			if (loudness(samples) < SILENCE) quietFor += seconds
			else {
				quietFor = 0
				heardSpeech = true
			}
			const total = length / SPEECH_SAMPLE_RATE
			if (total >= MAX_SECONDS || (total >= MIN_SECONDS && quietFor >= PAUSE_SECONDS)) emit()
		},
		flush: emit
	}
}
