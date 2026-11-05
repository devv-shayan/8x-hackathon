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

test('an idea missed again after she kept it is one line, the open one', () => {
	const ideas = memoryIdeas(
		[
			row({ gapId: 'kept', conceptTitle: 'Herd immunity', closedAt: NOW, judged: true }),
			row({ gapId: 'again', conceptTitle: 'Herd immunity' })
		],
		NOW
	)
	assert.deepEqual(
		ideas.map((idea) => [idea.gap_id, idea.closed]),
		[['again', false]]
	)
})

test('the same lesson pasted twice shows each idea once, the most due one', () => {
	const ideas = memoryIdeas(
		[
			row({
				gapId: 'second',
				topicId: '44444444-4444-4444-8444-444444444444',
				conceptTitle: 'Antibodies',
				nextDueAt: new Date('2026-11-08T00:00:00.000Z')
			}),
			row({
				gapId: 'first',
				conceptTitle: ' antibodies ',
				nextDueAt: new Date('2026-11-02T00:00:00.000Z')
			}),
			row({ gapId: 'other', conceptTitle: 'A virus' })
		],
		NOW
	)
	assert.deepEqual(
		ideas.map((idea) => idea.gap_id),
		['first', 'other']
	)
})

test('the same idea in two different lessons stays two lines', () => {
	const ideas = memoryIdeas(
		[
			row({ gapId: 'a', conceptTitle: 'Antibodies' }),
			row({
				gapId: 'b',
				topicId: '44444444-4444-4444-8444-444444444444',
				topicTitle: 'Allergies',
				conceptTitle: 'Antibodies'
			})
		],
		NOW
	)
	assert.equal(ideas.length, 2)
})
