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
	closedAt
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
