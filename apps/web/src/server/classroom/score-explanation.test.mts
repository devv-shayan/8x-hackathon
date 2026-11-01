import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/server/api/app-errors'
import {
	buildScorePrompt,
	focusConceptLines,
	parseExplanationScore,
	parseStoredConceptResults,
	scoreResponseJsonSchema
} from './score-explanation'

const CONCEPTS = [
	{ title: 'Xylem', quote: 'water moves through xylem' },
	{ title: 'Stomata', quote: 'carbon dioxide enters through stomata' },
	{ title: 'Splitting water', quote: 'splitting water releases oxygen' }
]

function reply(results: Array<{ concept: string; result: string }>): string {
	return JSON.stringify({ results })
}

test('parseExplanationScore keeps one judgment per stored concept, under its stored title', () => {
	const scored = parseExplanationScore(
		reply([
			{ concept: 'xylem', result: 'correct' },
			{ concept: ' Stomata ', result: 'wrong' },
			{ concept: 'Splitting water', result: 'missed' }
		]),
		CONCEPTS
	)
	assert.deepEqual(scored, [
		{ concept: 'Xylem', result: 'correct' },
		{ concept: 'Stomata', result: 'wrong' },
		{ concept: 'Splitting water', result: 'missed' }
	])
})

test('parseExplanationScore drops a concept the model invents', () => {
	const scored = parseExplanationScore(
		reply([
			{ concept: 'Xylem', result: 'correct' },
			{ concept: 'Soil food', result: 'wrong' },
			{ concept: 'Stomata', result: 'missed' },
			{ concept: 'Splitting water', result: 'correct' }
		]),
		CONCEPTS
	)
	assert.deepEqual(
		scored.map(({ concept }) => concept),
		['Xylem', 'Stomata', 'Splitting water']
	)
})

test('a concept the model skips, or labels unclearly, counts as missed', () => {
	const scored = parseExplanationScore(
		reply([
			{ concept: 'Xylem', result: 'correct' },
			{ concept: 'Stomata', result: 'partial' }
		]),
		CONCEPTS
	)
	assert.deepEqual(scored, [
		{ concept: 'Xylem', result: 'correct' },
		{ concept: 'Stomata', result: 'missed' },
		{ concept: 'Splitting water', result: 'missed' }
	])
})

test('the first judgment for a concept wins', () => {
	const scored = parseExplanationScore(
		reply([
			{ concept: 'Xylem', result: 'wrong' },
			{ concept: 'Xylem', result: 'correct' },
			{ concept: 'Stomata', result: 'correct' },
			{ concept: 'Splitting water', result: 'correct' }
		]),
		CONCEPTS
	)
	assert.equal(scored[0]?.result, 'wrong')
})

test('a malformed reply is a real failure, not a user error', () => {
	for (const raw of [undefined, 'not json', '{}']) {
		assert.throws(
			() => parseExplanationScore(raw, CONCEPTS),
			(error: unknown) => !(error instanceof ApiError)
		)
	}
})

test('a reply that judges none of the stored concepts is a failure, not a zero', () => {
	const titlesWithQuotes = CONCEPTS.map(({ title, quote }) => ({
		concept: `${title}: "${quote}"`,
		result: 'correct'
	}))
	assert.throws(() => parseExplanationScore(reply(titlesWithQuotes), CONCEPTS))
	assert.throws(() => parseExplanationScore(reply([]), CONCEPTS))
})

test('the response schema only allows the stored titles', () => {
	const { concept } = scoreResponseJsonSchema(CONCEPTS).properties.results.items.properties
	assert.deepEqual(
		concept.enum,
		CONCEPTS.map(({ title }) => title)
	)
})

test('focusConceptLines keeps only what was missed or wrong', () => {
	const lines = focusConceptLines(CONCEPTS, [
		{ concept: 'Xylem', result: 'correct' },
		{ concept: 'Stomata', result: 'wrong' },
		{ concept: 'Splitting water', result: 'missed' }
	])
	assert.deepEqual(lines, [
		'Stomata: "carbon dioxide enters through stomata"',
		'Splitting water: "splitting water releases oxygen"'
	])
})

test('focusConceptLines is empty when every concept is correct', () => {
	const lines = focusConceptLines(
		CONCEPTS,
		CONCEPTS.map(({ title }) => ({ concept: title, result: 'correct' as const }))
	)
	assert.deepEqual(lines, [])
})

test('focusConceptLines keeps every concept when the class has no score', () => {
	assert.equal(focusConceptLines(CONCEPTS, []).length, CONCEPTS.length)
})

test('the prompt carries the explanation, the stored concepts, and the transcript', () => {
	const prompt = buildScorePrompt(
		'Plants drink through tubes.',
		CONCEPTS,
		'Water moves through xylem.'
	)
	for (const part of [
		'Plants drink through tubes.',
		'Xylem: "water moves through xylem"',
		'Water moves through xylem.'
	]) {
		assert.ok(prompt.includes(part), part)
	}
})

test('parseStoredConceptResults accepts the shape written on the class', () => {
	assert.deepEqual(parseStoredConceptResults([{ concept: 'Xylem', result: 'missed' }]), [
		{ concept: 'Xylem', result: 'missed' }
	])
	assert.throws(() => parseStoredConceptResults([{ concept: 'Xylem', result: 'partial' }]))
})
