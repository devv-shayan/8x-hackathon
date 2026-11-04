import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rowProgress, scoresOf, topicGaps, type StoredGap } from './progress'

const MON = new Date('2026-11-02T09:00:00Z')
const WED = new Date('2026-11-04T09:00:00Z')
const SAT = new Date('2026-11-07T09:00:00Z')

const RESULTS = [
	{ concept: 'Thirty days', result: 'correct' as const, resultAfterClass: 'correct' as const },
	{ concept: 'Memorable', result: 'correct' as const, resultAfterClass: 'correct' as const },
	{ concept: 'Confidence', result: 'missed' as const, resultAfterClass: 'correct' as const },
	{ concept: 'A novel', result: 'missed' as const, resultAfterClass: 'missed' as const },
	{ concept: 'Small changes', result: 'wrong' as const, resultAfterClass: 'wrong' as const }
]

const gap = (
	id: string,
	title: string,
	nextDueAt: Date,
	closedAt: Date | null = null
): StoredGap => ({
	id,
	concept: { title, quote: title.toLowerCase(), startSeconds: 60 },
	nextDueAt,
	closedAt,
	rightStreak: 0,
	warmUps: []
})

const GAPS = [
	gap('novel', 'A novel', WED),
	gap('confidence', 'Confidence', SAT),
	gap('small', 'Small changes', WED, MON)
]

test('the explanation and after-class scores come from the same class', () => {
	assert.deepEqual(scoresOf(RESULTS), {
		explanation: { correct: 2, total: 5 },
		afterClass: { correct: 3, total: 5 }
	})
	const unscored = RESULTS.map(({ concept, result }) => ({ concept, result }))
	assert.equal(scoresOf(unscored).afterClass, null)
	assert.deepEqual(scoresOf([]), { explanation: null, afterClass: null })
})

test('gaps list open ones soonest first, then closed, and mark what the last class taught', () => {
	const listed = topicGaps(GAPS, RESULTS)
	assert.deepEqual(
		listed.map(({ id }) => id),
		['novel', 'confidence', 'small']
	)
	assert.equal(listed[1]!.taught_last_class, true)
	assert.equal(listed[0]!.taught_last_class, false)
	assert.equal(listed[2]!.closed, true)
	assert.equal(listed[2]!.next_due_at, null)
	assert.equal(listed[0]!.next_due_at, WED.toISOString())
})

test("a gap carries its answered warm-ups, in the order they're stored, with what was said", () => {
	const first = {
		createdAt: MON,
		studentName: 'Maya',
		question: 'Why a novel?',
		answer: "I don't remember.",
		isRight: false
	}
	const second = {
		createdAt: WED,
		studentName: 'Omar',
		question: 'And the word count?',
		answer: '1,667 words a day.',
		isRight: true
	}
	const [listed] = topicGaps(
		[{ ...gap('novel', 'A novel', SAT), rightStreak: 1, warmUps: [first, second] }],
		RESULTS
	)
	assert.deepEqual(listed!.warm_ups, [
		{
			asked_at: MON.toISOString(),
			student_name: 'Maya',
			question: 'Why a novel?',
			answer: "I don't remember.",
			is_right: false
		},
		{
			asked_at: WED.toISOString(),
			student_name: 'Omar',
			question: 'And the word count?',
			answer: '1,667 words a day.',
			is_right: true
		}
	])
	// The video's words for the idea, and how close it is to closing.
	assert.equal(listed!.quote, 'a novel')
	assert.equal(listed!.right_streak, 1)
	assert.equal(listed!.rights_to_close, 2)
})

test("a video's row counts ideas taught after class and its next warm-up", () => {
	assert.deepEqual(rowProgress(RESULTS, GAPS), {
		idea_count: 5,
		ideas_taught: 3,
		open_gaps: 2,
		next_due_at: WED.toISOString()
	})
	// Before any class has finished, a row carries nothing new.
	assert.deepEqual(rowProgress([], []), {})
})
