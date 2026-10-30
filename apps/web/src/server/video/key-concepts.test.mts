import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/server/api/app-errors'
import { findQuoteStart, MAX_KEY_CONCEPTS, parseKeyConcepts } from './key-concepts'

const SEGMENTS = [
	{ startSeconds: 0, text: 'Photosynthesis! You would be dead without plants.' },
	{ startSeconds: 89, text: 'Water reaches the leaves through tissues called' },
	{ startSeconds: 92, text: 'xylem. Carbon dioxide gets in through stomata.' },
	{ startSeconds: 320, text: 'Splitting H2O gives hydrogen ions and oxygen.' }
]

function reply(concepts: Array<{ title: string; quote: string }>): string {
	return JSON.stringify({ concepts })
}

const XYLEM = { title: 'Xylem', quote: 'tissues called xylem' }
const STOMATA = { title: 'Stomata', quote: 'Carbon dioxide gets in through stomata' }
const WATER = { title: 'Splitting water', quote: 'Splitting H2O gives hydrogen ions' }

test('findQuoteStart ignores capitals and punctuation', () => {
	assert.equal(findQuoteStart('PHOTOSYNTHESIS you would be dead', SEGMENTS), 0)
	assert.equal(findQuoteStart('hydrogen ions, and oxygen!', SEGMENTS), 320)
})

test('findQuoteStart gives the start of a quote that runs across segments', () => {
	assert.equal(findQuoteStart('tissues called xylem', SEGMENTS), 89)
})

test('findQuoteStart returns null for words the video never said', () => {
	assert.equal(findQuoteStart('plants eat soil', SEGMENTS), null)
	assert.equal(findQuoteStart('the leaves xylem', SEGMENTS), null)
	assert.equal(findQuoteStart('...', SEGMENTS), null)
})

test('parseKeyConcepts takes timestamps from the transcript and sorts by video order', () => {
	const { concepts, droppedCount } = parseKeyConcepts(reply([WATER, XYLEM, STOMATA]), SEGMENTS)
	assert.deepEqual(
		concepts.map((concept) => concept.startSeconds),
		[89, 92, 320]
	)
	assert.equal(droppedCount, 0)
})

test('parseKeyConcepts drops a quote not in the transcript, and a repeated one', () => {
	const invented = { title: 'Invented', quote: 'plants get their food from soil' }
	const repeat = { title: 'Xylem again', quote: 'TISSUES called xylem.' }
	const { concepts, droppedCount } = parseKeyConcepts(
		reply([XYLEM, invented, STOMATA, repeat, WATER]),
		SEGMENTS
	)
	assert.deepEqual(
		concepts.map((concept) => concept.title),
		['Xylem', 'Stomata', 'Splitting water']
	)
	assert.equal(droppedCount, 2)
})

test('parseKeyConcepts keeps at most the maximum', () => {
	const many = Array.from({ length: MAX_KEY_CONCEPTS + 3 }, (_, index) => ({
		title: `Concept ${index}`,
		quote: `idea number ${index}`
	}))
	const segments = many.map(({ quote }, index) => ({ startSeconds: index, text: quote }))
	assert.equal(parseKeyConcepts(reply(many), segments).concepts.length, MAX_KEY_CONCEPTS)
})

test('parseKeyConcepts tells the user when too few concepts survive', () => {
	const invented = { title: 'Invented', quote: 'plants get their food from soil' }
	assert.throws(
		() => parseKeyConcepts(reply([XYLEM, STOMATA, invented]), SEGMENTS),
		(error: unknown) => error instanceof ApiError && error.code === 'video_unreadable'
	)
})

test('parseKeyConcepts treats a malformed reply as a real failure, not a user error', () => {
	for (const raw of [undefined, 'not json', '{}']) {
		assert.throws(
			() => parseKeyConcepts(raw, SEGMENTS),
			(error: unknown) => !(error instanceof ApiError)
		)
	}
})
