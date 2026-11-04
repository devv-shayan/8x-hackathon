// GET /api/app/v1/memory: the person's own gaps, in board order. The store is faked.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { listMemoryResponse } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { gapStore } = await import('@/server/db/gaps')

const DUE = '44444444-4444-4444-8444-444444444444'
const LATER = '55555555-5555-4555-8555-555555555555'
const CLOSED = '66666666-6666-4666-8666-666666666666'
const TOPIC = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
	reset()
	fakeStore(gapStore, 'listMemory', () => [
		{
			gapId: CLOSED,
			topicId: TOPIC,
			topicTitle: 'Vaccines',
			conceptTitle: 'Herd immunity',
			closedAt: new Date('2026-11-01T00:00:00.000Z'),
			nextDueAt: new Date('2026-11-01T00:00:00.000Z'),
			judged: true
		},
		{
			gapId: LATER,
			topicId: TOPIC,
			topicTitle: 'Vaccines',
			conceptTitle: 'Antibodies',
			closedAt: null,
			nextDueAt: new Date('2099-01-01T00:00:00.000Z'),
			judged: false
		},
		{
			gapId: DUE,
			topicId: TOPIC,
			topicTitle: 'Vaccines',
			conceptTitle: 'A virus',
			closedAt: null,
			nextDueAt: new Date('2020-01-01T00:00:00.000Z'),
			judged: true
		}
	])
})

test("GET memory: the person's gaps, due first, then fading, then kept", async () => {
	const res = await send(route.GET, '/api/app/v1/memory')
	assert.equal(res.status, 200)
	assert.ok(listMemoryResponse.safeParse(res.body).success)
	assert.deepEqual(
		res.body.ideas.map(({ gap_id, closed }: { gap_id: string; closed: boolean }) => [
			gap_id,
			closed
		]),
		[
			[DUE, false],
			[LATER, false],
			[CLOSED, true]
		]
	)
	assert.equal(res.body.ideas[2].next_due_at, null)
	assert.equal(fake.storeCalls[0]?.args[0], USER)
})

test('GET memory: no token is a 401, and no store is asked', async () => {
	const res = await send(route.GET, '/api/app/v1/memory', { token: null })
	assert.equal(res.status, 401)
	assert.deepEqual(fake.storeCalls, [])
})
