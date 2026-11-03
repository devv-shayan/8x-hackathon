import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPastedTopic } from '@app/contract'
import { pasteTopicId, segmentsFromPaste, titleFromPaste } from './paste-text'

const NOTES = [
	'Working memory is the mental workspace you use to hold information right now.',
	'It is limited. Most people keep about four chunks in mind at once.',
	'Attention decides what enters, and what attention misses is gone.'
].join('\n\n')

test('the same text always maps to one pasted-topic id', () => {
	const id = pasteTopicId(NOTES)
	assert.equal(id, pasteTopicId(`  ${NOTES}  `))
	assert.equal(isPastedTopic(id), true)
	assert.equal(isPastedTopic('dQw4w9WgXcQ'), false)
})

test('paragraphs become segments with no video time', () => {
	const segments = segmentsFromPaste(NOTES)
	assert.equal(segments.length, 3)
	assert.ok(segments.every((segment) => segment.startSeconds === 0))
})

test('a pasted title is the first line', () => {
	assert.equal(
		titleFromPaste(NOTES),
		'Working memory is the mental workspace you use to hold information right now.'
	)
})
