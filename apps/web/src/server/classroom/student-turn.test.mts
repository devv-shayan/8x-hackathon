import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	buildFollowUpPrompt,
	buildStudentTurnPrompt,
	otherStudent,
	parseFollowUp,
	parseStudentTurn,
	studentWhoCanFollowUp
} from './student-turn'

const MAYA = { id: 'maya', name: 'Maya', persona: 'A beginner.' }
const OMAR = { id: 'omar', name: 'Omar', persona: 'A sharp student.' }
const STUDENTS = [MAYA, OMAR]
const MAYA_TURN = { studentId: 'maya', question: 'What?', answer: 'This.' }
const OMAR_TURN = { studentId: 'omar', question: 'Why?', answer: 'That.' }
const SKIPPED_TURN = { studentId: 'maya', question: 'What?', answer: null }

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

test('students take turns', () => {
	assert.equal(otherStudent(STUDENTS, []).id, 'maya')
	assert.equal(otherStudent(STUDENTS, [MAYA_TURN]).id, 'omar')
	assert.equal(otherStudent(STUDENTS, [OMAR_TURN]).id, 'maya')
})

test('a follow-up goes to the student who asked, once in a row', () => {
	assert.equal(studentWhoCanFollowUp(STUDENTS, [MAYA_TURN])?.id, 'maya')
	assert.equal(studentWhoCanFollowUp(STUDENTS, [MAYA_TURN, MAYA_TURN]), null)
	assert.equal(studentWhoCanFollowUp(STUDENTS, []), null)
})

test('a skip moves on rather than pressing the teacher', () => {
	assert.equal(studentWhoCanFollowUp(STUDENTS, [SKIPPED_TURN]), null)
})

test('a student who has not seen the video is given none of it', () => {
	const prompt = buildStudentTurnPrompt(INPUT, MAYA, false)
	assert.ok(!prompt.includes('SECRET'))
	assert.ok(prompt.includes('You have not seen the video'))
	assert.ok(prompt.includes('Plants eat soil.'))
})

test('the student who knows the video gets all of it', () => {
	const prompt = buildStudentTurnPrompt(INPUT, OMAR, false)
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
	assert.ok(buildStudentTurnPrompt(INPUT, MAYA, true).includes('Ask it again'))
	assert.equal(buildFollowUpPrompt([MAYA_TURN]), 'Question: What?\nAnswer: This.')
})
