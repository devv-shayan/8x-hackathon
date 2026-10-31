import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildHelpPrompt, parseHelp } from './help-panel'

const SEGMENTS = [
	{ startSeconds: 5, text: 'Plants take in water.' },
	{ startSeconds: 40, text: 'Leaves catch the light.' }
]

test('the prompt numbers the transcript and carries the question', () => {
	const prompt = buildHelpPrompt(SEGMENTS, 'What do leaves do?')
	for (const part of [
		'What do leaves do?',
		'0: Plants take in water.',
		'1: Leaves catch the light.'
	]) {
		assert.ok(prompt.includes(part), part)
	}
})

test('the time comes from the transcript segment the model pointed at', () => {
	const raw = JSON.stringify({ explanation: ' They catch light. ', segment: 1 })
	assert.deepEqual(parseHelp(raw, SEGMENTS), { explanation: 'They catch light.', startSeconds: 40 })
})

test('no matching segment means no time, never an invented one', () => {
	for (const segment of [-1, 99]) {
		const raw = JSON.stringify({ explanation: 'The video does not cover this.', segment })
		assert.equal(parseHelp(raw, SEGMENTS).startSeconds, null)
	}
})

test('malformed replies are real failures', () => {
	for (const raw of [undefined, 'not json', '{}']) {
		assert.throws(() => parseHelp(raw, SEGMENTS))
	}
})
