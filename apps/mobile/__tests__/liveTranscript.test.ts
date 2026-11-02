/**
 * Explaining out loud: the recording is cut at pauses (or every 6 s), each piece is written
 * down in order with what came before as context, and if Groq is busy the pieces wait and go
 * together when the person stops. The recorder and the speech route are faked.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useLiveTranscript } from '@/hooks/useLiveTranscript'
import { api } from '@/lib/api'
import { startRecording } from '@/lib/voice/recorder'
import { createSegmenter } from '@/lib/voice/segmenter'

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/api', () => ({ api: jest.fn() }))
jest.mock('@/lib/voice/recorder', () => ({
	canRecordVoice: true,
	RecorderError: Error,
	startRecording: jest.fn()
}))

const RATE = 16_000
/** A tenth of a second of speech (steady and loud enough) or of silence. */
const speech = () => new Float32Array(RATE / 10).fill(0.1)
const silence = () => new Float32Array(RATE / 10)

function feed(push: (s: Float32Array) => void, frames: number, make: () => Float32Array) {
	for (let i = 0; i < frames; i++) push(make())
}

describe('the segmenter', () => {
	it('ends a piece at a pause, and only once it has a second or so of speech', () => {
		const pieces: number[] = []
		const seg = createSegmenter((piece) => pieces.push(piece.length / RATE))
		feed(seg.push, 15, speech)
		feed(seg.push, 5, silence)
		expect(pieces).toEqual([2])
	})

	it('ends a long piece at 6 seconds without a pause', () => {
		const pieces: number[] = []
		const seg = createSegmenter((piece) => pieces.push(piece.length / RATE))
		feed(seg.push, 70, speech)
		expect(pieces[0]).toBeCloseTo(6)
	})

	it('drops silence, and flushes what speech is left', () => {
		const pieces: number[] = []
		const seg = createSegmenter((piece) => pieces.push(piece.length / RATE))
		feed(seg.push, 30, silence)
		expect(pieces).toEqual([])
		feed(seg.push, 5, speech)
		seg.flush()
		expect(pieces.length).toBe(1)
	})
})

describe('the live transcript', () => {
	let push: (samples: Float32Array) => void = () => {}

	beforeEach(() => {
		jest.mocked(api).mockReset()
		jest.mocked(startRecording).mockImplementation(async (options) => {
			push = options?.onSamples ?? (() => {})
			return { stop: () => new Float32Array(), cancel: jest.fn(), level: () => 0, seconds: () => 0 }
		})
	})

	function sayAPhrase() {
		feed(push, 15, speech)
		feed(push, 5, silence)
	}

	it('writes each phrase down in order, with what came before as context', async () => {
		jest
			.mocked(api)
			.mockResolvedValueOnce({ text: 'He felt stuck.' } as never)
			.mockResolvedValueOnce({ text: 'So he tried something new.' } as never)
		const { result } = renderHook(() => useLiveTranscript('Try something new for 30 days'))
		await act(() => result.current.start())
		act(() => sayAPhrase())
		await waitFor(() => expect(result.current.text).toBe('He felt stuck.'))
		// Before anything is said, the video's title is the context.
		const first = jest.mocked(api).mock.calls[0]![1] as { body: { prompt?: string } }
		expect(first.body.prompt).toBe('Try something new for 30 days')
		act(() => sayAPhrase())
		let said = ''
		await act(async () => {
			said = await result.current.stop()
		})
		expect(said).toBe('He felt stuck. So he tried something new.')
		expect(result.current.latest).toBe('So he tried something new.')
		const second = jest.mocked(api).mock.calls[1]![1] as { body: { prompt?: string } }
		expect(second.body.prompt).toBe('He felt stuck.')
		expect(result.current.phase).toBe('idle')
		expect(result.current.edited).toBe(false)
	})

	it('holds the pieces while Groq is busy and sends them together at stop', async () => {
		jest
			.mocked(api)
			.mockRejectedValueOnce(new Error('busy'))
			.mockResolvedValueOnce({ text: 'He felt stuck, so he tried something new.' } as never)
		const { result } = renderHook(() => useLiveTranscript())
		await act(() => result.current.start())
		act(() => sayAPhrase())
		act(() => sayAPhrase())
		let said = ''
		await act(async () => {
			said = await result.current.stop()
		})
		expect(said).toBe('He felt stuck, so he tried something new.')
		// The first try, then one request for both pieces: the second never went on its own.
		expect(api).toHaveBeenCalledTimes(2)
	})

	it('says so, and keeps the audio for Try again, if Groq is still busy at stop', async () => {
		jest.mocked(api).mockRejectedValue(new Error('busy'))
		const { result } = renderHook(() => useLiveTranscript())
		await act(() => result.current.start())
		act(() => sayAPhrase())
		await act(async () => {
			await result.current.stop()
		})
		expect(result.current.phase).toBe('failed')
		jest.mocked(api).mockResolvedValue({ text: 'He felt stuck.' } as never)
		await act(async () => {
			await result.current.retry()
		})
		expect(result.current.text).toBe('He felt stuck.')
		expect(result.current.phase).toBe('idle')
	})
})
