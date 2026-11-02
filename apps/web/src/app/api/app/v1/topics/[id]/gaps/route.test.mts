// GET /api/app/v1/topics/{id}/gaps: one video's page, only for the person's own topic, in the
// contract's shape. The stores are faked and every call recorded, so "scoped by the verified
// user" is an assertion.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getTopicGapsResponse } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { topicStore } = await import('@/server/db/topics')
const { classStore } = await import('@/server/db/classes')
const { gapStore } = await import('@/server/db/gaps')

const TOPIC_ID = '33333333-3333-4333-8333-333333333333'
const GAP_ID = '44444444-4444-4444-8444-444444444444'
const CLOSED_ID = '55555555-5555-4555-8555-555555555555'
const TAUGHT = new Date('2026-11-02T08:00:00.000Z')
const WED = new Date('2026-11-04T08:00:00.000Z')

const topic = { id: TOPIC_ID, youtubeId: 'UNP03fDSj1U', title: 'Try something new for 30 days' }

beforeEach(() => {
	reset()
	fakeStore(topicStore, 'findById', (_user: string, id: string) => (id === TOPIC_ID ? topic : null))
	fakeStore(
		classStore,
		'latestFinishedForTopics',
		() =>
			new Map([
				[
					TOPIC_ID,
					{
						createdAt: TAUGHT,
						conceptResults: [
							{ concept: 'Thirty days', result: 'correct', resultAfterClass: 'correct' },
							{ concept: 'Confidence', result: 'missed', resultAfterClass: 'correct' },
							{ concept: 'A novel', result: 'missed', resultAfterClass: 'missed' }
						]
					}
				]
			])
	)
	fakeStore(
		gapStore,
		'listForTopics',
		() =>
			new Map([
				[
					TOPIC_ID,
					[
						{
							id: CLOSED_ID,
							concept: { title: 'Confidence', quote: 'q', startSeconds: 66 },
							nextDueAt: WED,
							closedAt: TAUGHT
						},
						{
							id: GAP_ID,
							concept: { title: 'A novel', quote: 'q', startSeconds: 111 },
							nextDueAt: WED,
							closedAt: null
						}
					]
				]
			])
	)
})

test("GET topic gaps: the person's video, both scores and every gap, open first", async () => {
	const res = await send(route.GET, `/api/app/v1/topics/${TOPIC_ID}/gaps`, {
		params: { id: TOPIC_ID }
	})
	assert.equal(res.status, 200)
	assert.ok(getTopicGapsResponse.safeParse(res.body).success)
	assert.deepEqual(res.body.explanation_score, { correct: 1, total: 3 })
	assert.deepEqual(res.body.after_class_score, { correct: 2, total: 3 })
	assert.equal(res.body.taught_at, TAUGHT.toISOString())
	assert.deepEqual(
		res.body.gaps.map(({ id, closed }: { id: string; closed: boolean }) => [id, closed]),
		[
			[GAP_ID, false],
			[CLOSED_ID, true]
		]
	)
	// Every store was asked for this person only.
	for (const call of fake.storeCalls) assert.equal(call.args[0], USER)
})

test("GET topic gaps: someone else's topic, or none, is a 404 and reads nothing else", async () => {
	const other = '66666666-6666-4666-8666-666666666666'
	const res = await send(route.GET, `/api/app/v1/topics/${other}/gaps`, { params: { id: other } })
	assert.equal(res.status, 404)
	assert.deepEqual(
		fake.storeCalls.map(({ method }: { method: string }) => method),
		['findById']
	)
})

test('GET topic gaps: no token is a 401, and no store is asked', async () => {
	const res = await send(route.GET, `/api/app/v1/topics/${TOPIC_ID}/gaps`, {
		params: { id: TOPIC_ID },
		token: null
	})
	assert.equal(res.status, 401)
	assert.deepEqual(fake.storeCalls, [])
})
