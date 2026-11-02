// WAV in and out of the speech routes: checking what the app sent before it goes to Groq, and
// joining the clips of a question Orpheus spoke in pieces. PCM only, which is all either side
// produces.

export type WavInfo = {
	channels: number
	sampleRate: number
	bitsPerSample: number
	/** Where the samples start, and how many bytes of them there are. */
	dataOffset: number
	dataLength: number
	seconds: number
}

const HEADER_BYTES = 44
const PCM = 1

function ascii(bytes: Uint8Array, at: number): string {
	return String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!)
}

/** The format and samples of a PCM WAV, or null if `bytes` isn't one. */
export function readWav(bytes: Uint8Array): WavInfo | null {
	if (bytes.byteLength < HEADER_BYTES) return null
	if (ascii(bytes, 0) !== 'RIFF' || ascii(bytes, 8) !== 'WAVE') return null
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	let format: Omit<WavInfo, 'dataOffset' | 'dataLength' | 'seconds'> | null = null
	let at = 12
	while (at + 8 <= bytes.byteLength) {
		const id = ascii(bytes, at)
		const size = view.getUint32(at + 4, true)
		const body = at + 8
		if (id === 'fmt ') {
			if (view.getUint16(body, true) !== PCM) return null
			format = {
				channels: view.getUint16(body + 2, true),
				sampleRate: view.getUint32(body + 4, true),
				bitsPerSample: view.getUint16(body + 14, true)
			}
		} else if (id === 'data') {
			if (!format || format.channels === 0 || format.sampleRate === 0) return null
			// A streamed WAV may not know its length yet: it runs to the end of the file.
			const dataLength = Math.min(size, bytes.byteLength - body)
			const bytesPerSecond = format.sampleRate * format.channels * (format.bitsPerSample / 8)
			return { ...format, dataOffset: body, dataLength, seconds: dataLength / bytesPerSecond }
		}
		at = body + size + (size % 2)
	}
	return null
}

/** One WAV holding `clips` back to back. Every clip must share the first one's format. */
export function joinWavs(clips: Uint8Array[]): Uint8Array {
	const infos = clips.map((clip) => {
		const info = readWav(clip)
		if (!info) throw new Error('Not a PCM WAV')
		return info
	})
	const first = infos[0]
	if (!first) throw new Error('No clips to join')
	const sameFormat = infos.every(
		(info) =>
			info.channels === first.channels &&
			info.sampleRate === first.sampleRate &&
			info.bitsPerSample === first.bitsPerSample
	)
	if (!sameFormat) throw new Error('Clips differ in format')
	const dataLength = infos.reduce((sum, info) => sum + info.dataLength, 0)
	const out = new Uint8Array(HEADER_BYTES + dataLength)
	const view = new DataView(out.buffer)
	const blockAlign = first.channels * (first.bitsPerSample / 8)
	out.set([0x52, 0x49, 0x46, 0x46], 0) // RIFF
	view.setUint32(4, 36 + dataLength, true)
	out.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8) // WAVEfmt
	view.setUint32(16, 16, true)
	view.setUint16(20, PCM, true)
	view.setUint16(22, first.channels, true)
	view.setUint32(24, first.sampleRate, true)
	view.setUint32(28, first.sampleRate * blockAlign, true)
	view.setUint16(32, blockAlign, true)
	view.setUint16(34, first.bitsPerSample, true)
	out.set([0x64, 0x61, 0x74, 0x61], 36) // data
	view.setUint32(40, dataLength, true)
	let at = HEADER_BYTES
	clips.forEach((clip, i) => {
		const info = infos[i]!
		out.set(clip.subarray(info.dataOffset, info.dataOffset + info.dataLength), at)
		at += info.dataLength
	})
	return out
}
