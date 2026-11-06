import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { KeyConcept } from '@/server/video/key-concepts'
import {
	assembleQuiz,
	buildQuizPrompt,
	cutBlank,
	enoughForQuiz,
	pickIdeas,
	planQuiz,
	shimmerWords,
	type PlannedQuestion,
	type QuizIdea,
	type Random
} from './quiz'

const LINE = 'Leaves use sunlight to turn water and carbon dioxide into sugar.'

function concept(title: string, quote = LINE, extra: Partial<KeyConcept> = {}): KeyConcept {
	return { title, quote, startSeconds: 12, ...extra }
}

function idea(title: string, quote = LINE): QuizIdea {
	return { topicTitle: 'Plants', concept: concept(title, quote) }
}

/** Repeats a fixed sequence, so a shuffle is repeatable. */
function sequence(...values: number[]): Random {
	let i = 0
	return () => values[i++ % values.length] as number
}

const FILL: PlannedQuestion = { type: 'fill_blank', idea: idea('Sugar'), isTrue: false }
const CHOICE: PlannedQuestion = { type: 'multiple_choice', idea: idea('Food'), isTrue: false }
const TRUE_ONE: PlannedQuestion = { type: 'true_false', idea: idea('Soil'), isTrue: true }
const FALSE_ONE: PlannedQuestion = { type: 'true_false', idea: idea('Roots'), isTrue: false }

test('pickIdeas drops ideas flagged as not in the video, and repeats', () => {
	const ideas = pickIdeas(
		[
			{
				title: 'One',
				concepts: [concept('Kept'), concept('Gone', LINE, { notInVideo: true })]
			},
			{ title: 'Two', concepts: [concept(' kept  '), concept('Other')] }
		],
		sequence(0.5)
	)
	assert.deepEqual(ideas.map(({ concept: c }) => c.title).sort(), ['Kept', 'Other'])
})

test('five ideas plan five questions using every format, never three in a row', () => {
	for (const seed of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
		const planned = planQuiz(
			['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((title) => idea(title)),
			sequence(seed, 0.3, 0.7, 0.1)
		)
		const types = planned.map(({ type }) => type)
		assert.equal(types.length, 5)
		assert.equal(new Set(types).size, 3)
		for (let i = 0; i + 2 < types.length; i++) {
			assert.ok(!(types[i] === types[i + 1] && types[i] === types[i + 2]), types.join())
		}
	}
})

test('three ideas plan one question of each format', () => {
	const planned = planQuiz([idea('a'), idea('b'), idea('c')], sequence(0.4))
	assert.equal(new Set(planned.map(({ type }) => type)).size, 3)
})

test('a line too long to read never becomes a fill-the-blank', () => {
	const long = 'word '.repeat(60)
	const planned = planQuiz([idea('a', long), idea('b', long), idea('c', long)], sequence(0.4))
	assert.ok(planned.every(({ type }) => type !== 'fill_blank'))
	assert.equal(planned.length, 3)
})

test('the prompt says which statements must be true and which false', () => {
	const prompt = buildQuizPrompt([TRUE_ONE, FALSE_ONE])
	assert.match(prompt, /Item 0[\s\S]*must be TRUE/)
	assert.match(prompt, /Item 1[\s\S]*must be FALSE/)
})

test('cutBlank removes a whole word and keeps the line around it', () => {
	assert.deepEqual(cutBlank('Plants make SUGAR daily.', 'sugar'), {
		before: 'Plants make ',
		answer: 'SUGAR',
		after: ' daily.'
	})
})

test('cutBlank refuses part of a word, a phrase, or a word not in the line', () => {
	assert.equal(cutBlank('Plants make sugars daily.', 'sugar'), null)
	assert.equal(cutBlank(LINE, 'carbon dioxide'), null)
	assert.equal(cutBlank(LINE, 'chlorophyll'), null)
	assert.equal(cutBlank(LINE, 'to'), null)
})

test('a fill-the-blank always reads back as the stored line', () => {
	const [question] = assembleQuiz(
		[FILL],
		JSON.stringify({
			items: [{ index: 0, blank_word: 'sugar', wrong_words: ['soil', 'oxygen', 'minerals'] }]
		}),
		sequence(0.3)
	)
	assert.ok(question?.type === 'fill_blank')
	const answer = question.options[question.right_index]
	assert.equal(answer, 'sugar')
	assert.equal(question.options.length, 4)
	assert.equal(`${question.before}${answer}${question.after}`, LINE)
	assert.equal(question.quote, LINE)
})

test('multiple choice marks the right answer wherever the shuffle put it', () => {
	for (const seed of [0, 0.5, 0.99]) {
		const [question] = assembleQuiz(
			[CHOICE],
			JSON.stringify({
				items: [
					{
						index: 0,
						question: 'Where does a plant get food?',
						right_answer: 'It makes sugar in its leaves',
						wrong_answers: ['From the soil', 'From rain', 'From insects']
					}
				]
			}),
			sequence(seed)
		)
		assert.ok(question?.type === 'multiple_choice')
		assert.equal(question.options[question.right_index], 'It makes sugar in its leaves')
		assert.equal(question.options.length, 4)
	}
})

test("true or false takes its answer from the plan, not the model's words", () => {
	const questions = assembleQuiz(
		[TRUE_ONE, FALSE_ONE],
		JSON.stringify({
			items: [
				{ index: 0, statement: 'Leaves make sugar.' },
				{ index: 1, statement: 'Soil feeds plants.' }
			]
		}),
		sequence(0.5)
	)
	assert.deepEqual(
		questions.map((question) => question.right_index),
		[0, 1]
	)
})

test('an entry that does not hold up is dropped, and the rest stay', () => {
	const questions = assembleQuiz(
		[FILL, CHOICE, FALSE_ONE],
		JSON.stringify({
			items: [
				{ index: 0, blank_word: 'not-in-the-line', wrong_words: ['a1', 'b1', 'c1'] },
				{
					index: 1,
					question: 'Too few wrong answers?',
					right_answer: 'Yes',
					wrong_answers: ['No', 'yes']
				},
				{ index: 2, statement: 'Soil feeds plants.' }
			]
		}),
		sequence(0.5)
	)
	assert.deepEqual(
		questions.map(({ type }) => type),
		['true_false']
	)
})

test('a wrong answer that repeats the right one does not count', () => {
	const questions = assembleQuiz(
		[FILL],
		JSON.stringify({
			items: [{ index: 0, blank_word: 'sugar', wrong_words: ['Sugar', 'soil', 'oxygen'] }]
		}),
		sequence(0.5)
	)
	assert.deepEqual(questions, [])
})

test('a reply that is not the JSON we asked for throws', () => {
	for (const raw of [undefined, 'not json', '{}']) {
		assert.throws(() => assembleQuiz([FILL], raw, sequence(0.5)))
	}
})

test('shimmer words are the ideas, without any too long to fit', () => {
	assert.deepEqual(
		shimmerWords([idea('Chlorophyll'), idea('A very long idea title that will not fit')]),
		['Chlorophyll']
	)
})

test('a quiz needs at least three questions', () => {
	assert.equal(enoughForQuiz(2), false)
	assert.equal(enoughForQuiz(3), true)
})
