import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	DAYS_AFTER_RIGHT,
	DAYS_AFTER_WRONG,
	DAYS_UNTIL_FIRST_DUE,
	firstDueAt,
	isGapDue,
	scheduleAfterJudgment
} from './schedule'

const FOUND = new Date('2026-11-01T00:00:00.000Z')
const JUDGED = new Date('2026-11-03T12:00:00.000Z')

function iso(date: Date): string {
	return date.toISOString()
}

test('a new gap is due two days after it is found', () => {
	assert.equal(DAYS_UNTIL_FIRST_DUE, 2)
	assert.equal(iso(firstDueAt(FOUND)), '2026-11-03T00:00:00.000Z')
})

test('a right answer is due again five days later and stays open', () => {
	const next = scheduleAfterJudgment({ rightStreak: 0 }, true, JUDGED)
	assert.equal(DAYS_AFTER_RIGHT, 5)
	assert.equal(next.rightStreak, 1)
	assert.equal(next.closedAt, null)
	assert.equal(iso(next.nextDueAt), '2026-11-08T12:00:00.000Z')
	assert.equal(isGapDue(next, JUDGED), false)
	assert.equal(isGapDue(next, next.nextDueAt), true)
})

test('a second right answer in a row closes the gap', () => {
	const next = scheduleAfterJudgment({ rightStreak: 1 }, true, JUDGED)
	assert.equal(next.rightStreak, 2)
	assert.equal(next.closedAt?.toISOString(), iso(JUDGED))
	assert.equal(isGapDue(next, next.nextDueAt), false)
	assert.equal(isGapDue(next, new Date('2030-01-01T00:00:00.000Z')), false)
})

test('a wrong answer is due again in two days and the streak resets', () => {
	const next = scheduleAfterJudgment({ rightStreak: 1 }, false, JUDGED)
	assert.equal(DAYS_AFTER_WRONG, 2)
	assert.equal(next.rightStreak, 0)
	assert.equal(next.closedAt, null)
	assert.equal(iso(next.nextDueAt), '2026-11-05T12:00:00.000Z')
})

test('a gap is due at its due time and not a millisecond before', () => {
	const nextDueAt = firstDueAt(FOUND)
	const open = { closedAt: null, nextDueAt }
	assert.equal(isGapDue(open, new Date(nextDueAt.getTime() - 1)), false)
	assert.equal(isGapDue(open, nextDueAt), true)
})
