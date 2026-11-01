import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isGapDue } from './schedule'
import { pastClassSeed } from './seed'

const NOW = new Date('2026-11-02T12:00:00.000Z')

test('the seeded class is already due for a warm-up', () => {
	const seeded = pastClassSeed(NOW)
	assert.equal(seeded.conceptResults[0]?.result, 'missed')
	assert.ok(seeded.segments.some(({ text }) => text.includes(seeded.concepts[0]?.quote ?? '')))
	assert.ok(seeded.foundAt.getTime() < seeded.nextDueAt.getTime())
	assert.equal(isGapDue({ closedAt: null, nextDueAt: seeded.nextDueAt }, NOW), true)
})
