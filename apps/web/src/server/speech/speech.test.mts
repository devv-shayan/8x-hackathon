// The speech helpers: reading and joining WAVs, cutting a long question for Orpheus, and the
// two speech jobs with Groq and the question store faked.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { joinWavs, readWav } from './wav'
import { splitForSpeech } from './split'
import { speakQuestion, transcribeRecording, type SpeechDeps } from './speech'

const USER = '00000000-0000-4000-8000-000000000001'
const ID = '0b6a7c1e-4f3d-4c2a-9e8b-1d2c3b4a5f60'

/** A 16-bit PCM WAV of `samples`, with an optional chunk before the data. */
function wav(samples: number[], sampleRate = 16_000, channels = 1, extra = false): Uint8Array {
	const data = new Uint8Array(samples.length * 2)
	const dataView = new DataView(data.buffer)
	samples.forEach((s, i) => dataView.setInt16(i * 2, s, true))
	const list = extra ? new Uint8Array([0x4c, 0x49, 0x53, 0x54, 2, 0, 0, 0, 0, 0]) : new Uint8Array()
	const out = new Uint8Array(44 + list.length + data.length)
	const v = new DataView(out.buffer)
	const put = (at: number, s: string) => [...s].forEach((c, i) => (out[at + i] = c.charCodeAt(0)))
	put(0, 'RIFF')
	v.setUint32(4, out.length - 8, true)
	put(8, 'WAVEfmt ')
	v.setUint32(16, 16, true)
	v.setUint16(20, 1, true)
	v.setUint16(22, channels, true)
	v.setUint32(24, sampleRate, true)
	v.setUint32(28, sampleRate * channels * 2, true)
	v.setUint16(32, channels * 2, true)
	v.setUint16(34, 16, true)
	out.set(list, 36)
	put(36 + list.length, 'data')
	v.setUint32(40 + list.length, data.length, true)
	out.set(data, 44 + list.length)
	return out
}

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

test('readWav: format, samples and length, past chunks it does not need', () => {
	const info = readWav(wav(new Array(16_000).fill(0), 16_000, 1, true))
	assert.ok(info)
	assert.equal(info.sampleRate, 16_000)
	assert.equal(info.channels, 1)
	assert.equal(info.dataLength, 32_000)
	assert.equal(info.seconds, 1)
	assert.equal(readWav(new TextEncoder().encode('not a wav at all, just some words here.')), null)
})

test('joinWavs: one WAV with every clip in order, and refuses mixed formats', () => {
	const joined = joinWavs([wav([1, 2]), wav([3], 16_000, 1, true)])
	const info = readWav(joined)
	assert.ok(info)
	const view = new DataView(joined.buffer, info.dataOffset)
	assert.deepEqual(
		[0, 1, 2].map((i) => view.getInt16(i * 2, true)),
		[1, 2, 3]
	)
	assert.throws(() => joinWavs([wav([1]), wav([1], 24_000)]))
})

test('splitForSpeech: whole sentences while they fit, then words, never over the limit', () => {
	assert.deepEqual(splitForSpeech('Short one.', 200), ['Short one.'])
	assert.deepEqual(splitForSpeech('One two. Three four. Five.', 12), [
		'One two.',
		'Three four.',
		'Five.'
	])
	const long = 'word '.repeat(60).trim()
	const pieces = splitForSpeech(long, 50)
	assert.ok(pieces.every((p) => p.length <= 50))
	assert.equal(pieces.join(' '), long)
	assert.deepEqual(splitForSpeech('   ', 200), [])
})

function deps(overrides: Partial<SpeechDeps> = {}) {
	const calls: unknown[][] = []
	const all: SpeechDeps = {
		transcribe: async (...args) => {
			calls.push(['transcribe', ...args])
			return 'what they said'
		},
		speak: async (...args) => {
			calls.push(['speak', ...args])
			return wav([7, 7])
		},
		questions: {
			forTurn: async (...args) => {
				calls.push(['forTurn', ...args])
				return { question: 'What changed for him?', studentName: 'Omar' }
			},
			forWarmUp: async (...args) => {
				calls.push(['forWarmUp', ...args])
				return null
			}
		},
		...overrides
	}
	return { all, calls }
}

test('transcribeRecording: a 16 kHz mono WAV goes to Groq with the prompt', async () => {
	const { all, calls } = deps()
	const text = await transcribeRecording(all, base64(wav([1, 2, 3])), '  so far  ')
	assert.equal(text, 'what they said')
	assert.equal(calls.length, 1)
	assert.equal(calls[0]![3], 'so far')
})

test('transcribeRecording: not a WAV, the wrong format, or over a minute is refused unsent', async () => {
	const { all, calls } = deps()
	const refused = async (audio: string) =>
		assert.rejects(transcribeRecording(all, audio, undefined), { code: 'invalid_request' })
	await refused(base64(new TextEncoder().encode('this is not audio of any kind at all.....')))
	await refused(base64(wav([1, 2], 44_100)))
	await refused(base64(wav([1, 2], 16_000, 2)))
	await refused(base64(wav(new Array(16_000 * 63).fill(0))))
	assert.equal(calls.length, 0)
})

test("transcribeRecording: a phone's m4a goes to Groq as m4a; something else in its place doesn't", async () => {
	const { all, calls } = deps()
	const m4a = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode('ftypM4A '), 0, 0, 0, 0])
	assert.equal(await transcribeRecording(all, base64(m4a), undefined, 'm4a'), 'what they said')
	assert.equal(calls[0]![4], 'm4a')
	await assert.rejects(transcribeRecording(all, base64(wav([1, 2])), undefined, 'm4a'), {
		code: 'invalid_request'
	})
	assert.equal(calls.length, 1)
})

test("speakQuestion: the caller's own question, in its student's voice", async () => {
	const { all, calls } = deps()
	const res = await speakQuestion(all, USER, { class_id: ID, turn_id: ID })
	assert.equal(res.student_name, 'Omar')
	assert.ok(readWav(new Uint8Array(Buffer.from(res.audio_base64, 'base64'))))
	assert.deepEqual(calls[0], ['forTurn', USER, ID, ID])
	assert.equal(calls[1]![3], 'daniel')
})

test('speakQuestion: a long question is spoken in pieces and joined into one WAV', async () => {
	const question = `${'This is a sentence about the video. '.repeat(8)}What changed?`
	const { all, calls } = deps({
		questions: {
			forTurn: async () => ({ question, studentName: 'Maya' }),
			forWarmUp: async () => null
		}
	})
	const res = await speakQuestion(all, USER, { class_id: ID, turn_id: ID })
	const spoken = calls.filter((c) => c[0] === 'speak')
	assert.ok(spoken.length >= 2)
	assert.ok(spoken.every((c) => String(c[2]).length <= 200 && c[3] === 'autumn'))
	const info = readWav(new Uint8Array(Buffer.from(res.audio_base64, 'base64')))
	assert.equal(info?.dataLength, spoken.length * 4)
})

test("speakQuestion: a question that isn't theirs is a 404, and nothing is spoken", async () => {
	const { all, calls } = deps()
	await assert.rejects(speakQuestion(all, USER, { warm_up_id: ID }), { code: 'not_found' })
	assert.deepEqual(
		calls.map((c) => c[0]),
		['forWarmUp']
	)
})
