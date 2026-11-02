// POST /api/app/v1/speech/transcriptions: a recording becomes text, through Groq (faked here).
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { transcribeSpeechResponse } from '@app/contract'
import { reset, send } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { speechDeps } = await import('@/server/speech/speech')

const PATH = '/api/app/v1/speech/transcriptions'
/** A 16 kHz mono WAV holding two samples. */
const WAV = 'UklGRigAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQQAAAABAAIA'

let sent: { prompt?: string } | null = null

beforeEach(() => {
	reset()
	sent = null
	speechDeps.transcribe = async (_context, _wav, prompt) => {
		sent = { prompt }
		return 'He got more confident.'
	}
})

test('POST transcribe: a recording comes back as text, read on from the prompt', async () => {
	const res = await send(route.POST, PATH, {
		method: 'POST',
		body: { audio_base64: WAV, prompt: 'As his challenges got harder,' }
	})
	assert.equal(res.status, 200)
	assert.ok(transcribeSpeechResponse.safeParse(res.body).success)
	assert.equal(res.body.text, 'He got more confident.')
	assert.deepEqual(sent, { prompt: 'As his challenges got harder,' })
})

test("POST transcribe: something that isn't a WAV is a 400 and never reaches Groq", async () => {
	const res = await send(route.POST, PATH, {
		method: 'POST',
		body: { audio_base64: Buffer.from('not audio, just some text here').toString('base64') }
	})
	assert.equal(res.status, 400)
	assert.equal(sent, null)
})

test('POST transcribe: no token is a 401, and nothing is transcribed', async () => {
	const res = await send(route.POST, PATH, {
		method: 'POST',
		token: null,
		body: { audio_base64: WAV }
	})
	assert.equal(res.status, 401)
	assert.equal(sent, null)
})
