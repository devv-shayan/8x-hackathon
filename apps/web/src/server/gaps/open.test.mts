import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conceptsNeedingGaps } from './open'

const CONCEPTS = [
	{ title: 'Xylem', quote: 'water moves through xylem', startSeconds: 10 },
	{ title: 'Stomata', quote: 'gas enters through stomata', startSeconds: 40 },
	{ title: 'Chlorophyll', quote: 'leaves are green', startSeconds: 70 }
]

test('missed and wrong concepts open a gap, and a correct one does not', () => {
	const opened = conceptsNeedingGaps({
		concepts: CONCEPTS,
		results: [
			{ concept: 'Xylem', result: 'wrong' },
			{ concept: 'Stomata', result: 'missed' },
			{ concept: 'Chlorophyll', result: 'correct' }
		],
		openTitles: []
	})
	assert.deepEqual(
		opened.map(({ title }) => title),
		['Xylem', 'Stomata']
	)
})

test('a concept that already has an open gap is not opened again', () => {
	const opened = conceptsNeedingGaps({
		concepts: CONCEPTS,
		results: [
			{ concept: 'xylem', result: 'missed' },
			{ concept: 'Stomata', result: 'wrong' }
		],
		openTitles: ['Xylem']
	})
	assert.deepEqual(
		opened.map(({ title }) => title),
		['Stomata']
	)
})

test('nothing opens when every missed concept already has a gap', () => {
	const opened = conceptsNeedingGaps({
		concepts: CONCEPTS,
		results: [{ concept: 'Stomata', result: 'missed' }],
		openTitles: ['stomata']
	})
	assert.deepEqual(opened, [])
})
