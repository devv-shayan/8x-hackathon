// GET /api/app/v1/activity and GET /api/app/v1/notifications: the person's feed and inbox,
// newest first, a page at a time, in the contract's shape.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { listActivityResponse, listNotificationsResponse } from '@app/contract'
import { fake, fakeStore, OTHER, reset, send, USER } from '@/server/api/app-test-kit.mts'

const activity = await import('./route')
const notifications = await import('../notifications/route')
const { feedStore } = await import('@/server/db/feed')

const ITEM_ID = '11111111-1111-4111-8111-111111111111'
const ENTRY_ID = '44444444-4444-4444-8444-444444444444'
const NOTE_ID = '55555555-5555-4555-8555-555555555555'
const CREATED = new Date('2026-09-23T12:00:00.000Z')

beforeEach(() => {
	reset()
	fakeStore(feedStore, 'activity', () => ({
		rows: [
			{
				id: ENTRY_ID,
				itemId: ITEM_ID,
				kind: 'milestone',
				title: 'Shipped',
				detail: null,
				createdAt: CREATED
			}
		],
		nextAfter: ENTRY_ID
	}))
	fakeStore(feedStore, 'notifications', () => ({
		rows: [
			{
				id: NOTE_ID,
				title: 'Welcome',
				body: 'Hi',
				category: 'system',
				read: false,
				createdAt: CREATED
			}
		],
		nextAfter: null
	}))
})

test("GET activity: the verified person's latest 20 unless asked, with a next page", async () => {
	const res = await send(activity.GET, `/api/app/v1/activity?user_id=${OTHER}`)
	assert.equal(res.status, 200)
	assert.deepEqual(res.body.activity, [
		{
			id: ENTRY_ID,
			item_id: ITEM_ID,
			kind: 'milestone',
			title: 'Shipped',
			detail: null,
			created_at: '2026-09-23T12:00:00.000Z'
		}
	])
	assert.equal(typeof res.body.next_cursor, 'string')
	assert.ok(listActivityResponse.safeParse(res.body).success)
	assert.deepEqual(fake.storeCalls, [
		{ method: 'activity', args: [USER, { itemId: undefined, limit: 20, after: undefined }] }
	])

	await send(
		activity.GET,
		`/api/app/v1/activity?item_id=${ITEM_ID}&limit=5&cursor=${res.body.next_cursor}`
	)
	assert.deepEqual(fake.storeCalls[1].args, [USER, { itemId: ITEM_ID, limit: 5, after: ENTRY_ID }])
})

test('GET activity: an activity cursor is not a notifications cursor', async () => {
	const first = await send(activity.GET, '/api/app/v1/activity')
	const res = await send(
		notifications.GET,
		`/api/app/v1/notifications?cursor=${first.body.next_cursor}`
	)
	assert.equal(res.status, 400)
	assert.equal(fake.storeCalls.length, 1)
})

test("GET notifications: the verified person's latest 50 unless asked, last page null", async () => {
	const res = await send(notifications.GET, '/api/app/v1/notifications')
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, {
		notifications: [
			{
				id: NOTE_ID,
				title: 'Welcome',
				body: 'Hi',
				category: 'system',
				read: false,
				created_at: '2026-09-23T12:00:00.000Z'
			}
		],
		next_cursor: null
	})
	assert.ok(listNotificationsResponse.safeParse(res.body).success)
	assert.deepEqual(fake.storeCalls, [
		{ method: 'notifications', args: [USER, { limit: 50, after: undefined }] }
	])
})

test('both: 401 without a session, and the store is never asked', async () => {
	for (const route of [activity.GET, notifications.GET]) {
		const res = await send(route, '/api/app/v1/activity', { token: null })
		assert.equal(res.status, 401)
	}
	assert.deepEqual(fake.storeCalls, [])
})

test("both: a category or kind the contract doesn't know is a 500, never sent to the app", async () => {
	fakeStore(feedStore, 'notifications', () => ({
		rows: [
			{
				id: NOTE_ID,
				title: 'x',
				body: null,
				category: 'marketing',
				read: false,
				createdAt: CREATED
			}
		],
		nextAfter: null
	}))
	const res = await send(notifications.GET, '/api/app/v1/notifications')
	assert.equal(res.status, 500)
	assert.equal(res.logs.length, 1)
})
