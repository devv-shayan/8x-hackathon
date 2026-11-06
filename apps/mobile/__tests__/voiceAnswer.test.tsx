/**
 * Answering out loud: hold, let go, check the words, send; sliding off sends nothing; a blocked
 * microphone falls back to typing. The recorder and the speech route are faked. Also the WAV
 * the recording becomes.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { VoiceAnswer } from '@/components/voice/VoiceAnswer'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { RecorderError } from '@/lib/voice/recorder'
import { encodeWav, resample } from '@/lib/voice/wav'

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))
jest.mock('@/lib/api', () => {
	class MockApiError extends Error {
		code: string
		constructor(code: string, message: string) {
			super(message)
			this.code = code
		}
	}
	return { api: jest.fn(), ApiError: MockApiError, errorMessage: (e: Error) => e.message }
})
const mockStart = jest.fn()
jest.mock('@/lib/voice/recorder', () => {
	class MockRecorderError extends Error {
		reason: string
		constructor(reason: string) {
			super(reason)
			this.reason = reason
		}
	}
	return {
		canRecordVoice: true,
		RecorderError: MockRecorderError,
		useRecorder: () => ({ streams: false, start: mockStart })
	}
})

const cancel = jest.fn()

function recordingOf(seconds: number) {
	return {
		stop: async () => ({ base64: 'AAAAGGZ0eXBNNEEg', format: 'm4a' as const, seconds }),
		cancel,
		level: () => 0.5,
		seconds: () => seconds
	}
}

function renderAnswer(onSend = jest.fn()) {
	render(
		<VoiceAnswer
			surface="class"
			student="Omar"
			question="What changed for him?"
			typed=""
			onTypedChange={() => {}}
			onSend={onSend}
			sending={false}
			error={null}
			secondary={{ label: 'Skip this one', onPress: () => {} }}
		/>
	)
	return onSend
}

const holdButton = () => screen.getByLabelText('Hold to answer Omar')

beforeEach(() => {
	jest.clearAllMocks()
	mockStart.mockResolvedValue(recordingOf(3))
	jest.mocked(api).mockResolvedValue({ text: 'He got more confident.' } as never)
})

it('hold, let go, fix a word, send: the answer goes as voice, marked edited', async () => {
	const onSend = renderAnswer()
	await act(async () => fireEvent(holdButton(), 'pressIn'))
	expect(track).toHaveBeenCalledWith('voice_recording_started', { surface: 'class' })
	await act(async () => {
		fireEvent(screen.getByLabelText('Let go to send'), 'pressOut')
		fireEvent.press(screen.getByLabelText('Let go to send'))
	})
	const field = await screen.findByDisplayValue('He got more confident.')
	expect(api).toHaveBeenCalledWith('transcribeSpeech', {
		body: {
			audio_base64: 'AAAAGGZ0eXBNNEEg',
			format: 'm4a',
			prompt: 'What changed for him?'
		},
		timeoutMs: 30_000
	})
	fireEvent.changeText(field, 'He got much more confident.')
	fireEvent.press(screen.getByText('Send to Omar'))
	expect(onSend).toHaveBeenCalledWith('He got much more confident.', {
		method: 'voice',
		edited: true
	})
})

it('sliding off the button sends nothing', async () => {
	renderAnswer()
	await act(async () => fireEvent(holdButton(), 'pressIn'))
	await act(async () => {
		fireEvent(screen.getByLabelText('Let go to send'), 'pressOut')
		await new Promise((resolve) => setTimeout(resolve, 5))
	})
	expect(cancel).toHaveBeenCalled()
	expect(api).not.toHaveBeenCalled()
	expect(screen.getByText('Cancelled. Nothing was sent.')).toBeTruthy()
})

it('a blocked microphone shows why and falls back to typing', async () => {
	mockStart.mockRejectedValue(new RecorderError('denied'))
	renderAnswer()
	await act(async () => fireEvent(holdButton(), 'pressIn'))
	await waitFor(() => expect(screen.getByText(/Your microphone is off/)).toBeTruthy())
	expect(screen.getByPlaceholderText('Tell Omar in your own words…')).toBeTruthy()
	expect(track).toHaveBeenCalledWith('voice_recording_failed', {
		surface: 'class',
		reason: 'denied'
	})
})

it('"Type instead" switches to the typed answer', () => {
	renderAnswer()
	fireEvent.press(screen.getByText('Type instead'))
	expect(screen.getByPlaceholderText('Tell Omar in your own words…')).toBeTruthy()
	expect(track).toHaveBeenCalledWith('voice_typed_instead', { surface: 'class' })
})

it('encodes 16 kHz mono 16-bit WAV, after bringing 48 kHz down to 16 kHz', () => {
	const down = resample(new Float32Array(48_000).fill(0.5), 48_000)
	expect(down.length).toBe(16_000)
	expect(down[100]).toBeCloseTo(0.5)
	const wav = encodeWav(down)
	const view = new DataView(wav.buffer)
	expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF')
	expect(view.getUint16(22, true)).toBe(1)
	expect(view.getUint32(24, true)).toBe(16_000)
	expect(view.getUint32(40, true)).toBe(32_000)
	expect(view.getInt16(44, true)).toBe(Math.round(0.5 * 0x7fff - 0.5))
})
