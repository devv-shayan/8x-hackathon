// A busy Gemini is shown to the person as what was busy: reading a video, or the class.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.GEMINI_API_KEY = 'fake-gemini-key'

const { ApiError } = await import('@/server/api/app-errors')
const { AI_BUSY, toVideoError } = await import('./read-video')

const busy = Object.assign(new Error('overloaded'), { status: 503 })

test('a busy Gemini reading a video says reading videos is busy', () => {
	const error = toVideoError(busy)
	assert.ok(error instanceof ApiError)
	assert.equal(error.code, 'unavailable')
	assert.match(error.message, /^Reading videos is busy/)
})

test('a busy Gemini in a class or a warm-up says so without mentioning videos', () => {
	const error = toVideoError(busy, AI_BUSY)
	assert.ok(error instanceof ApiError)
	assert.equal(error.code, 'unavailable')
	assert.equal(error.message, AI_BUSY)
	assert.doesNotMatch(error.message, /video/i)
})

test('an error that is already for the person passes through', () => {
	const own = new ApiError('conflict', 'That question has already been answered.')
	assert.equal(toVideoError(own, AI_BUSY), own)
})
