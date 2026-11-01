import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/server/api/app-errors'
import {
	WARM_UP_JUDGE_INSTRUCTION,
	WARM_UP_QUESTION_INSTRUCTION,
	buildWarmUpJudgePrompt,
	buildWarmUpQuestionPrompt,
	parseWarmUpJudgment,
	parseWarmUpQuestion,
	warmUpReplyError
} from './turn'

const CONCEPT = { title: 'Xylem', quote: 'water moves through xylem' }

test('parseWarmUpQuestion returns the trimmed question', () => {
	assert.equal(
		parseWarmUpQuestion(JSON.stringify({ question: ' How does water get up? ' })),
		'How does water get up?'
	)
})

test('an empty or malformed question reply throws', () => {
	for (const raw of [undefined, 'not json', '{}', JSON.stringify({ question: '  ' })]) {
		assert.throws(() => parseWarmUpQuestion(raw))
	}
})

test('parseWarmUpJudgment reads is_right', () => {
	assert.equal(parseWarmUpJudgment(JSON.stringify({ is_right: true })), true)
	assert.equal(parseWarmUpJudgment(JSON.stringify({ is_right: false })), false)
})

test('a malformed judgment throws', () => {
	for (const raw of [undefined, 'not json', '{}', JSON.stringify({ is_right: 'yes' })]) {
		assert.throws(() => parseWarmUpJudgment(raw))
	}
})

test('the question instruction asks for one in-character question and hides the answer', () => {
	assert.match(WARM_UP_QUESTION_INSTRUCTION, /Never give the answer away/)
	assert.match(WARM_UP_QUESTION_INSTRUCTION, /No multiple choice/)
})

test('the question prompt names the student, the gap, and the transcript', () => {
	const maya = buildWarmUpQuestionPrompt({
		student: { name: 'Maya', persona: 'A curious beginner.' },
		concept: CONCEPT,
		transcript: 'SECRET TRANSCRIPT',
		past: []
	})
	assert.match(maya, /Maya/)
	assert.match(maya, /A curious beginner/)
	assert.match(maya, /Xylem/)
	assert.match(maya, /water moves through xylem/)
	assert.match(maya, /SECRET TRANSCRIPT/)
	assert.match(maya, /plain words/)
	assert.match(maya, /must not give away/)
	assert.doesNotMatch(maya, /watched this video/)

	const omar = buildWarmUpQuestionPrompt({
		student: { name: 'Omar', persona: 'A sharp student.' },
		concept: CONCEPT,
		transcript: 'SECRET TRANSCRIPT',
		past: [{ question: 'Why green?', answer: 'Chlorophyll.' }]
	})
	assert.match(omar, /watched this video/)
	assert.match(omar, /Why green\?/)
	assert.match(omar, /Chlorophyll/)
})

test('the judge prompt holds the answer against the quote', () => {
	assert.match(WARM_UP_JUDGE_INSTRUCTION, /is_right/)
	const prompt = buildWarmUpJudgePrompt({
		concept: CONCEPT,
		transcript: 'SECRET TRANSCRIPT',
		question: 'How does water get up?',
		answer: 'Through tubes.'
	})
	assert.match(prompt, /Through tubes/)
	assert.match(prompt, /water moves through xylem/)
	assert.match(prompt, /SECRET TRANSCRIPT/)
	assert.match(prompt, /How does water get up\?/)
})

test('a malformed model reply becomes a friendly error, and other errors do not', () => {
	const error = warmUpReplyError(new SyntaxError('bad'), 'Try again.')
	assert.ok(error instanceof ApiError)
	assert.equal(error?.message, 'Try again.')
	assert.equal(error?.code, 'unavailable')
	assert.equal(warmUpReplyError(new Error('db down'), 'Try again.'), null)
	try {
		parseWarmUpJudgment('{}')
	} catch (caught) {
		const mapped = warmUpReplyError(caught, 'Try again.')
		assert.ok(mapped instanceof ApiError)
	}
})
