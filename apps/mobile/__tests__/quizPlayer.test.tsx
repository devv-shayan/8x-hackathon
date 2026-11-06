/**
 * Playing the daily quiz: all three formats show their answers, a pick locks the question and
 * says what the video really says, the score counts right answers, and the end compares it.
 */
import { Linking } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { QuizQuestion } from '@app/contract'
import { QuizPlayer } from '@/components/quiz/QuizPlayer'
import { track } from '@/lib/analytics'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('@/components/pixel/PixelBackdrop', () => ({ PixelBackdrop: () => null }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))
jest.mock('react-native-reanimated', () => ({
	__esModule: true,
	default: { View: jest.requireActual('react-native').View },
	useSharedValue: (value: number) => ({ value }),
	useAnimatedStyle: () => ({}),
	withSpring: (value: number) => value,
	withTiming: (value: number) => value,
	withSequence: (value: number) => value,
	withDelay: (_delay: number, value: number) => value
}))
jest.mock('@/lib/motion', () => ({
	Springs: { snappy: {}, settle: {} },
	Timings: { fast: {} },
	shake: () => 0,
	useReducedMotion: () => true
}))
jest.mock('@/lib/haptics', () => ({
	haptic: { success: jest.fn(), warning: jest.fn(), press: jest.fn() }
}))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

const LINE = 'Leaves use sunlight to turn water and carbon dioxide into sugar.'
const SHARED = { topic_title: 'Plants', concept_title: 'Food', quote: LINE, start_seconds: 192 }

const QUESTIONS: QuizQuestion[] = [
	{
		id: '0',
		type: 'fill_blank',
		before: 'Leaves make ',
		after: '.',
		options: ['soil', 'sugar', 'oxygen', 'minerals'],
		right_index: 1,
		...SHARED
	},
	{
		id: '1',
		type: 'multiple_choice',
		question: 'Where does food come from?',
		options: ['The soil', 'The leaves', 'The rain', 'Insects'],
		right_index: 1,
		...SHARED
	},
	{
		id: '2',
		type: 'true_false',
		statement: 'Soil feeds plants.',
		options: ['True', 'False'],
		right_index: 1,
		...SHARED
	}
]

function play(previous = { best: 1, lastScore: 1, lastTotal: 3, playedDay: 'x' }) {
	const onFinish = jest.fn()
	const onRightAnswer = jest.fn()
	render(
		<QuizPlayer
			questions={QUESTIONS}
			previous={previous}
			onFinish={onFinish}
			onDone={jest.fn()}
			onRightAnswer={onRightAnswer}
		/>
	)
	return { onFinish, onRightAnswer }
}

/** Past the wait before the flip, then past the flip itself. */
function flip() {
	for (let i = 0; i < 2; i++) {
		act(() => {
			jest.advanceTimersByTime(1000)
		})
	}
}

beforeEach(() => {
	jest.useFakeTimers()
	jest.mocked(track).mockClear()
})

afterEach(() => {
	jest.useRealTimers()
})

test('the suggested words are all on screen', () => {
	play()
	for (const word of ['soil', 'sugar', 'oxygen', 'minerals']) {
		expect(screen.getByText(word)).toBeTruthy()
	}
	expect(screen.getByText('Tap the missing word')).toBeTruthy()
	expect(track).toHaveBeenCalledWith('quiz_started', { question_count: 3 })
})

test('a right answer stamps, then flips to the video’s line with its time', () => {
	const { onRightAnswer } = play()
	fireEvent.press(screen.getByText('sugar'))
	expect(screen.getByText('Correct!')).toBeTruthy()
	expect(onRightAnswer).toHaveBeenCalledTimes(1)
	expect(track).toHaveBeenCalledWith('quiz_answered', {
		question_type: 'fill_blank',
		is_right: true
	})
	flip()
	expect(screen.getByText(`“${LINE}”`)).toBeTruthy()
	expect(screen.getByText('The video says, 3:12')).toBeTruthy()
})

test('a wrong answer is softer, still shows the line, and counts once', () => {
	const { onRightAnswer } = play()
	fireEvent.press(screen.getByText('soil'))
	fireEvent.press(screen.getByLabelText('sugar, the right answer'))
	expect(screen.getByText('Not quite')).toBeTruthy()
	expect(onRightAnswer).not.toHaveBeenCalled()
	expect(track).toHaveBeenCalledTimes(2)
	flip()
	expect(screen.getByText(`“${LINE}”`)).toBeTruthy()
})

test('the whole quiz reaches the score, compared with the best', () => {
	const { onFinish } = play()
	fireEvent.press(screen.getByText('sugar'))
	flip()
	fireEvent.press(screen.getByText('Next question'))

	expect(screen.getByText('Where does food come from?')).toBeTruthy()
	fireEvent.press(screen.getByText('The leaves'))
	flip()
	fireEvent.press(screen.getByText('Next question'))

	expect(screen.getByText('Soil feeds plants.')).toBeTruthy()
	fireEvent.press(screen.getByText('True'))
	flip()
	fireEvent.press(screen.getByText('See your score'))
	flip()

	expect(onFinish).toHaveBeenCalledWith(2, 3)
	expect(screen.getByText('Your best yet')).toBeTruthy()
	expect(screen.getByText('Up from 1. Beat it tomorrow.')).toBeTruthy()
	expect(track).toHaveBeenCalledWith('quiz_finished', { score: 2, total: 3, new_best: true })
})

test('the reminder opens the calendar', () => {
	const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
	play()
	for (const answer of ['sugar', 'The leaves', 'False']) {
		fireEvent.press(screen.getByText(answer))
		flip()
		fireEvent.press(screen.getByText(answer === 'False' ? 'See your score' : 'Next question'))
	}
	flip()
	fireEvent.press(screen.getByText('Remind me about tomorrow’s quiz'))
	expect(open.mock.calls[0]?.[0]).toContain('calendar.google.com')
	expect(track).toHaveBeenCalledWith('quiz_reminder_added')
	expect(screen.getByText('Calendar opened')).toBeTruthy()
})
