// GET /api/app/v1/quiz: who may ask, and what someone who has taught too little gets. Writing
// the quiz itself is covered in src/server/quiz/quiz.test.mts. The store is faked.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { quizResponse } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { topicStore } = await import('@/server/db/topics')

const NOT_ENOUGH = [
	{
		title: 'Plants',
		concepts: [
			{ title: 'Sugar', quote: 'Leaves make sugar.', startSeconds: 4 },
			{ title: 'Soil', quote: 'Soil gives water.', startSeconds: 9 },
			{ title: 'Flagged', quote: 'Not really said.', startSeconds: 12, notInVideo: true }
		]
	}
]

beforeEach(() => {
	reset()
	fakeStore(topicStore, 'listConcepts', () => NOT_ENOUGH)
})

test('GET quiz: too few ideas is an empty quiz, without asking the model', async () => {
	const res = await send(route.GET, '/api/app/v1/quiz')
	assert.equal(res.status, 200)
	assert.ok(quizResponse.safeParse(res.body).success)
	assert.deepEqual(res.body, { questions: [], shimmer_words: [] })
	assert.equal(fake.storeCalls[0]?.args[0], USER)
})

test('GET quiz: no token is a 401, and no store is asked', async () => {
	const res = await send(route.GET, '/api/app/v1/quiz', { token: null })
	assert.equal(res.status, 401)
	assert.deepEqual(fake.storeCalls, [])
})
