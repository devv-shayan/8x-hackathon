import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReactionPrompt, parseReactions, parseStoredReactions } from './reactions'

const MAYA = {
	id: '00000000-0000-4000-8000-000000000001',
	name: 'Maya',
	persona: 'curious beginner'
}
const OMAR = {
	id: '00000000-0000-4000-8000-000000000002',
	name: 'Omar',
	persona: 'sharp student'
}

test('parseReactions keeps one line per known student and drops invents', () => {
	const raw = JSON.stringify({
		reactions: [
			{ student_id: MAYA.id, text: '  That example helped.  ' },
			{ student_id: 'not-a-student', text: 'Nope' },
			{ student_id: MAYA.id, text: 'Duplicate' },
			{ student_id: OMAR.id, text: 'Still fuzzy on the second idea.' }
		]
	})
	assert.deepEqual(parseReactions(raw, [MAYA, OMAR]), [
		{ studentId: MAYA.id, text: 'That example helped.' },
		{ studentId: OMAR.id, text: 'Still fuzzy on the second idea.' }
	])
})

test('parseReactions refuses an empty or unusable reply', () => {
	assert.throws(() => parseReactions('', [MAYA]))
	assert.throws(() =>
		parseReactions(JSON.stringify({ reactions: [{ student_id: 'x', text: 'hi' }] }), [MAYA])
	)
})

test('buildReactionPrompt names the roster and what happened', () => {
	const prompt = buildReactionPrompt({
		students: [MAYA],
		turns: [
			{
				studentId: MAYA.id,
				question: 'What is photosynthesis?',
				answer: 'Plants make food from light.',
				outcome: 'answered'
			}
		]
	})
	assert.match(prompt, /Maya/)
	assert.match(prompt, /photosynthesis/)
	assert.match(prompt, /Plants make food/)
})

test('parseStoredReactions accepts null and a saved list', () => {
	assert.equal(parseStoredReactions(null), null)
	assert.deepEqual(parseStoredReactions([{ studentId: MAYA.id, text: 'Thanks.' }]), [
		{ studentId: MAYA.id, text: 'Thanks.' }
	])
})
