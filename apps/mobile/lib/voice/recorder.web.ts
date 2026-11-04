import { MAX_SPEECH_SECONDS, SPEECH_SAMPLE_RATE } from '@app/contract'
import { RecorderError, type Recorder, type Recording, type RecordingOptions } from './recording'
import { encodeWav, loudness, resample, toBase64 } from './wav'

// Recording the person in the browser: the microphone's raw samples, brought down to 16 kHz
// mono as they arrive, so explain can write them down as they're said. Phones use recorder.ts.

export { RecorderError } from './recording'

/** Whether this browser can record at all (a secure page with a microphone API). */
export const canRecordVoice =
	typeof window !== 'undefined' &&
	typeof window.AudioContext === 'function' &&
	typeof navigator !== 'undefined' &&
	typeof navigator.mediaDevices?.getUserMedia === 'function'

/** How many samples each callback carries: about a tenth of a second at 44.1–48 kHz. */
const FRAME = 4096

async function startRecording(options: RecordingOptions = {}): Promise<Recording> {
	const maxSeconds = options.maxSeconds ?? MAX_SPEECH_SECONDS
	const keepAudio = options.keepAudio ?? true
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
		if (keepAudio) pieces.push(piece)
		total += piece.length
		options.onSamples?.(piece)
		if (!limited && total >= maxSeconds * SPEECH_SAMPLE_RATE) {
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
		stop: async () => {
			release()
			if (!keepAudio) return null
			const kept = pieces.reduce((sum, piece) => sum + piece.length, 0)
			const all = new Float32Array(Math.min(kept, maxSeconds * SPEECH_SAMPLE_RATE))
			let at = 0
			for (const piece of pieces) {
				if (at >= all.length) break
				all.set(piece.subarray(0, all.length - at), at)
				at += piece.length
			}
			return {
				base64: toBase64(encodeWav(all)),
				format: 'wav',
				seconds: all.length / SPEECH_SAMPLE_RATE
			}
		},
		cancel: release,
		level: () => lastLevel,
		seconds: () => total / SPEECH_SAMPLE_RATE
	}
}

const WEB_RECORDER: Recorder = { streams: true, start: startRecording }

/** The browser's recorder. A hook so phones can use expo-audio's, which only comes as one. */
export function useRecorder(): Recorder {
	return WEB_RECORDER
}
