// GET /api/app/v1/classes/{id}: one class, only the person's own. The store is faked and every
// call recorded, so "scoped by the verified user" is an assertion.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { classStore } = await import('@/server/db/classes')

const CLASS_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
	reset()
	fakeStore(classStore, 'find', () => null)
})

test("GET class: someone else's class, or none, is a 404, looked up as the caller", async () => {
	const res = await send(route.GET, `/api/app/v1/classes/${CLASS_ID}`, {
		params: { id: CLASS_ID }
	})
	assert.equal(res.status, 404)
	assert.deepEqual(fake.storeCalls[0]?.args, [USER, CLASS_ID])
})

test('GET class: no token is a 401, and no store is asked', async () => {
	const res = await send(route.GET, `/api/app/v1/classes/${CLASS_ID}`, {
		params: { id: CLASS_ID },
		token: null
	})
	assert.equal(res.status, 401)
	assert.deepEqual(fake.storeCalls, [])
})
