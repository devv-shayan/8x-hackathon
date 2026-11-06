/**
 * The daily quiz's rules: once a day by the person's own calendar, a best score that only goes
 * up, a class that reacts to what actually happened, and a calendar link for tomorrow.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
	classGuesses,
	classLine,
	endWords,
	isNewBest,
	loadQuizRecord,
	localDay,
	nextRecord,
	playedToday,
	reactionLine,
	reminderUrl,
	rightInARow,
	saveQuizRecord,
	type QuizRecord
} from '@/lib/quiz'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

const NOW = new Date(2026, 10, 6, 20, 40)
const RECORD: QuizRecord = { best: 3, lastScore: 3, lastTotal: 5, playedDay: '2026-11-05' }

test('a quiz played today counts for today only', () => {
	expect(playedToday({ ...RECORD, playedDay: localDay(NOW) }, NOW)).toBe(true)
	expect(playedToday(RECORD, NOW)).toBe(false)
	expect(playedToday(null, NOW)).toBe(false)
})

test('the best score only goes up, and only a higher score is a new best', () => {
	expect(nextRecord(RECORD, 2, 5, NOW).best).toBe(3)
	expect(nextRecord(RECORD, 4, 5, NOW).best).toBe(4)
	expect(nextRecord(null, 2, 3, NOW)).toEqual({
		best: 2,
		lastScore: 2,
		lastTotal: 3,
		playedDay: '2026-11-06',
		streak: 1,
		week: [{ day: '2026-11-06', score: 2, total: 3 }]
	})
	expect(isNewBest(RECORD, 3)).toBe(false)
	expect(isNewBest(RECORD, 4)).toBe(true)
	expect(isNewBest(null, 0)).toBe(false)
})

test('a saved record comes back, and a broken one reads as none', async () => {
	await saveQuizRecord(RECORD)
	await expect(loadQuizRecord()).resolves.toEqual(RECORD)
	await AsyncStorage.setItem('app:quiz:v1', '{not json')
	await expect(loadQuizRecord()).resolves.toBeNull()
	await AsyncStorage.setItem('app:quiz:v1', JSON.stringify({ best: 'lots' }))
	await expect(loadQuizRecord()).resolves.toBeNull()
})

test('Omar is usually right and Maya slips up', () => {
	expect(classGuesses(1, () => 0.6)).toEqual([{ maya: false, omar: true }])
	expect(classGuesses(1, () => 0.9)).toEqual([{ maya: false, omar: false }])
	expect(classGuesses(1, () => 0.1)).toEqual([{ maya: true, omar: true }])
	expect(classGuesses(5, Math.random)).toHaveLength(5)
})

test('the reaction matches who actually got it', () => {
	expect(reactionLine(true, { maya: false, omar: true })).toBe(
		'You and Omar got it. Maya fell for it.'
	)
	expect(reactionLine(false, { maya: false, omar: true })).toBe(
		'Omar knew it. Maya fell for it too.'
	)
	expect(reactionLine(true, { maya: true, omar: true })).toBe('All three of you got it.')
	expect(reactionLine(false, { maya: false, omar: false })).toBe('That one fooled the whole class.')
})

test('a run counts only the latest right answers', () => {
	expect(rightInARow([true, false, true, true])).toBe(2)
	expect(rightInARow([true, true, false])).toBe(0)
	expect(rightInARow([])).toBe(0)
})

test('the end screen says how this score compares', () => {
	expect(endWords(null, 2).headline).toBe('Your first score')
	expect(endWords(RECORD, 4)).toEqual({
		headline: 'Your best yet',
		line: 'Up from 3. Beat it tomorrow.'
	})
	expect(endWords(RECORD, 3).headline).toBe('Matched your best')
	expect(endWords(RECORD, 1).line).toBe('Your best is 3. Beat it tomorrow.')
	expect(classLine(4, 2, 4)).toBe('You beat Maya and tied Omar.')
	expect(classLine(1, 2, 4)).toBe('You lost to Maya and lost to Omar.')
})

test('the reminder is tomorrow at this time, repeating for a week', () => {
	const url = new URL(reminderUrl(new Date('2026-11-06T15:40:00.000Z')))
	expect(url.hostname).toBe('calendar.google.com')
	expect(url.searchParams.get('dates')).toBe('20261107T154000Z/20261107T154500Z')
	expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY;COUNT=7')
})
