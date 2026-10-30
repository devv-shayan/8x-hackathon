import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AppError } from '@/lib/errors/app-error'
import { parseTimestamp, parseTranscript, parseYouTubeVideoId } from './transcript'

const ID = 'sQK3Yr4Sc_k'

function reply(segments: Array<{ start: string; text: string }>): string {
	return JSON.stringify({ segments })
}

function assertAppError(fn: () => unknown, code: string) {
	assert.throws(fn, (error: unknown) => error instanceof AppError && error.code === code)
}

test('parseYouTubeVideoId reads every link form we accept', () => {
	for (const link of [
		`https://www.youtube.com/watch?v=${ID}`,
		`https://youtube.com/watch?t=30&v=${ID}`,
		`https://m.youtube.com/watch?v=${ID}`,
		`https://youtu.be/${ID}?si=abc`,
		`https://www.youtube.com/embed/${ID}`,
		`https://www.youtube.com/shorts/${ID}`,
		`  https://www.youtube.com/live/${ID}  `
	]) {
		assert.equal(parseYouTubeVideoId(link), ID, link)
	}
})

test('parseYouTubeVideoId rejects anything that is not a video link', () => {
	for (const link of [
		'not a link',
		`https://vimeo.com/watch?v=${ID}`,
		`https://youtube.com.evil.example/watch?v=${ID}`,
		'https://www.youtube.com/watch?v=short',
		'https://www.youtube.com/watch',
		'https://www.youtube.com/@crashcourse'
	]) {
		assert.equal(parseYouTubeVideoId(link), null, link)
	}
})

test('parseTimestamp handles minutes and hours, and refuses the rest', () => {
	assert.equal(parseTimestamp('00:00'), 0)
	assert.equal(parseTimestamp('12:57'), 777)
	assert.equal(parseTimestamp('1:02:03'), 3723)
	for (const bad of ['', '12', 'abc', '1:2:3:4', '1:xx']) {
		assert.equal(parseTimestamp(bad), null, bad)
	}
})

test('parseTranscript converts timestamps to seconds and drops blank segments', () => {
	const raw = reply([
		{ start: '00:00', text: ' Photosynthesis! ' },
		{ start: '00:05', text: '   ' },
		{ start: '01:10', text: 'Plants need water.' }
	])
	assert.deepEqual(parseTranscript(raw), [
		{ startSeconds: 0, text: 'Photosynthesis!' },
		{ startSeconds: 70, text: 'Plants need water.' }
	])
})

test('parseTranscript tells the user when there is no speech or the video is too long', () => {
	assertAppError(() => parseTranscript(reply([])), 'video_no_speech')
	assertAppError(() => parseTranscript(reply([{ start: '00:10', text: ' ' }])), 'video_no_speech')
	assertAppError(
		() => parseTranscript(reply([{ start: '1:00:01', text: 'Still talking.' }])),
		'video_too_long'
	)
})

test('parseTranscript treats a malformed reply as a real failure, not a user error', () => {
	for (const raw of [undefined, 'not json', '{}', reply([{ start: 'soon', text: 'Hello' }])]) {
		assert.throws(
			() => parseTranscript(raw),
			(error: unknown) => !(error instanceof AppError)
		)
	}
})
