// The Groq wrapper: what it sends, and how each kind of failure reaches the person.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { speak, transcribe } from './groq'

const CONTEXT = { feature: 'test' }
const realFetch = globalThis.fetch
let requests: { url: string; init: RequestInit }[] = []

function answer(response: Response) {
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		requests.push({ url, init })
		return response
	}) as typeof fetch
}

beforeEach(() => {
	requests = []
	process.env.GROQ_API_KEY = 'test-key'
})

afterEach(() => {
	globalThis.fetch = realFetch
	delete process.env.GROQ_API_KEY
})

test('transcribe: posts the WAV to Whisper in English, with the prompt, and trims the text', async () => {
	answer(Response.json({ text: '  He got more confident.  ' }))
	const text = await transcribe(CONTEXT, new Uint8Array([1, 2, 3]), 'So far')
	assert.equal(text, 'He got more confident.')
	assert.match(requests[0]!.url, /\/audio\/transcriptions$/)
	const form = requests[0]!.init.body as FormData
	assert.equal(form.get('model'), 'whisper-large-v3-turbo')
	assert.equal(form.get('language'), 'en')
	assert.equal(form.get('prompt'), 'So far')
	assert.equal(new Headers(requests[0]!.init.headers).get('authorization'), 'Bearer test-key')
})

test('speak: asks Orpheus for WAV in the given voice and returns the bytes', async () => {
	answer(new Response(new Uint8Array([9, 8, 7])))
	const audio = await speak(CONTEXT, 'What changed?', 'daniel')
	assert.deepEqual([...audio], [9, 8, 7])
	assert.deepEqual(JSON.parse(String(requests[0]!.init.body)), {
		model: 'canopylabs/orpheus-v1-english',
		input: 'What changed?',
		voice: 'daniel',
		response_format: 'wav'
	})
})

test('a busy Groq (429 or 5xx) is unavailable: worth another try', async () => {
	for (const status of [429, 503]) {
		answer(new Response('slow down', { status }))
		await assert.rejects(speak(CONTEXT, 'Hi', 'autumn'), { code: 'unavailable' })
	}
})

test('any other refusal is internal, and its detail stays out of the message', async () => {
	answer(new Response('invalid api key sk-123', { status: 401 }))
	await assert.rejects(transcribe(CONTEXT, new Uint8Array([1])), (error: Error) => {
		assert.equal((error as Error & { code: string }).code, 'internal')
		assert.doesNotMatch(error.message, /sk-123/)
		return true
	})
})

test('no key is not_configured, and nothing is sent', async () => {
	delete process.env.GROQ_API_KEY
	answer(Response.json({ text: 'x' }))
	await assert.rejects(transcribe(CONTEXT, new Uint8Array([1])), { code: 'not_configured' })
	assert.equal(requests.length, 0)
})
