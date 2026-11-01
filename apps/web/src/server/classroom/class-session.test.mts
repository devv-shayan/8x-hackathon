// A class survives Gemini failing to score it. The real session code runs against in-memory
// stores, with Gemini answering over a faked fetch, so only the scoring request can fail.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'

process.env.GEMINI_API_KEY = 'fake-gemini-key'
process.env.DATABASE_URL = 'postgresql://user:password@db.test:5432/app'

const { classStore } = await import('@/server/db/classes')
const { gapStore } = await import('@/server/db/gaps')
const { topicStore } = await import('@/server/db/topics')
const { answerTurn, endClass, startClass } = await import('./class-session')

const USER = '00000000-0000-4000-8000-000000000001'
const TOPIC = '11111111-1111-4111-8111-111111111111'
const CLASS = '22222222-2222-4222-8222-222222222222'

const CONCEPTS = [
	{ title: 'Xylem', quote: 'water moves through xylem', startSeconds: 10 },
	{ title: 'Stomata', quote: 'gas enters through stomata', startSeconds: 40 }
]

type Turn = {
	id: string
	classId: string
	studentId: string
	question: string
	answer: string | null
	outcome: 'answered' | 'needed_help' | 'skipped' | null
	helpUsedAt: Date | null
	answeredAt: Date | null
	createdAt: Date
}

let session: {
	id: string
	topicId: string
	explanation: string
	conceptResults: { concept: string; result: 'correct' | 'missed' | 'wrong' }[]
	turns: Turn[]
	createdAt: Date
}
let scoreCalls = 0
let failedScoreCalls = 0
let afterClassCalls = 0
let afterClassFails = false
let questionPrompts: string[] = []
let gapSaves: { concept: string; result: 'correct' | 'missed' | 'wrong' }[][] = []

const students = [
	{ id: 'maya', userId: USER, name: 'Maya', persona: 'Beginner', createdAt: new Date() },
	{ id: 'omar', userId: USER, name: 'Omar', persona: 'Sharp', createdAt: new Date() }
]

Object.assign(topicStore, {
	findById: async () => ({
		id: TOPIC,
		youtubeId: 'video',
		title: 'Plants',
		segments: [{ startSeconds: 0, text: 'water moves through xylem' }],
		concepts: CONCEPTS
	})
})

Object.assign(classStore, {
	studentsFor: async () => students,
	pastTurns: async () => [],
	create: async (topicId: string, explanation: string, conceptResults: never[]) => {
		session = { id: CLASS, topicId, explanation, conceptResults, turns: [], createdAt: new Date() }
		return structuredClone(session)
	},
	find: async () => structuredClone(session),
	addTurn: async (classId: string, studentId: string, question: string) => {
		session.turns.push({
			id: `turn-${session.turns.length}`,
			classId,
			studentId,
			question,
			answer: null,
			outcome: null,
			helpUsedAt: null,
			answeredAt: null,
			createdAt: new Date()
		})
	},
	answerTurn: async (_classId: string, turnId: string, saved: Pick<Turn, 'answer' | 'outcome'>) => {
		const turn = session.turns.find(({ id }) => id === turnId)
		if (!turn) return false
		Object.assign(turn, saved, { answeredAt: new Date() })
		return true
	},
	dropOpenTurns: async () => {
		session.turns = session.turns.filter(({ outcome }) => outcome !== null)
	},
	saveConceptResults: async (_classId: string, results: typeof session.conceptResults) => {
		session.conceptResults = results
	}
})

Object.assign(gapStore, {
	saveFromResults: async (input: {
		results: { concept: string; result: 'correct' | 'missed' | 'wrong' }[]
	}) => {
		gapSaves.push(input.results)
	}
})

function geminiReply(text: unknown): Response {
	const candidates = [
		{ content: { parts: [{ text: JSON.stringify(text) }] }, finishReason: 'STOP' }
	]
	return Response.json({ candidates })
}

globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
	const request = String(init?.body)
	if (request.includes('by the end of a class')) {
		afterClassCalls += 1
		if (afterClassFails) throw new TypeError('fetch failed')
		return geminiReply({ results: [{ concept: 'Xylem', result: 'correct' }] })
	}
	if (request.includes("score a teacher's explanation")) {
		scoreCalls += 1
		if (scoreCalls <= failedScoreCalls) throw new TypeError('fetch failed')
		return geminiReply({ results: [{ concept: 'Xylem', result: 'wrong' }] })
	}
	if (request.includes('follow_up')) return geminiReply({ follow_up: false })
	if (request.includes('has a question ready'))
		return geminiReply({ reason: 'new', status: 'open' })
	questionPrompts.push(request)
	return geminiReply({ question: 'What does that mean?' })
}) as typeof fetch

beforeEach(() => {
	scoreCalls = 0
	failedScoreCalls = 0
	afterClassCalls = 0
	afterClassFails = false
	questionPrompts = []
	gapSaves = []
})

async function classWithOneAnswer() {
	await startClass(USER, TOPIC, 'Plants drink.')
	await answerTurn(USER, CLASS, 'turn-0', 'answered', 'Water rises through xylem.')
}

test('a class scored at the start asks about what was missed or wrong', async () => {
	const started = await startClass(USER, TOPIC, 'Plants drink.')
	assert.equal(started.turns.length, 2)
	assert.equal(scoreCalls, 1)
	assert.ok(questionPrompts.some((prompt) => prompt.includes('Xylem')))
	assert.deepEqual(gapSaves, [
		[
			{ concept: 'Xylem', result: 'wrong' },
			{ concept: 'Stomata', result: 'missed' }
		]
	])
})

test('a scoring failure still starts the class, about every concept', async () => {
	failedScoreCalls = 2
	const started = await startClass(USER, TOPIC, 'Plants drink.')
	assert.equal(started.turns.length, 2)
	assert.equal(session.conceptResults.length, 0)
	assert.deepEqual(gapSaves, [])
	const omar = questionPrompts.find((prompt) => prompt.includes('Focus concepts'))
	assert.ok(omar?.includes('Xylem') && omar.includes('Stomata'))
})

test('ending a class that failed to score scores it', async () => {
	failedScoreCalls = 2
	await startClass(USER, TOPIC, 'Plants drink.')
	failedScoreCalls = 0
	scoreCalls = 0
	const ended = await endClass(USER, CLASS)
	assert.equal(ended.finished, true)
	assert.deepEqual(
		ended.concept_results?.map(({ concept, result }) => [concept, result]),
		[
			['Xylem', 'wrong'],
			['Stomata', 'missed']
		]
	)
	assert.equal(gapSaves.length, 1)
})

test('a class that still cannot be scored ends without a score', async () => {
	failedScoreCalls = 10
	await startClass(USER, TOPIC, 'Plants drink.')
	const ended = await endClass(USER, CLASS)
	assert.equal(ended.finished, true)
	assert.deepEqual(ended.concept_results, [])
})

test('answering the last question scores a class that failed to score', async () => {
	failedScoreCalls = 2
	await startClass(USER, TOPIC, 'Plants drink.')
	failedScoreCalls = 0
	session.turns = session.turns.slice(0, 1)
	session.turns.push(
		...['a', 'b', 'c'].map((id) => ({
			...session.turns[0]!,
			id,
			outcome: 'answered' as const,
			answer: 'Yes'
		}))
	)
	const finished = await answerTurn(USER, CLASS, 'turn-0', 'answered', 'Water rises.')
	assert.equal(finished.finished, true)
	assert.equal(finished.concept_results?.length, CONCEPTS.length)
})

test('a class that already has a score is not scored again', async () => {
	await startClass(USER, TOPIC, 'Plants drink.')
	await endClass(USER, CLASS)
	assert.equal(scoreCalls, 1)
	assert.equal(gapSaves.length, 1)
})

test('ending a class counts what was said in it, and keeps the first score', async () => {
	await classWithOneAnswer()
	const ended = await endClass(USER, CLASS)
	assert.equal(afterClassCalls, 1)
	assert.deepEqual(
		ended.concept_results?.map(({ concept, result, result_after_class }) => [
			concept,
			result,
			result_after_class
		]),
		[
			['Xylem', 'wrong', 'correct'],
			['Stomata', 'missed', 'missed']
		]
	)
})

test('a class with no answers is not scored again', async () => {
	await startClass(USER, TOPIC, 'Plants drink.')
	const ended = await endClass(USER, CLASS)
	assert.equal(afterClassCalls, 0)
	assert.ok(ended.concept_results?.every(({ result_after_class }) => result_after_class === null))
})

test('a failed score after class leaves the first score', async () => {
	await classWithOneAnswer()
	afterClassFails = true
	const ended = await endClass(USER, CLASS)
	assert.equal(ended.finished, true)
	assert.deepEqual(
		ended.concept_results?.map(({ result, result_after_class }) => [result, result_after_class]),
		[
			['wrong', null],
			['missed', null]
		]
	)
})

test('a class is only scored after class once', async () => {
	await classWithOneAnswer()
	await endClass(USER, CLASS)
	await endClass(USER, CLASS)
	assert.equal(afterClassCalls, 1)
})
