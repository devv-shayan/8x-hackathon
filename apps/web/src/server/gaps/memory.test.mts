import { test } from 'node:test'
import assert from 'node:assert/strict'
import { memoryIdeas, type MemoryRow } from './memory'

const NOW = new Date('2026-11-04T00:00:00.000Z')

function row(partial: Partial<MemoryRow> & Pick<MemoryRow, 'gapId' | 'conceptTitle'>): MemoryRow {
	return {
		topicId: '33333333-3333-4333-8333-333333333333',
		topicTitle: 'Vaccines',
		closedAt: null,
		nextDueAt: new Date('2026-11-06T00:00:00.000Z'),
		judged: false,
		...partial
	}
}

test('a closed gap has no due date, and due gaps come before ones still waiting', () => {
	const ideas = memoryIdeas(
		[
			row({ gapId: 'a', conceptTitle: 'Later', nextDueAt: new Date('2026-11-09T00:00:00.000Z') }),
			row({
				gapId: 'b',
				conceptTitle: 'Kept',
				closedAt: NOW,
				judged: true
			}),
			row({ gapId: 'c', conceptTitle: 'Due', nextDueAt: new Date('2026-11-01T00:00:00.000Z') })
		],
		NOW
	)
	assert.deepEqual(
		ideas.map((idea) => idea.concept_title),
		['Due', 'Later', 'Kept']
	)
	assert.equal(ideas[2]?.next_due_at, null)
	assert.equal(ideas[2]?.closed, true)
})
