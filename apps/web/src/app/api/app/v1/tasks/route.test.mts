// GET and POST /api/app/v1/tasks: tasks on the person's own items only, with the database's
// names (in_progress, a date column) mapped to the contract's (in-progress, YYYY-MM-DD).
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { listTasksResponse, taskResponse } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const tasks = await import('./route')
const { taskStore } = await import('@/server/db/tasks')

const ITEM_ID = '11111111-1111-4111-8111-111111111111'
const TASK_ID = '33333333-3333-4333-8333-333333333333'

const row = {
	id: TASK_ID,
	itemId: ITEM_ID,
	title: 'Write the brief',
	state: 'in_progress' as const,
	priority: 'high' as const,
	dueDate: new Date('2026-10-01T00:00:00.000Z'),
	createdAt: new Date('2026-09-02T09:00:00.000Z'),
	updatedAt: new Date('2026-09-03T09:00:00.000Z')
}

const wire = {
	id: TASK_ID,
	item_id: ITEM_ID,
	title: 'Write the brief',
	state: 'in-progress',
	priority: 'high',
	due_date: '2026-10-01',
	created_at: '2026-09-02T09:00:00.000Z',
	updated_at: '2026-09-03T09:00:00.000Z'
}

beforeEach(() => {
	reset()
	fakeStore(taskStore, 'list', () => ({ rows: [row], nextAfter: null }))
	fakeStore(taskStore, 'create', () => ({ outcome: 'created', row }))
})

test("GET tasks: one item's tasks, mapped to the contract, for the verified person", async () => {
	const res = await send(tasks.GET, `/api/app/v1/tasks?item_id=${ITEM_ID}`)
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, { tasks: [wire], next_cursor: null })
	assert.ok(listTasksResponse.safeParse(res.body).success)
	assert.deepEqual(fake.storeCalls, [
		{ method: 'list', args: [USER, ITEM_ID, { limit: 100, after: undefined }] }
	])
})

test("GET tasks: no due date is null; an item that isn't the person's is a 404, not an empty list", async () => {
	fakeStore(taskStore, 'list', () => ({ rows: [{ ...row, dueDate: null }], nextAfter: null }))
	const undated = await send(tasks.GET, `/api/app/v1/tasks?item_id=${ITEM_ID}`)
	assert.equal(undated.body.tasks[0].due_date, null)

	fakeStore(taskStore, 'list', () => null)
	const res = await send(tasks.GET, `/api/app/v1/tasks?item_id=${ITEM_ID}`)
	assert.equal(res.status, 404)
	assert.equal(res.body.error.code, 'not_found')
})

test('GET tasks: item_id is required, and a cursor from another list is refused', async () => {
	const missing = await send(tasks.GET, '/api/app/v1/tasks')
	assert.equal(missing.status, 400)
	assert.deepEqual(
		missing.body.error.issues.map((issue: { path: string }) => issue.path),
		['item_id']
	)

	const itemsCursor = Buffer.from(JSON.stringify({ v: 1, list: 'items', id: TASK_ID })).toString(
		'base64url'
	)
	const wrong = await send(tasks.GET, `/api/app/v1/tasks?item_id=${ITEM_ID}&cursor=${itemsCursor}`)
	assert.equal(wrong.status, 400)
	assert.deepEqual(fake.storeCalls, [])
})

test("POST tasks: 201, with the contract's state and date turned into the database's", async () => {
	const res = await send(tasks.POST, '/api/app/v1/tasks', {
		method: 'POST',
		body: {
			id: TASK_ID,
			item_id: ITEM_ID,
			title: ' Write the brief ',
			state: 'in-progress',
			priority: 'high',
			due_date: '2026-10-01'
		}
	})
	assert.equal(res.status, 201)
	assert.deepEqual(res.body, { task: wire })
	assert.ok(taskResponse.safeParse(res.body).success)
	assert.deepEqual(fake.storeCalls, [
		{
			method: 'create',
			args: [
				USER,
				{
					id: TASK_ID,
					itemId: ITEM_ID,
					title: 'Write the brief',
					state: 'in_progress',
					priority: 'high',
					dueDate: new Date('2026-10-01T00:00:00.000Z')
				}
			]
		}
	])
})

test("POST tasks: defaults are the database's, and a null due date stays null", async () => {
	await send(tasks.POST, '/api/app/v1/tasks', {
		method: 'POST',
		body: { item_id: ITEM_ID, title: 'Plan', due_date: null }
	})
	assert.deepEqual(fake.storeCalls[0].args[1], {
		id: undefined,
		itemId: ITEM_ID,
		title: 'Plan',
		state: undefined,
		priority: undefined,
		dueDate: null
	})
})

test("POST tasks: another person's item is a 404; a taken id a 409; a retry a 200", async () => {
	fakeStore(taskStore, 'create', () => ({ outcome: 'item_not_found' }))
	const notTheirs = await send(tasks.POST, '/api/app/v1/tasks', {
		method: 'POST',
		body: { item_id: ITEM_ID, title: 'x' }
	})
	assert.equal(notTheirs.status, 404)

	fakeStore(taskStore, 'create', () => ({ outcome: 'conflict' }))
	const taken = await send(tasks.POST, '/api/app/v1/tasks', {
		method: 'POST',
		body: { id: TASK_ID, item_id: ITEM_ID, title: 'x' }
	})
	assert.equal(taken.status, 409)

	fakeStore(taskStore, 'create', () => ({ outcome: 'existing', row }))
	const retry = await send(tasks.POST, '/api/app/v1/tasks', {
		method: 'POST',
		body: { id: TASK_ID, item_id: ITEM_ID, title: 'x' }
	})
	assert.equal(retry.status, 200)
	assert.deepEqual(retry.body, { task: wire })
})

test('POST tasks: a bad date, state or extra field is a 400 and nothing is written', async () => {
	for (const body of [
		{ item_id: ITEM_ID, title: 'x', due_date: '2026-13-01' },
		{ item_id: ITEM_ID, title: 'x', due_date: '2026-10-01T00:00:00Z' },
		{ item_id: ITEM_ID, title: 'x', state: 'in_progress' },
		{ item_id: ITEM_ID, title: 'x', user_id: USER },
		{ title: 'x' }
	]) {
		const res = await send(tasks.POST, '/api/app/v1/tasks', { method: 'POST', body })
		assert.equal(res.status, 400, JSON.stringify(body))
	}
	assert.deepEqual(fake.storeCalls, [])
})
