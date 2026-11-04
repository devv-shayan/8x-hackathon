/**
 * The reading screen (8X-49): what Omar says and what the sheet offers at each moment, from
 * opening to ready, and when a video can't be read.
 */
import { Text } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { DueWarmUp, Video } from '@app/contract'
import { ReadingView, type ReadingPhase } from '@/components/reading/ReadingView'

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))
jest.mock('@/components/pixel/PixelBackdrop', () => ({ PixelBackdrop: () => null }))
jest.mock('@/components/pixel/PixelBoard', () => ({ PixelBoard: () => null }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))
jest.mock('@/lib/motion', () => ({ useReducedMotion: () => false }))

const GAP: DueWarmUp = {
	gap_id: '11111111-1111-4111-8111-111111111111',
	topic_title: 'How plants eat',
	concept_title: 'Photosynthesis',
	start_seconds: 12,
	student_name: 'Maya',
	open_warm_up: null
}

const VIDEO = {
	id: '22222222-2222-4222-8222-222222222222',
	youtube_id: 'rb7TVW77ZCs',
	title: 'How do vaccines work?',
	concepts: ['A', 'B', 'C', 'D', 'E'].map((title) => ({ title, quote: title, start_seconds: 1 }))
} as unknown as Video

function show(phase: ReadingPhase, extra: Partial<Parameters<typeof ReadingView>[0]> = {}) {
	const handlers = {
		onGuess: jest.fn(),
		onAnswerWarmUp: jest.fn(),
		onCancel: jest.fn(),
		onBack: jest.fn(),
		onTeach: jest.fn(),
		onRetry: jest.fn()
	}
	render(
		<ReadingView
			youtubeId="rb7TVW77ZCs"
			title="How do vaccines work?"
			phase={phase}
			warmUp={null}
			guess={null}
			unreadable={<Text>paste form</Text>}
			{...handlers}
			{...extra}
		/>
	)
	return handlers
}

it('opens, then reads, then picks out the key ideas', () => {
	show({ kind: 'reading', seconds: 1 })
	expect(screen.getByText('Ooh, a new one. Opening it…')).toBeTruthy()
	expect(screen.getByText('Step 1 of 3')).toBeTruthy()
	screen.unmount()
	show({ kind: 'reading', seconds: 20 })
	expect(screen.getByText('Reading what it says. The slow bit.')).toBeTruthy()
	screen.unmount()
	show({ kind: 'reading', seconds: 34 })
	expect(screen.getByText('Picking out the big ideas now.')).toBeTruthy()
})

it('with nothing due, offers a guess at how many key ideas', () => {
	const { onGuess } = show({ kind: 'reading', seconds: 20 })
	fireEvent.press(screen.getByLabelText('4'))
	expect(onGuess).toHaveBeenCalledWith(4)
})

it('with a warm-up due, Maya offers it, and Later puts it away', () => {
	const { onAnswerWarmUp } = show({ kind: 'reading', seconds: 20 }, { warmUp: GAP })
	expect(screen.getByText('Hand up: Maya has a question about Photosynthesis.')).toBeTruthy()
	fireEvent.press(screen.getByText('Answer'))
	expect(onAnswerWarmUp).toHaveBeenCalledWith(GAP)
	fireEvent.press(screen.getByText('Later'))
	expect(screen.queryByText('Hand up: Maya has a question about Photosynthesis.')).toBeNull()
})

it('past the usual time, says so and lets you leave', () => {
	const { onBack } = show({ kind: 'reading', seconds: 92 })
	expect(screen.getByText('It’s a long one. Still going!')).toBeTruthy()
	fireEvent.press(screen.getByText('Back to Home'))
	expect(onBack).toHaveBeenCalled()
})

it('asks before cancelling', () => {
	const { onCancel } = show({ kind: 'reading', seconds: 20 })
	fireEvent.press(screen.getByText('Cancel'))
	expect(screen.getByText('Stop reading this video?')).toBeTruthy()
	expect(screen.getByText('Omar’s more than halfway. You can start again any time.')).toBeTruthy()
	fireEvent.press(screen.getByText('Keep reading'))
	expect(onCancel).not.toHaveBeenCalled()
	fireEvent.press(screen.getByText('Cancel'))
	fireEvent.press(screen.getByText('Stop'))
	expect(onCancel).toHaveBeenCalled()
})

it('when ready, says how many ideas, against the guess, and teaches it', () => {
	const { onTeach } = show({ kind: 'ready', video: VIDEO, seconds: 38 }, { guess: 4 })
	expect(screen.getByText('Done. 5 big ideas in it.')).toBeTruthy()
	expect(screen.getByText('5 key ideas · you guessed 4')).toBeTruthy()
	fireEvent.press(screen.getByText('Teach it'))
	expect(onTeach).toHaveBeenCalledWith(VIDEO)
})

it("a video it can't read offers the paste box", () => {
	show({ kind: 'unreadable' })
	expect(screen.getByText('We can’t read this video.')).toBeTruthy()
	expect(screen.getByText('paste form')).toBeTruthy()
})

it('busy: nothing is lost, try again', () => {
	const { onRetry } = show({
		kind: 'failed',
		message: 'Reading videos is busy right now.',
		busy: true
	})
	expect(screen.getByText('Busy')).toBeTruthy()
	expect(screen.getByText('Too many videos at once. Give me a minute.')).toBeTruthy()
	expect(screen.getByText('Nothing’s lost. Try again in a minute.')).toBeTruthy()
	fireEvent.press(screen.getByText('Try again'))
	expect(onRetry).toHaveBeenCalled()
})

it("any other failure doesn't call it busy", () => {
	show({ kind: 'failed', message: 'Something went wrong.', busy: false })
	expect(screen.queryByText('Busy')).toBeNull()
	expect(screen.getByText('Off air')).toBeTruthy()
	expect(screen.getByText('Hmm. That didn’t work.')).toBeTruthy()
})
