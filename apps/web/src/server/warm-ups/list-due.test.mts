// listDueWarmUps: who asks each due warm-up, found in one query for every video rather than
// one per gap. The stores are faked, and each call is recorded.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import type { DueGapRecord } from '@/server/db/warm-ups'

const { warmUpStore } = await import('@/server/db/warm-ups')
const { classStore } = await import('@/server/db/classes')
const { listDueWarmUps } = await import('./session')
const { ApiError } = await import('@/server/api/app-errors')

const USER = '00000000-0000-4000-8000-000000000001'
const VACCINES = '11111111-1111-4111-8111-111111111111'
const PLANTS = '22222222-2222-4222-8222-222222222222'

function gap(id: string, topicId: string, openWarmUp: DueGapRecord['openWarmUp'] = null) {
	return {
		id,
		topicId,
		topicTitle: topicId === VACCINES ? 'Vaccines' : 'Plants',
		concept: { title: `Idea ${id}`, quote: 'a line', startSeconds: 3 },
		openWarmUp
	} as DueGapRecord
}

let calls: string[] = []
let due: DueGapRecord[] = []
let remembered = new Map<string, string>()
let students = [{ id: 's1', userId: USER, name: 'Maya', persona: '', createdAt: new Date() }]

beforeEach(() => {
	calls = []
	remembered = new Map([[VACCINES, 'Omar']])
	students = [{ id: 's1', userId: USER, name: 'Maya', persona: '', createdAt: new Date() }]
	Object.assign(warmUpStore, {
		listDue: async () => due,
		rememberedStudents: async (_user: string, topicIds: string[]) => {
			calls.push(`rememberedStudents:${topicIds.length}`)
			return new Map([...remembered].filter(([id]) => topicIds.includes(id)))
		},
		rememberedStudent: async () => {
			calls.push('rememberedStudent')
			return null
		}
	})
	Object.assign(classStore, {
		studentsFor: async () => {
			calls.push('studentsFor')
			return students
		}
	})
})

test('three due gaps on two videos: one lookup for all, each named by its video', async () => {
	due = [gap('a', VACCINES), gap('b', VACCINES), gap('c', PLANTS)]
	const warmUps = await listDueWarmUps(USER)
	assert.deepEqual(
		warmUps.map(({ gap_id, student_name }) => [gap_id, student_name]),
		[
			['a', 'Omar'],
			['b', 'Omar'],
			['c', 'Maya']
		]
	)
	assert.deepEqual(calls, ['rememberedStudents:2', 'studentsFor'])
})

test('an open warm-up keeps its own student and needs no lookup', async () => {
	due = [gap('a', PLANTS, { id: 'w1', gapId: 'a', question: 'Why?', studentName: 'Omar' })]
	const [warmUp] = await listDueWarmUps(USER)
	assert.equal(warmUp?.student_name, 'Omar')
	assert.deepEqual(calls, [])
})

test('nothing due asks nothing', async () => {
	due = []
	assert.deepEqual(await listDueWarmUps(USER), [])
	assert.deepEqual(calls, [])
})

test('no student to ask is still an error, as before', async () => {
	due = [gap('c', PLANTS)]
	students = []
	await assert.rejects(listDueWarmUps(USER), (error) => error instanceof ApiError)
})
