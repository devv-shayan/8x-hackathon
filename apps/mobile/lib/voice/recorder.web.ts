import { MAX_SPEECH_SECONDS, SPEECH_SAMPLE_RATE } from '@app/contract'
import { loudness, resample } from './wav'

// Recording the person in the browser: the microphone's raw samples, brought down to 16 kHz
// mono as they arrive. The native file (recorder.ts) records nothing until a store build adds
// a recording module and the microphone permission.

export type RecorderFailure = 'denied' | 'unsupported'

export class RecorderError extends Error {
	constructor(readonly reason: RecorderFailure) {
		super(reason)
	}
}

export type Recording = {
	/** Stops and returns everything recorded, at 16 kHz. */
	stop: () => Float32Array
	/** Stops and throws the audio away. */
	cancel: () => void
	/** How loud the last moment was, 0 to 1, for the wave. */
	level: () => number
	seconds: () => number
}

/** Whether this browser can record at all (a secure page with a microphone API). */
export const canRecordVoice =
	typeof window !== 'undefined' &&
	typeof window.AudioContext === 'function' &&
	typeof navigator !== 'undefined' &&
	typeof navigator.mediaDevices?.getUserMedia === 'function'

/** How many samples each callback carries: about a tenth of a second at 44.1–48 kHz. */
const FRAME = 4096

/**
 * Starts recording. Asks for the microphone the first time; rejects with a RecorderError if it's
 * refused or missing. `onLimit` runs once MAX_SPEECH_SECONDS have been recorded; `onSamples`
 * receives each new piece at 16 kHz as it arrives.
 */
export async function startRecording(
	options: { onLimit?: () => void; onSamples?: (samples: Float32Array) => void } = {}
): Promise<Recording> {
	if (!canRecordVoice) throw new RecorderError('unsupported')
	let stream: MediaStream
	try {
		stream = await navigator.mediaDevices.getUserMedia({
			audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
		})
	} catch (error) {
		const name = error instanceof DOMException ? error.name : ''
		throw new RecorderError(
			name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unsupported'
		)
	}
	const context = new window.AudioContext()
	const source = context.createMediaStreamSource(stream)
	// ScriptProcessor is old, but it works in every browser without loading a worklet file.
	const processor = context.createScriptProcessor(FRAME, 1, 1)
	const pieces: Float32Array[] = []
	let total = 0
	let lastLevel = 0
	let limited = false
	processor.onaudioprocess = (event) => {
		const input = event.inputBuffer.getChannelData(0)
		const piece = resample(new Float32Array(input), context.sampleRate)
		lastLevel = loudness(piece)
		pieces.push(piece)
		total += piece.length
		options.onSamples?.(piece)
		if (!limited && total >= MAX_SPEECH_SECONDS * SPEECH_SAMPLE_RATE) {
			limited = true
			options.onLimit?.()
		}
	}
	source.connect(processor)
	// The processor only runs while connected to an output; it writes nothing to it.
	processor.connect(context.destination)

	const release = () => {
		processor.onaudioprocess = null
		source.disconnect()
		processor.disconnect()
		stream.getTracks().forEach((track) => track.stop())
		void context.close()
	}
	return {
		stop: () => {
			release()
			const all = new Float32Array(Math.min(total, MAX_SPEECH_SECONDS * SPEECH_SAMPLE_RATE))
			let at = 0
			for (const piece of pieces) {
				if (at >= all.length) break
				all.set(piece.subarray(0, all.length - at), at)
				at += piece.length
			}
			return all
		},
		cancel: release,
		level: () => lastLevel,
		seconds: () => total / SPEECH_SAMPLE_RATE
	}
}
