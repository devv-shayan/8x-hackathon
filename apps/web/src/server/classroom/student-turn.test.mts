import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	buildFollowUpPrompt,
	buildStudentTurnPrompt,
	heardTurns,
	parseFollowUp,
	parseStudentTurn
} from './student-turn'

const MAYA = { id: 'maya', name: 'Maya', persona: 'A beginner.' }
const OMAR = { id: 'omar', name: 'Omar', persona: 'A sharp student.' }
const STUDENTS = [MAYA, OMAR]
const MAYA_TURN = { studentId: 'maya', question: 'What?', answer: 'This.' }

const INPUT = {
	transcript: 'SECRET TRANSCRIPT',
	explanation: 'Plants eat soil.',
	focusConcepts: ['SECRET CONCEPT'],
	students: STUDENTS,
	turns: [{ studentId: 'maya', question: 'What is soil for?', answer: 'Water.' }],
	pastTurns: [{ studentId: 'omar', question: 'Why green?', answer: null }]
}

test('parseStudentTurn gives the trimmed question to the speaker', () => {
	const raw = JSON.stringify({ question: ' Why? ' })
	assert.deepEqual(parseStudentTurn(raw, 'omar'), { studentId: 'omar', question: 'Why?' })
})

test('parseStudentTurn ends the class when the model has no question', () => {
	assert.equal(parseStudentTurn(JSON.stringify({ question: '  ' }), 'maya'), null)
})

test('malformed replies are real failures', () => {
	for (const raw of [undefined, 'not json', '{}']) {
		assert.throws(() => parseStudentTurn(raw, 'maya'))
		assert.throws(() => parseFollowUp(raw))
	}
})

test('a student who has not seen the video is given none of it', () => {
	const prompt = buildStudentTurnPrompt(INPUT, MAYA, 'no_answer')
	assert.ok(!prompt.includes('SECRET'))
	assert.ok(prompt.includes('You have not seen the video'))
	assert.ok(prompt.includes('Plants eat soil.'))
})

test('the student who knows the video gets all of it', () => {
	const prompt = buildStudentTurnPrompt(INPUT, OMAR, 'answered')
	for (const part of [
		'You are Omar',
		'SECRET TRANSCRIPT',
		'SECRET CONCEPT',
		'Plants eat soil.',
		'Maya asked: What is soil for?',
		'Omar asked: Why green?',
		'(no answer)'
	]) {
		assert.ok(prompt.includes(part), part)
	}
})

test('a follow-up asks again, and the check sees only the last exchange', () => {
	assert.ok(buildStudentTurnPrompt(INPUT, MAYA, 'follow_up').includes('ask it again'))
	assert.equal(buildFollowUpPrompt(MAYA_TURN), 'Question: What?\nAnswer: This.')
})

test('heard turns leave out open questions and follow the order they were answered', () => {
	const at = (minute: number) => new Date(2026, 9, 31, 12, minute)
	const turns = [
		{ id: 'first asked', outcome: 'answered', createdAt: at(0), answeredAt: at(5) },
		{ id: 'second asked', outcome: 'skipped', createdAt: at(1), answeredAt: at(3) },
		{ id: 'still open', outcome: null, createdAt: at(2), answeredAt: null }
	]
	assert.deepEqual(
		heardTurns(turns).map(({ id }) => id),
		['second asked', 'first asked']
	)
})

test('a student with nothing to react to is told not to react', () => {
	assert.ok(buildStudentTurnPrompt(INPUT, MAYA, 'no_answer').includes('nothing to react to'))
	assert.ok(buildStudentTurnPrompt(INPUT, MAYA, 'answered').includes('React to the answer'))
})
