// GET /api/app/v1/progress: the dashboard's numbers, only the caller's, in the contract's shape.
// The stores are faked and every call recorded, so "scoped by the verified user" is an assertion.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getProgressResponse } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { topicStore } = await import('@/server/db/topics')
const { classStore } = await import('@/server/db/classes')
const { gapStore } = await import('@/server/db/gaps')

const STRONG = '33333333-3333-4333-8333-333333333333'
const WEAK = '44444444-4444-4444-8444-444444444444'
const UNTAUGHT = '55555555-5555-4555-8555-555555555555'
const DAY = new Date('2026-11-02T08:00:00.000Z')

const gap = (title: string, closedAt: Date | null, rightStreak: number, isRight?: boolean) => ({
	id: title,
	concept: { title, quote: 'q' },
	nextDueAt: DAY,
	closedAt,
	rightStreak,
	warmUps:
		isRight === undefined
			? []
			: [{ createdAt: DAY, studentName: 'Maya', question: 'q', answer: 'a', isRight }]
})

beforeEach(() => {
	reset()
	fakeStore(topicStore, 'listAll', () => [
		{ id: WEAK, youtubeId: 'weakvideo11', title: 'Weak' },
		{ id: UNTAUGHT, youtubeId: 'notyettaugh', title: 'Not yet taught' },
		{ id: STRONG, youtubeId: 'strongvideo', title: 'Strong' }
	])
	fakeStore(
		classStore,
		'latestFinishedForTopics',
		() =>
			new Map([
				[
					WEAK,
					{
						createdAt: DAY,
						conceptResults: [
							{ concept: 'Closed by warm-ups', result: 'missed' },
							{ concept: 'Marked not in video', result: 'missed' },
							{ concept: 'Taught in class', result: 'missed', resultAfterClass: 'correct' },
							{ concept: 'Still open', result: 'missed', resultAfterClass: 'missed' }
						]
					}
				],
				[STRONG, { createdAt: DAY, conceptResults: [{ concept: 'Easy', result: 'correct' }] }]
			])
	)
	fakeStore(
		gapStore,
		'listForTopics',
		() =>
			new Map([
				[
					WEAK,
					[
						gap('Closed by warm-ups', DAY, 2, true),
						gap('Marked not in video', DAY, 0),
						gap('Taught in class', null, 1, true),
						gap('Still open', null, 0, false)
					]
				]
			])
	)
})

test('GET counts each video, best first, leaving out videos with no finished class', async () => {
	const res = await send(route.GET, '/api/app/v1/progress')
	assert.equal(res.status, 200)
	assert.ok(getProgressResponse.safeParse(res.body).success)
	assert.ok(fake.storeCalls.every((call) => call.args[0] === USER))
	assert.deepEqual(res.body, {
		videos: [
			{
				id: STRONG,
				title: 'Strong',
				youtube_id: 'strongvideo',
				idea_count: 1,
				first_try: 1,
				taught: 1,
				learned: 0,
				open_gaps: 0,
				taught_at: DAY.toISOString()
			},
			{
				id: WEAK,
				title: 'Weak',
				youtube_id: 'weakvideo11',
				idea_count: 4,
				first_try: 0,
				// Closed by two right warm-ups, and taught by the end of class. "Not in the video" is not.
				taught: 2,
				learned: 1,
				open_gaps: 2,
				taught_at: DAY.toISOString()
			}
		],
		warm_ups: [true, true, false].map((is_right) => ({
			asked_at: DAY.toISOString(),
			student_name: 'Maya',
			is_right
		}))
	})
})

test('GET with nothing taught is an empty dashboard, not an error', async () => {
	fakeStore(topicStore, 'listAll', () => [])
	fakeStore(classStore, 'latestFinishedForTopics', () => new Map())
	fakeStore(gapStore, 'listForTopics', () => new Map())
	const res = await send(route.GET, '/api/app/v1/progress')
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, { videos: [], warm_ups: [] })
})

test('GET with no token is a 401, and no store is asked', async () => {
	const res = await send(route.GET, '/api/app/v1/progress', { token: null })
	assert.equal(res.status, 401)
	assert.equal(fake.storeCalls.length, 0)
})
