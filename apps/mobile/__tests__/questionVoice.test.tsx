/**
 * A student saying their question: fetched once and played, Replay without a new request, the
 * browser's voice when the server has none, and nothing at all where there's no audio.
 */
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useQuestionVoice } from '@/hooks/useQuestionVoice'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { playWav, speakWithDevice } from '@/lib/voice/playback'

let mockAudioAvailable = true

jest.mock('expo-router', () => ({ useIsFocused: () => true }))
jest.mock('@/lib/api', () => ({ api: jest.fn() }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/voice/playback', () => {
	const playing = () => ({
		stop: jest.fn(),
		started: Promise.resolve(),
		done: new Promise(() => {})
	})
	return {
		get canPlayVoice() {
			return mockAudioAvailable
		},
		playWav: jest.fn(playing),
		speakWithDevice: jest.fn(playing)
	}
})

const CLASS_ID = '33333333-3333-4333-8333-333333333333'
const TURN_ID = '44444444-4444-4444-8444-444444444444'
const QUESTION = 'What changed for him?'

function wrapper({ children }: { children: ReactNode }) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: Infinity } }
	})
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function renderVoice() {
	return renderHook(
		() =>
			useQuestionVoice({
				surface: 'class',
				source: { class_id: CLASS_ID, turn_id: TURN_ID },
				text: QUESTION,
				student: 'Omar'
			}),
		{ wrapper }
	)
}

beforeEach(() => {
	mockAudioAvailable = true
	jest.clearAllMocks()
})

it("plays the student's voice once, and Replay plays it again without asking the server", async () => {
	jest.mocked(api).mockResolvedValue({ audio_base64: 'UklGRg==', student_name: 'Omar' } as never)
	const { result } = renderVoice()
	// playWav() runs, then setSpeaking(true) renders. Under load the mock is
	// visible while the hook still reports the previous state, ready.
	await waitFor(() => {
		expect(playWav).toHaveBeenCalledWith('UklGRg==')
		expect(result.current.state).toBe('speaking')
	})
	expect(api).toHaveBeenCalledWith('speakQuestion', {
		body: { class_id: CLASS_ID, turn_id: TURN_ID },
		timeoutMs: 30_000
	})
	await waitFor(() =>
		expect(track).toHaveBeenCalledWith('voice_question_played', {
			surface: 'class',
			student: 'Omar',
			replay: false,
			source: 'groq'
		})
	)
	act(() => result.current.replay())
	expect(playWav).toHaveBeenCalledTimes(2)
	expect(api).toHaveBeenCalledTimes(1)
	await waitFor(() =>
		expect(track).toHaveBeenCalledWith(
			'voice_question_played',
			expect.objectContaining({ replay: true })
		)
	)
})

it("falls back to the browser's voice when the server can't make one", async () => {
	jest.mocked(api).mockRejectedValue(new Error('busy'))
	renderVoice()
	await waitFor(() => expect(speakWithDevice).toHaveBeenCalledWith(QUESTION))
	expect(playWav).not.toHaveBeenCalled()
	await waitFor(() =>
		expect(track).toHaveBeenCalledWith(
			'voice_question_played',
			expect.objectContaining({ source: 'browser' })
		)
	)
})

it('does nothing where this build has no audio', () => {
	mockAudioAvailable = false
	const { result } = renderVoice()
	expect(result.current.state).toBe('off')
	expect(api).not.toHaveBeenCalled()
	expect(playWav).not.toHaveBeenCalled()
})
