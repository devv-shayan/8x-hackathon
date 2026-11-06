// POST /api/lifecycle/session: its answer carries Server-Timing like the app routes do.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

const route = await import('./route')

test('without a token it is a 401, and still says where the time went', async () => {
	const res = await route.POST(
		new NextRequest('http://web.test/api/lifecycle/session', { method: 'POST' })
	)
	assert.equal(res.status, 401)
	assert.match(
		res.headers.get('server-timing') ?? '',
		/^auth;dur=0, db;dur=0;desc="0 calls, summed", ai;dur=0;desc="0 calls, summed", total;dur=[\d.]+$/
	)
})
