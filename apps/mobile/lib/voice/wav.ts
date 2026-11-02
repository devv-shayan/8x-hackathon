import { SPEECH_SAMPLE_RATE } from '@app/contract'

// What a recording becomes before it's sent: the microphone's samples brought down to the
// 16 kHz mono the speech route takes, as a 16-bit WAV in base64.

/** `input` at `fromRate`, resampled to `toRate` by averaging (or interpolating up). */
export function resample(input: Float32Array, fromRate: number, toRate = SPEECH_SAMPLE_RATE) {
	if (fromRate === toRate) return input
	const ratio = fromRate / toRate
	const out = new Float32Array(Math.floor(input.length / ratio))
	for (let i = 0; i < out.length; i++) {
		const start = i * ratio
		const end = Math.min(input.length, start + ratio)
		if (ratio < 1) {
			// Upsampling: interpolate between the two nearest samples.
			const at = Math.floor(start)
			const next = Math.min(input.length - 1, at + 1)
			const t = start - at
			out[i] = input[at]! * (1 - t) + input[next]! * t
			continue
		}
		let sum = 0
		let count = 0
		for (let j = Math.floor(start); j < end; j++) {
			sum += input[j]!
			count++
		}
		out[i] = count ? sum / count : 0
	}
	return out
}

/** A 16-bit PCM mono WAV of `samples` (each -1 to 1). */
export function encodeWav(samples: Float32Array, sampleRate = SPEECH_SAMPLE_RATE): Uint8Array {
	const bytes = new Uint8Array(44 + samples.length * 2)
	const view = new DataView(bytes.buffer)
	const text = (at: number, value: string) => {
		for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i)
	}
	text(0, 'RIFF')
	view.setUint32(4, 36 + samples.length * 2, true)
	text(8, 'WAVEfmt ')
	view.setUint32(16, 16, true)
	view.setUint16(20, 1, true) // PCM
	view.setUint16(22, 1, true) // mono
	view.setUint32(24, sampleRate, true)
	view.setUint32(28, sampleRate * 2, true)
	view.setUint16(32, 2, true)
	view.setUint16(34, 16, true)
	text(36, 'data')
	view.setUint32(40, samples.length * 2, true)
	for (let i = 0; i < samples.length; i++) {
		const s = Math.max(-1, Math.min(1, samples[i]!))
		view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
	}
	return bytes
}

/** `bytes` as base64, in chunks so a minute of audio doesn't overflow the call stack. */
export function toBase64(bytes: Uint8Array): string {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
	return btoa(binary)
}

/** How loud `samples` are, 0 to 1: their root mean square, scaled so speech fills the range. */
export function loudness(samples: Float32Array): number {
	if (samples.length === 0) return 0
	let sum = 0
	for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!
	return Math.min(1, Math.sqrt(sum / samples.length) * 4)
}
