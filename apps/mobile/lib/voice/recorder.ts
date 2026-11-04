import { useMemo } from 'react'
import {
	AudioQuality,
	IOSOutputFormat,
	requestRecordingPermissionsAsync,
	setAudioModeAsync,
	useAudioRecorder,
	type AudioRecorder,
	type RecordingOptions as ExpoRecordingOptions
} from 'expo-audio'
import { File } from 'expo-file-system'
import { MAX_SPEECH_SECONDS } from '@app/contract'
import { RecorderError, type Recorder, type Recording, type RecordingOptions } from './recording'

// Recording on a phone, with expo-audio: an m4a file (Android can't record WAV), handed over
// whole when the person stops. Small on purpose: 16 kHz mono AAC at 32 kbps keeps a five-minute
// explanation inside one request. The web build records raw samples instead (recorder.web.ts).

export { RecorderError } from './recording'

/** Phones always can: expo-audio is in Expo Go and in every build. */
export const canRecordVoice = true

const OPTIONS: ExpoRecordingOptions = {
	extension: '.m4a',
	sampleRate: 16_000,
	numberOfChannels: 1,
	bitRate: 32_000,
	isMeteringEnabled: true,
	android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
	ios: {
		outputFormat: IOSOutputFormat.MPEG4AAC,
		audioQuality: AudioQuality.MEDIUM,
		linearPCMBitDepth: 16,
		linearPCMIsBigEndian: false,
		linearPCMIsFloat: false
	},
	web: { mimeType: 'audio/webm', bitsPerSecond: 32_000 }
}

/** Quieter than this many decibels reads as silence on the wave. */
const FLOOR_DB = -50
const LIMIT_CHECK_MS = 250

function removeFile(uri: string | null) {
	if (!uri) return
	try {
		new File(uri).delete()
	} catch {
		// Already gone, or never written: nothing to clean up.
	}
}

async function startWith(recorder: AudioRecorder, options: RecordingOptions): Promise<Recording> {
	const permission = await requestRecordingPermissionsAsync()
	if (!permission.granted) throw new RecorderError('denied')
	try {
		await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
		await recorder.prepareToRecordAsync()
		recorder.record()
	} catch {
		throw new RecorderError('unsupported')
	}
	const maxSeconds = options.maxSeconds ?? MAX_SPEECH_SECONDS
	let limited = false
	const timer = setInterval(() => {
		if (!limited && recorder.getStatus().durationMillis / 1000 >= maxSeconds) {
			limited = true
			options.onLimit?.()
		}
	}, LIMIT_CHECK_MS)
	// Recording mode sends sound to the earpiece on iPhones: switch back once done.
	const end = async () => {
		clearInterval(timer)
		await recorder.stop()
		await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
		return recorder.uri
	}
	return {
		stop: async () => {
			const seconds = recorder.getStatus().durationMillis / 1000
			const uri = await end()
			if (!uri) return null
			try {
				return { base64: await new File(uri).base64(), format: 'm4a', seconds }
			} finally {
				removeFile(uri)
			}
		},
		cancel: () => {
			void end().then(removeFile)
		},
		level: () => {
			const db = recorder.getStatus().metering
			return db === undefined ? 0 : Math.max(0, Math.min(1, (db - FLOOR_DB) / -FLOOR_DB))
		},
		seconds: () => recorder.getStatus().durationMillis / 1000
	}
}

/** The phone's recorder: one expo-audio recorder for the screen, started and stopped per answer. */
export function useRecorder(): Recorder {
	const recorder = useAudioRecorder(OPTIONS)
	return useMemo(
		() => ({ streams: false, start: (options = {}) => startWith(recorder, options) }),
		[recorder]
	)
}
