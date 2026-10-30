// GET and POST /api/app/v1/items, and GET items/{id}: the person's own items, never
// another's, in the contract's shape. The stores are faked and every call recorded, so
// "scoped by the verified user" and "nothing was written" are assertions.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { itemResponse, listItemsResponse } from '@app/contract'
import { fake, fakeStore, OTHER, reset, send, USER } from '@/server/api/app-test-kit.mts'

const items = await import('./route')
const one = await import('./[id]/route')
const { itemStore } = await import('@/server/db/items')

const ITEM_ID = '11111111-1111-4111-8111-111111111111'
const NEXT_ID = '22222222-2222-4222-8222-222222222222'

const row = {
	id: ITEM_ID,
	name: 'Launch plan',
	owner: 'Sam',
	status: 'active' as const,
	completion: 40,
	health: 90,
	activeUsers: 3,
	summary: null,
	createdAt: new Date('2026-09-01T10:00:00.000Z'),
	updatedAt: new Date('2026-09-20T08:30:00.250Z')
}

const wire = {
	id: ITEM_ID,
	name: 'Launch plan',
	owner: 'Sam',
	status: 'active',
	completion: 40,
	health: 90,
	active_users: 3,
	summary: null,
	created_at: '2026-09-01T10:00:00.000Z',
	updated_at: '2026-09-20T08:30:00.250Z'
}

beforeEach(() => {
	reset()
	fakeStore(itemStore, 'list', () => ({ rows: [row], nextAfter: null }))
	fakeStore(itemStore, 'get', () => row)
	fakeStore(itemStore, 'create', () => ({ outcome: 'created', row }))
})

test("GET items: the verified person's page, in the contract's shape, never cached", async () => {
	const res = await send(items.GET, '/api/app/v1/items?user_id=' + OTHER)
	assert.equal(res.status, 200)
	assert.equal(res.headers.get('cache-control'), 'private, no-store')
	assert.deepEqual(res.body, { items: [wire], next_cursor: null })
	assert.ok(listItemsResponse.safeParse(res.body).success)
	// A user id in the query string is ignored: the token decides.
	assert.deepEqual(fake.storeCalls, [
		{ method: 'list', args: [USER, { limit: 50, after: undefined }] }
	])
})

test('GET items: no token or a refused one is a 401, and the store is never asked', async () => {
	for (const token of [null, 'expired']) {
		const res = await send(items.GET, '/api/app/v1/items', { token })
		assert.equal(res.status, 401)
		assert.equal(res.body.error.code, 'unauthorized')
	}
	assert.deepEqual(fake.storeCalls, [])
})

test('GET items: next_cursor is opaque, and sending it back continues after that row', async () => {
	fakeStore(itemStore, 'list', () => ({ rows: [row], nextAfter: NEXT_ID }))
	const first = await send(items.GET, '/api/app/v1/items?limit=1')
	assert.equal(first.status, 200)
	const cursor = first.body.next_cursor
	assert.equal(typeof cursor, 'string')
	assert.ok(!cursor.includes(NEXT_ID), 'the cursor does not expose the row id as is')

	await send(items.GET, `/api/app/v1/items?limit=1&cursor=${encodeURIComponent(cursor)}`)
	assert.deepEqual(fake.storeCalls[1].args, [USER, { limit: 1, after: NEXT_ID }])
})

test('GET items: a bad limit or cursor is a 400 naming it, and the store is never asked', async () => {
	const otherList = Buffer.from(
		JSON.stringify({ v: 1, list: 'notifications', id: NEXT_ID })
	).toString('base64url')
	for (const [query, field] of [
		['limit=0', 'limit'],
		['limit=101', 'limit'],
		['limit=ten', 'limit'],
		['cursor=not-a-cursor', 'cursor'],
		[`cursor=${otherList}`, 'cursor']
	]) {
		const res = await send(items.GET, `/api/app/v1/items?${query}`)
		assert.equal(res.status, 400, query)
		assert.equal(res.body.error.code, 'invalid_request')
		assert.deepEqual(
			res.body.error.issues.map((issue: { path: string }) => issue.path),
			[field],
			query
		)
	}
	assert.deepEqual(fake.storeCalls, [])
})

test('GET items: a row that breaks the contract is a 500, never a partial 200', async () => {
	fakeStore(itemStore, 'list', () => ({ rows: [{ ...row, completion: 140 }], nextAfter: null }))
	const res = await send(items.GET, '/api/app/v1/items')
	assert.equal(res.status, 500)
	assert.equal(res.body.error.code, 'internal')
	assert.equal(res.logs.length, 1)
})

test("GET items/{id}: the person's item, or one 404 for anyone else's, deleted or unknown", async () => {
	const found = await send(one.GET, `/api/app/v1/items/${ITEM_ID}`, { params: { id: ITEM_ID } })
	assert.equal(found.status, 200)
	assert.deepEqual(found.body, { item: wire })
	assert.ok(itemResponse.safeParse(found.body).success)
	assert.deepEqual(fake.storeCalls, [{ method: 'get', args: [USER, ITEM_ID] }])

	fakeStore(itemStore, 'get', () => null)
	const missing = await send(one.GET, `/api/app/v1/items/${NEXT_ID}`, { params: { id: NEXT_ID } })
	assert.equal(missing.status, 404)
	assert.equal(missing.body.error.code, 'not_found')

	// An id that can't exist is the same 404, without a query.
	reset()
	const junk = await send(one.GET, '/api/app/v1/items/42', { params: { id: '42' } })
	assert.equal(junk.status, 404)
	assert.deepEqual(fake.storeCalls, [])
})

test('POST items: 201 with the new item, owned by the verified person', async () => {
	const res = await send(items.POST, '/api/app/v1/items', {
		method: 'POST',
		body: { id: ITEM_ID, name: '  Launch plan  ', owner: 'Sam', status: 'active' }
	})
	assert.equal(res.status, 201)
	assert.deepEqual(res.body, { item: wire })
	assert.deepEqual(fake.storeCalls, [
		{
			method: 'create',
			args: [
				USER,
				{ id: ITEM_ID, name: 'Launch plan', owner: 'Sam', summary: undefined, status: 'active' }
			]
		}
	])
})

test("POST items: a retry with the same id is a 200 with the same item; another's id a 409", async () => {
	fakeStore(itemStore, 'create', () => ({ outcome: 'existing', row }))
	const retry = await send(items.POST, '/api/app/v1/items', {
		method: 'POST',
		body: { id: ITEM_ID, name: 'Launch plan' }
	})
	assert.equal(retry.status, 200)
	assert.deepEqual(retry.body, { item: wire })

	fakeStore(itemStore, 'create', () => ({ outcome: 'conflict' }))
	const taken = await send(items.POST, '/api/app/v1/items', {
		method: 'POST',
		body: { id: ITEM_ID, name: 'Launch plan' }
	})
	assert.equal(taken.status, 409)
	assert.deepEqual(Object.keys(taken.body), ['error'])
	assert.equal(taken.body.error.code, 'conflict')
})

test('POST items: an unknown field (an owner id, a user id) or a blank name is a 400, nothing written', async () => {
	for (const body of [
		{ name: 'x', user_id: OTHER },
		{ name: 'x', completion: 100 },
		{ name: '   ' },
		{ name: 'x', status: 'deleted' },
		{ id: 'not-a-uuid', name: 'x' }
	]) {
		const res = await send(items.POST, '/api/app/v1/items', { method: 'POST', body })
		assert.equal(res.status, 400, JSON.stringify(body))
		assert.equal(res.body.error.code, 'invalid_request')
	}
	assert.deepEqual(fake.storeCalls, [])
})
