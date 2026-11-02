// POST /api/app/v1/speech/questions: only the caller's own question is spoken, found by id. Groq
// and the store are faked, and every store call recorded, so "scoped by the verified user" is
// an assertion.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { speakQuestionResponse } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { speechDeps } = await import('@/server/speech/speech')
const realSpeak = speechDeps.speak

const CLASS_ID = '33333333-3333-4333-8333-333333333333'
const TURN_ID = '44444444-4444-4444-8444-444444444444'
const WARM_UP_ID = '55555555-5555-4555-8555-555555555555'
const PATH = '/api/app/v1/speech/questions'

/** 44 bytes of WAV header and two samples: what Orpheus would send back. */
const CLIP = new Uint8Array(
	Buffer.from('UklGRigAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQQAAAABAAIA', 'base64')
)

beforeEach(() => {
	reset()
	speechDeps.speak = async () => CLIP
	fakeStore(speechDeps.questions, 'forTurn', (_user: string, classId: string, turnId: string) =>
		classId === CLASS_ID && turnId === TURN_ID
			? { question: 'What changed for him?', studentName: 'Omar' }
			: null
	)
	fakeStore(speechDeps.questions, 'forWarmUp', () => null)
})

test('POST speak question: a class question comes back as audio, with who asks it', async () => {
	const res = await send(route.POST, PATH, {
		method: 'POST',
		body: { class_id: CLASS_ID, turn_id: TURN_ID }
	})
	assert.equal(res.status, 200)
	assert.ok(speakQuestionResponse.safeParse(res.body).success)
	assert.equal(res.body.student_name, 'Omar')
	assert.equal(res.body.audio_base64, Buffer.from(CLIP).toString('base64'))
	for (const call of fake.storeCalls) assert.equal(call.args[0], USER)
})

test("POST speak question: someone else's warm-up is a 404", async () => {
	const res = await send(route.POST, PATH, { method: 'POST', body: { warm_up_id: WARM_UP_ID } })
	assert.equal(res.status, 404)
})

test('POST speak question: text instead of ids is a 400, and nothing is looked up', async () => {
	const res = await send(route.POST, PATH, { method: 'POST', body: { text: 'Say this' } })
	assert.equal(res.status, 400)
	assert.deepEqual(fake.storeCalls, [])
})

test('POST speak question: no token is a 401, and no store is asked', async () => {
	const res = await send(route.POST, PATH, {
		method: 'POST',
		token: null,
		body: { class_id: CLASS_ID, turn_id: TURN_ID }
	})
	assert.equal(res.status, 401)
	assert.deepEqual(fake.storeCalls, [])
})

test('POST speak question: without a Groq key it answers 503 not_configured', async () => {
	speechDeps.speak = realSpeak
	const saved = process.env.GROQ_API_KEY
	delete process.env.GROQ_API_KEY
	try {
		const res = await send(route.POST, PATH, {
			method: 'POST',
			body: { class_id: CLASS_ID, turn_id: TURN_ID }
		})
		assert.equal(res.status, 503)
		assert.equal(res.body.error.code, 'not_configured')
	} finally {
		if (saved !== undefined) process.env.GROQ_API_KEY = saved
	}
})
