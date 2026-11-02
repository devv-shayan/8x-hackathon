import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toDueWarmUp } from './due'

const GAP = {
	id: 'gap',
	topicId: 'topic',
	topicTitle: 'Try something new for 30 days',
	concept: { title: 'Confidence grows', quote: 'my self-confidence grew', startSeconds: 66 },
	openWarmUp: null
}

test('a due gap names the student who will ask', () => {
	const due = toDueWarmUp(GAP, 'Maya')
	assert.equal(due.student_name, 'Maya')
	assert.equal(due.start_seconds, 66)
	assert.equal(due.has_timestamp, true)
	assert.equal(due.open_warm_up, null)
})

test('a question already saved keeps the student who asked it', () => {
	const due = toDueWarmUp(
		{ ...GAP, openWarmUp: { id: 'w', gapId: 'gap', question: 'Why?', studentName: 'Omar' } },
		'Maya'
	)
	assert.equal(due.student_name, 'Omar')
	assert.equal(due.open_warm_up?.student_name, 'Omar')
})

test('an idea from pasted text has no moment in a video', () => {
	const due = toDueWarmUp(
		{ ...GAP, concept: { title: 'X', quote: 'x', startSeconds: null } },
		'Maya'
	)
	assert.equal(due.has_timestamp, false)
	assert.equal(due.start_seconds, 0)
})
