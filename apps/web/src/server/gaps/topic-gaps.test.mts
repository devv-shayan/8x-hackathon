import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toTopicGaps, type TopicGapRow } from './topic-gaps'

const OPEN: TopicGapRow = {
	id: '00000000-0000-4000-8000-000000000010',
	concept: { title: 'Xylem', quote: 'water moves through xylem', startSeconds: 12 },
	rightStreak: 1,
	nextDueAt: new Date('2026-11-04T00:00:00.000Z'),
	closedAt: null,
	warmUps: [
		{
			id: '00000000-0000-4000-8000-000000000011',
			question: 'Where does the water go?',
			answer: 'Through xylem.',
			isRight: true,
			createdAt: new Date('2026-11-02T00:00:00.000Z'),
			student: { name: 'Maya' }
		}
	]
}

const CLOSED: TopicGapRow = {
	id: '00000000-0000-4000-8000-000000000012',
	concept: { title: 'Stomata', quote: 'gas enters through stomata', startSeconds: null },
	rightStreak: 2,
	nextDueAt: new Date('2026-11-09T00:00:00.000Z'),
	closedAt: new Date('2026-11-09T00:00:00.000Z'),
	warmUps: []
}

test('toTopicGaps counts open and closed and keeps each warm-up', () => {
	const body = toTopicGaps('Plants', [OPEN, CLOSED])
	assert.equal(body.title, 'Plants')
	assert.equal(body.open_count, 1)
	assert.equal(body.closed_count, 1)
	assert.equal(body.gaps[0]?.concept_title, 'Xylem')
	assert.equal(body.gaps[0]?.closed_at, null)
	assert.equal(body.gaps[0]?.warm_ups[0]?.student_name, 'Maya')
	assert.equal(body.gaps[0]?.warm_ups[0]?.is_right, true)
	assert.equal(body.gaps[1]?.closed_at, '2026-11-09T00:00:00.000Z')
	assert.equal(body.gaps[1]?.start_seconds, null)
})

test('a topic with no gaps is an empty list with zero counts', () => {
	assert.deepEqual(toTopicGaps('Empty', []), {
		title: 'Empty',
		open_count: 0,
		closed_count: 0,
		gaps: []
	})
})
