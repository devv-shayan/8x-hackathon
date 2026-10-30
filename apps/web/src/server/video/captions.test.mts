import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCaptions } from './captions'

const HEADER = 'WEBVTT\nKind: captions\nLanguage: en\n\n'

test('a line from rolling auto-generated captions counts once', () => {
	const vtt =
		HEADER +
		[
			"00:00:10.000 --> 00:00:11.870 align:start position:0%\n \nAll<00:00:10.120><c> right,</c><00:00:10.560><c> it's</c>",
			"00:00:11.870 --> 00:00:11.880 align:start position:0%\nAll right, it's\n ",
			"00:00:11.880 --> 00:00:14.390 align:start position:0%\nAll right, it's\ntime<00:00:12.040><c> to</c><00:00:12.480><c> start.</c>",
			'00:00:14.390 --> 00:00:14.400 align:start position:0%\ntime to start.\n '
		].join('\n\n')
	assert.deepEqual(parseCaptions(vtt), [
		{ startSeconds: 10, text: "All right, it's time to start." }
	])
})

test('a segment closes at a sentence end once it has run long enough', () => {
	const vtt = `${HEADER}00:00:00.000 --> 00:00:02.000
Short one.

00:00:06.000 --> 00:00:08.000
Plants need light.

00:00:09.000 --> 00:00:10.000
Roots take in water.
`
	assert.deepEqual(parseCaptions(vtt), [
		{ startSeconds: 0, text: 'Short one. Plants need light.' },
		{ startSeconds: 9, text: 'Roots take in water.' }
	])
})

test('captions with no punctuation still split into segments', () => {
	const cue = (seconds: number) =>
		`00:00:${String(seconds).padStart(2, '0')}.000 --> 00:00:${String(seconds + 1).padStart(2, '0')}.000\nword ${seconds}`
	const vtt = HEADER + [0, 10, 20, 30].map(cue).join('\n\n')
	assert.deepEqual(
		parseCaptions(vtt).map((segment) => segment.startSeconds),
		[0, 30]
	)
})

test('hours count, and sound labels, speaker marks and entities are cleaned up', () => {
	const vtt = `${HEADER}01:02:03.500 --> 01:02:05.000
&gt;&gt; Salt &amp; water [Music]

01:02:06.000 --> 01:02:07.000
[Applause]
`
	assert.deepEqual(parseCaptions(vtt), [{ startSeconds: 3723, text: 'Salt & water' }])
})

test('a file with no speech gives no segments', () => {
	assert.deepEqual(parseCaptions(HEADER), [])
	assert.deepEqual(parseCaptions(`${HEADER}00:00:01.000 --> 00:00:02.000\n[Music]\n`), [])
})
