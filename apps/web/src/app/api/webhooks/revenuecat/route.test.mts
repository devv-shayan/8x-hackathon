// The RevenueCat webhook writes entitlement (`profiles.plan_type`), so it must
// refuse anything it cannot authenticate, and change nothing for a request it
// can. These tests drive the real route handler against fakes: every request
// the Supabase client makes (auth only, now) and every call into the database
// stores is recorded, so "nothing was written" is an assertion, not an
// assumption.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const SECRET = 'rc-webhook-test-secret'
const PURCHASED_AT = Date.UTC(2026, 8, 1)
const EXPIRES_AT = Date.UTC(2026, 9, 1)

// Read at import time by the modules under test, so set before importing them.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SECRET_KEY = 'fake-service-key'
process.env.PLAY_INGEST_KEY = 'fake-ingest-key'
process.env.PLATFORM_BASE_URL = 'http://platform.test'
// First-party analytics records only when a database is configured. Nothing
// connects to it: the stores are replaced below.
process.env.DATABASE_URL = 'postgresql://user:password@db.test:5432/app'

type Call = { method: string; url: URL; body: unknown }
let calls: Call[] = []

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const request = new Request(input, init)
	const url = new URL(request.url)
	const text = await request.text()
	calls.push({ method: request.method, url, body: text ? JSON.parse(text) : undefined })

	if (url.host === 'platform.test') return new Response(null, { status: 202 })
	if (url.pathname.startsWith('/auth/v1/admin/users/')) {
		return Response.json({ id: USER_ID, email: 'buyer@example.test', aud: 'authenticated' })
	}
	// Supabase is auth only now: anything else it is asked for is a regression.
	return Response.json({ error: `unexpected ${request.method} ${url.pathname}` }, { status: 500 })
}) as typeof fetch

const { POST } = await import('./route')

// The route reads and writes the database through the stores
// (src/server/db/): record their calls the same way.
const { profileStore } = await import('@/server/db/profiles')
const { analyticsStore } = await import('@/server/db/analytics')
type StoreCall = { method: string; args: unknown[] }
let stored: StoreCall[] = []
function fake<T extends object>(store: T, method: keyof T & string, result: unknown) {
	Object.assign(store, {
		[method]: async (...args: unknown[]) => {
			stored.push({ method, args })
			return result
		}
	})
}
fake(profileStore, 'applyEntitlement', 1)
fake(profileStore, 'regionOf', 'BR')
fake(profileStore, 'playEventProfile', {
	region: 'BR',
	locale: 'pt-BR',
	marketingConsent: true,
	planType: 'premium'
})
fake(analyticsStore, 'hasDuplicate', false)
fake(analyticsStore, 'insertEvent', undefined)

const writes = () =>
	calls.filter((call) => call.method !== 'GET' || call.url.host === 'platform.test')

function webhook(authorization?: string) {
	const headers = new Headers({ 'content-type': 'application/json' })
	if (authorization != null) headers.set('authorization', authorization)
	return new Request('http://web.test/api/webhooks/revenuecat', {
		method: 'POST',
		headers,
		body: JSON.stringify({
			event: {
				type: 'INITIAL_PURCHASE',
				app_user_id: USER_ID,
				environment: 'PRODUCTION',
				store: 'APP_STORE',
				period_type: 'NORMAL',
				product_id: 'premium_monthly',
				purchased_at_ms: PURCHASED_AT,
				expiration_at_ms: EXPIRES_AT,
				price_in_purchased_currency: 9.99,
				currency: 'USD'
			}
		})
	})
}

// The logger writes JSON lines to stdout; keep them out of the test output and
// let a test assert on them.
async function send(request: Request) {
	const lines: string[] = []
	const write = process.stdout.write
	process.stdout.write = ((chunk: string | Uint8Array) => {
		lines.push(String(chunk))
		return true
	}) as typeof process.stdout.write
	try {
		// The route only reads headers and the JSON body, which a plain Request has.
		const response = await POST(request as never)
		return { response, body: await response.json(), logs: lines.map((line) => JSON.parse(line)) }
	} finally {
		process.stdout.write = write
	}
}

beforeEach(() => {
	calls = []
	stored = []
	delete process.env.REVENUECAT_WEBHOOK_SECRET
})

test('no secret configured: refused with a 503, logged, and nothing is read or written', async () => {
	const request = webhook(`Bearer ${SECRET}`)
	const { response, body, logs } = await send(request)
	assert.equal(response.status, 503)
	assert.deepEqual(body, { error: 'RevenueCat webhook is not configured on this deployment' })
	assert.equal(request.bodyUsed, false, 'the event body must never be read')
	assert.deepEqual(calls, [])
	assert.deepEqual(stored, [])
	assert.equal(logs.length, 1)
	assert.equal(logs[0].level, 'error')
	assert.match(logs[0].message, /REVENUECAT_WEBHOOK_SECRET is not set/)
})

test('an empty or whitespace-only secret counts as no secret', async () => {
	for (const value of ['', '   ', '\n', '\t \n']) {
		process.env.REVENUECAT_WEBHOOK_SECRET = value
		const request = webhook('Bearer ')
		const { response } = await send(request)
		assert.equal(response.status, 503, JSON.stringify(value))
		assert.equal(request.bodyUsed, false)
	}
	assert.deepEqual(calls, [])
	assert.deepEqual(stored, [])
})

test('a secret pasted with surrounding whitespace still matches', async () => {
	process.env.REVENUECAT_WEBHOOK_SECRET = `  ${SECRET}\n`
	const { response } = await send(webhook(`Bearer ${SECRET}`))
	assert.equal(response.status, 200)
})

test('wrong secret of the same length: 401, and nothing is read or written', async () => {
	process.env.REVENUECAT_WEBHOOK_SECRET = SECRET
	const wrong = SECRET.replace(/.$/, (c) => (c === 'x' ? 'y' : 'x'))
	assert.equal(wrong.length, SECRET.length)
	const request = webhook(`Bearer ${wrong}`)
	const { response, body } = await send(request)
	assert.equal(response.status, 401)
	assert.deepEqual(body, { error: 'Unauthorized' })
	assert.equal(request.bodyUsed, false)
	assert.deepEqual(calls, [])
	assert.deepEqual(stored, [])
})

test('an Authorization header of a different length: 401, no throw, nothing written', async () => {
	process.env.REVENUECAT_WEBHOOK_SECRET = SECRET
	for (const header of [`Bearer ${SECRET}x`, 'Bearer short', `${SECRET}`, 'Bearer ']) {
		const request = webhook(header)
		const { response } = await send(request)
		assert.equal(response.status, 401, header)
		assert.equal(request.bodyUsed, false)
	}
	assert.deepEqual(calls, [])
	assert.deepEqual(stored, [])
})

test('no Authorization header: 401 and nothing written', async () => {
	process.env.REVENUECAT_WEBHOOK_SECRET = SECRET
	const request = webhook()
	const { response } = await send(request)
	assert.equal(response.status, 401)
	assert.equal(request.bodyUsed, false)
	assert.deepEqual(calls, [])
	assert.deepEqual(stored, [])
})

test('the right secret: processed exactly as before', async () => {
	process.env.REVENUECAT_WEBHOOK_SECRET = SECRET
	const { response, body } = await send(webhook(`Bearer ${SECRET}`))

	assert.equal(response.status, 200)
	assert.deepEqual(body, {
		ok: true,
		type: 'INITIAL_PURCHASE',
		app_user_id: USER_ID,
		status: 'active'
	})

	const [platform, ...rest] = writes()
	assert.deepEqual(rest, [])
	assert.deepEqual(
		stored.map((call) => call.method),
		['applyEntitlement', 'regionOf', 'insertEvent', 'playEventProfile']
	)
	const [entitlement, region, analytics, profile] = stored

	// Entitlement, on the right profile.
	assert.deepEqual(entitlement.args, [
		USER_ID,
		{
			planType: 'premium',
			premiumSource: 'purchase',
			premiumEnvironment: 'production',
			premiumStatus: 'active',
			premiumStore: 'app_store',
			premiumProduct: 'premium_monthly',
			premiumExpiresAt: new Date(EXPIRES_AT),
			premiumWillRenew: true,
			premiumStartedAt: new Date(PURCHASED_AT)
		}
	])

	// The first-party purchase event, with the buyer's stored market.
	assert.deepEqual(region.args, [USER_ID])
	assert.deepEqual(analytics.args, [
		{
			userId: USER_ID,
			name: 'purchase',
			path: null,
			metadata: {
				product_id: 'premium_monthly',
				store: 'app_store',
				price_cents: 999,
				currency: 'usd',
				country: 'BR'
			}
		}
	])
	assert.deepEqual(profile.args, [USER_ID])

	// The Play Events API, so the purchase email flow fires.
	assert.equal(platform.method, 'POST')
	assert.equal(platform.url.href, 'http://platform.test/api/ingest/v1/events')
	const envelope = platform.body as Record<string, unknown>
	assert.equal(envelope.event, 'subscription_started')
	assert.equal(envelope.event_id, `rc:${USER_ID}:INITIAL_PURCHASE:${EXPIRES_AT}`)
	assert.deepEqual(envelope.user, {
		id: USER_ID,
		email: 'buyer@example.test',
		plan: 'premium',
		country: 'BR',
		locale: 'pt-BR',
		marketing_consent: true
	})
	assert.deepEqual(envelope.properties, {
		plan: 'premium',
		product_id: 'premium_monthly',
		price_cents: 999,
		currency: 'usd',
		expires_at: new Date(EXPIRES_AT).toISOString(),
		access_until: new Date(EXPIRES_AT).toISOString()
	})
})
