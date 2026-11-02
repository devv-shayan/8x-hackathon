// Phones: no recording module in this build, so answers stay typed until a store build adds
// one and the microphone permission. The web build records (recorder.web.ts).

export type RecorderFailure = 'denied' | 'unsupported'

export class RecorderError extends Error {
	constructor(readonly reason: RecorderFailure) {
		super(reason)
	}
}

export type Recording = {
	stop: () => Float32Array
	cancel: () => void
	level: () => number
	seconds: () => number
}

export const canRecordVoice = false

export async function startRecording(
	_options: { onLimit?: () => void; onSamples?: (samples: Float32Array) => void } = {}
): Promise<Recording> {
	throw new RecorderError('unsupported')
}
