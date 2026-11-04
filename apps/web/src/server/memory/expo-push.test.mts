import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readExpoReceipts, sendExpoPushes, type ExpoPushMessage } from './expo-push'

const message = (to: string): ExpoPushMessage => ({
	to,
	title: 'Herd immunity',
	sound: 'default',
	channelId: 'memory',
	data: { path: '/memory', gap_id: '44444444-4444-4444-8444-444444444444', stage: 'due' }
})

test('a ticket list maps accepted tokens and dead ones', () => {
	const receipts = readExpoReceipts(
		{
			data: [
				{ status: 'ok', id: '1' },
				{ status: 'error', details: { error: 'DeviceNotRegistered' } },
				{ status: 'error', details: { error: 'MessageRateExceeded' } }
			]
		},
		['ok-token', 'dead-token', 'later-token']
	)
	assert.deepEqual(receipts, { ok: ['ok-token'], dead: ['dead-token'] })
})

test('a send posts the bearer and the messages, then reads the tickets', async () => {
	let sent: { url: string; auth: string | null; body: unknown } | null = null
	const fetchImpl: typeof fetch = async (url, init) => {
		sent = {
			url: String(url),
			auth: new Headers(init?.headers).get('authorization'),
			body: JSON.parse(String(init?.body))
		}
		return new Response(JSON.stringify({ data: [{ status: 'ok', id: '1' }] }), { status: 200 })
	}
	const receipts = await sendExpoPushes([message('ExponentPushToken[one]')], {
		token: 'secret-token',
		fetchImpl
	})
	assert.deepEqual(receipts.ok, ['ExponentPushToken[one]'])
	assert.equal(sent?.url, 'https://exp.host/--/api/v2/push/send')
	assert.equal(sent?.auth, 'Bearer secret-token')
	assert.equal((sent?.body as ExpoPushMessage[])[0]?.title, 'Herd immunity')
})
