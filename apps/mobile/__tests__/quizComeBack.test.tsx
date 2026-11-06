/**
 * Coming back after today's quiz: the streak holds and breaks by calendar day, the week row
 * shows what happened, and the screen says when the next quiz opens.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { QuizComeBack } from '@/components/quiz/QuizComeBack'
import { track } from '@/lib/analytics'
import {
	comeBackLine,
	localDay,
	nextRecord,
	streakDays,
	streakWords,
	untilNextQuiz,
	weekDays,
	type QuizRecord
} from '@/lib/quiz'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('expo-blur', () => ({ BlurView: () => null }))
jest.mock('@/lib/motion', () => ({ useReducedMotion: () => true }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))

// A Thursday. Local time, so the tests hold in any timezone.
const THURSDAY = new Date(2026, 10, 5, 14, 30)
const day = (date: number) => localDay(new Date(2026, 10, date, 12))
const RECORD: QuizRecord = {
	best: 5,
	lastScore: 4,
	lastTotal: 5,
	playedDay: day(5),
	streak: 2,
	week: [
		{ day: day(2), score: 3, total: 5 },
		{ day: day(4), score: 5, total: 5 },
		{ day: day(5), score: 4, total: 5 }
	]
}

describe('the streak', () => {
	const yesterday = { ...RECORD, playedDay: day(4), streak: 3 }

	it('grows on the next day, and does not grow twice in one day', () => {
		expect(nextRecord(yesterday, 2, 5, THURSDAY).streak).toBe(4)
		expect(nextRecord(RECORD, 2, 5, THURSDAY).streak).toBe(2)
	})

	it('starts over after a missed day', () => {
		const old = { ...RECORD, playedDay: day(3), streak: 3 }
		expect(nextRecord(old, 2, 5, THURSDAY).streak).toBe(1)
		expect(streakDays(old, THURSDAY)).toBe(0)
	})

	it('still counts until a whole day has gone by', () => {
		expect(streakDays(yesterday, THURSDAY)).toBe(3)
		expect(streakDays(null, THURSDAY)).toBe(0)
	})

	it('counts a record from before streaks as one day', () => {
		const before: QuizRecord = { best: 3, lastScore: 3, lastTotal: 5, playedDay: day(5) }
		expect(streakDays(before, THURSDAY)).toBe(1)
		expect(streakWords(1)).toBe('Day 1 of your streak')
		expect(streakWords(2)).toBe('2 days in a row')
	})
})

describe('the week row', () => {
	it('runs Monday to Sunday, with played, missed, today and tomorrow', () => {
		const week = weekDays(RECORD, THURSDAY)
		expect(week.map((d) => d.letter).join('')).toBe('MTWTFSS')
		expect(week.map((d) => d.state)).toEqual([
			'played',
			'missed',
			'played',
			'today',
			'next',
			'later',
			'later'
		])
		expect(week.map((d) => d.score)).toEqual([3, null, 5, 4, null, null, null])
	})

	it('puts a Sunday last, in the week that is ending', () => {
		const sunday = new Date(2026, 10, 8, 10)
		const week = weekDays({ ...RECORD, playedDay: day(8), week: [] }, sunday)
		expect(week[0]?.date).toBe(day(2))
		expect(week[6]?.state).toBe('today')
	})

	it('shows a last result from a record with no week', () => {
		const before: QuizRecord = { best: 3, lastScore: 3, lastTotal: 5, playedDay: day(5) }
		expect(weekDays(before, THURSDAY)[3]?.score).toBe(3)
	})

	it('keeps seven days at most', () => {
		const days = Array.from({ length: 7 }, (_, i) => ({ day: day(i + 1), score: 1, total: 5 }))
		const next = nextRecord(
			{ ...RECORD, playedDay: day(7), week: days },
			2,
			5,
			new Date(2026, 10, 8)
		)
		expect(next.week).toHaveLength(7)
		expect(next.week?.[6]).toEqual({ day: day(8), score: 2, total: 5 })
	})
})

describe('the words', () => {
	it('counts down to midnight', () => {
		expect(untilNextQuiz(THURSDAY)).toBe('9h 30m')
		expect(untilNextQuiz(new Date(2026, 10, 5, 23, 40))).toBe('20m')
	})

	it('says when today is their best', () => {
		expect(comeBackLine(RECORD)).toBe('4 of 5 today. Your best is 5.')
		expect(comeBackLine({ ...RECORD, lastScore: 5 })).toBe('5 of 5 today. That’s your best.')
	})
})

describe('the screen', () => {
	it('shows the streak and the way back, and records the visit', () => {
		const onDone = jest.fn()
		const today = new Date()
		const record = { ...RECORD, playedDay: localDay(today), week: [] }
		render(<QuizComeBack record={record} onDone={onDone} />)
		expect(screen.getByText('2 days in a row')).toBeTruthy()
		expect(screen.getByText('See you tomorrow.')).toBeTruthy()
		expect(screen.getByText(/^Next quiz in /)).toBeTruthy()
		expect(track).toHaveBeenCalledWith('quiz_done_viewed', { streak_days: 2, played_this_week: 0 })
		fireEvent.press(screen.getByText('Back to Home'))
		expect(onDone).toHaveBeenCalled()
	})
})
