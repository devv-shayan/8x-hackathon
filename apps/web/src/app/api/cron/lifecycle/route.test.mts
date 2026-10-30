// The daily lifecycle sweep emits `subscription_expiring` and `user_inactive` to the Play
// Events API. A large play's run can outlast the function, so the route sends each batch of
// 500 as soon as it fills and stops itself before maxDuration, sending what it has. These
// tests drive the real handler against fakes: the profile store's two queries, Supabase
// Auth's admin lookup (the email), and the ingest endpoint, which records every batch.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const CRON_SECRET = 'cron-test-secret'

// Read at import time by the modules under test, so set before importing them.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SECRET_KEY = 'fake-service-key'
process.env.PLAY_INGEST_KEY = 'fake-ingest-key'
process.env.PLATFORM_BASE_URL = 'http://platform.test'
// Nothing connects to it: the store is replaced below.
process.env.DATABASE_URL = 'postgresql://user:password@db.test:5432/app'

type Envelope = { event: string; event_id: string; user: { id: string; email: string } }

let batches: Envelope[][] = []
let lookups = 0
let inFlight = 0
let maxInFlight = 0
/** Users Supabase Auth no longer has: the sweep skips them. */
let missing = new Set<string>()
/** Called with each looked-up user id before the lookup answers; may hold it. */
let onLookup: (id: string) => Promise<void> | void = () => {}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const request = new Request(input, init)
	const url = new URL(request.url)
	if (url.host === 'platform.test' && url.pathname === '/api/ingest/v1/events') {
		batches.push((await request.json()).events)
		return new Response(null, { status: 202 })
	}
	const match = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/)
	if (match) {
		const id = match[1]
		lookups++
		inFlight++
		maxInFlight = Math.max(maxInFlight, inFlight)
		try {
			await onLookup(id)
			await new Promise((resolve) => setImmediate(resolve))
		} finally {
			inFlight--
		}
		if (missing.has(id)) return Response.json({ msg: 'User not found' }, { status: 404 })
		return Response.json({ id, email: `${id}@example.test`, aud: 'authenticated' })
	}
	return Response.json({ error: `unexpected ${request.method} ${url.pathname}` }, { status: 500 })
}) as typeof fetch

const { GET, maxDuration } = await import('./route')
const { profileStore } = await import('@/server/db/profiles')

const userId = (kind: number, i: number) =>
	`00000000-0000-4000-800${kind}-${String(i).padStart(12, '0')}`

const expiringRows = (count: number) =>
	Array.from({ length: count }, (_, i) => ({
		id: userId(1, i),
		plan_type: 'premium',
		locale: 'en-US',
		region: 'US',
		marketing_consent: true,
		premium_expires_at: '2026-09-26T09:00:00+00:00',
		premium_product: 'premium_monthly'
	}))

const inactiveRows = (count: number) =>
	Array.from({ length: count }, (_, i) => ({
		id: userId(2, i),
		plan_type: null,
		locale: null,
		region: null,
		marketing_consent: false,
		last_seen_at: '2026-08-01T12:00:00+00:00'
	}))

let queried: string[] = []
function rows(expiring: unknown[], inactive: unknown[]) {
	Object.assign(profileStore, {
		expiringSubscriptions: async () => {
			queried.push('expiringSubscriptions')
			return expiring
		},
		inactiveSince: async () => {
			queried.push('inactiveSince')
			return inactive
		}
	})
}

// The logger writes JSON lines to stdout; keep them out of the output and return them.
// Anything else (the test runner's own output, while a test awaits) passes through.
async function run(authorization: string | null = `Bearer ${CRON_SECRET}`) {
	const logs: { level: string; message: string }[] = []
	const write = process.stdout.write
	process.stdout.write = ((chunk: string | Uint8Array, ...rest: never[]) => {
		const text = typeof chunk === 'string' ? chunk : ''
		if (text.startsWith('{"level"')) {
			logs.push(JSON.parse(text))
			return true
		}
		return write.call(process.stdout, chunk, ...rest)
	}) as typeof process.stdout.write
	try {
		const headers = new Headers()
		if (authorization != null) headers.set('authorization', authorization)
		// The route only reads the Authorization header, which a plain Request has.
		const request = new Request('http://web.test/api/cron/lifecycle', { headers })
		const response = await GET(request as never)
		return { response, body: await response.json(), logs }
	} finally {
		process.stdout.write = write
	}
}

const ids = (list: Envelope[]) => list.map((envelope) => envelope.user.id)
const rowIds = (list: { id: string }[]) => list.map((row) => row.id)

beforeEach(() => {
	batches = []
	queried = []
	lookups = 0
	inFlight = 0
	maxInFlight = 0
	missing = new Set()
	onLookup = () => {}
	process.env.CRON_SECRET = CRON_SECRET
})

test('without CRON_SECRET, or with the wrong bearer, nothing runs', async () => {
	rows(expiringRows(3), inactiveRows(3))
	delete process.env.CRON_SECRET
	assert.equal((await run()).response.status, 503)
	process.env.CRON_SECRET = CRON_SECRET
	assert.equal((await run('Bearer nope')).response.status, 401)
	assert.equal((await run(null)).response.status, 401)
	assert.deepEqual(queried, [])
	assert.equal(lookups, 0)
	assert.deepEqual(batches, [])
})

test('maxDuration is set for Vercel', () => {
	assert.equal(maxDuration, 300)
})

test('each batch of 500 goes as soon as it fills, in order, and the answer is as before', async () => {
	const expiring = expiringRows(700)
	const inactive = inactiveRows(450)
	// Every seventh expiring user is gone from Supabase Auth: no email, no event.
	for (const [i, row] of expiring.entries()) if (i % 7 === 0) missing.add(row.id)
	rows(expiring, inactive)

	const { response, body } = await run()

	const expected = [
		...expiring.filter((row) => !missing.has(row.id)).map((row) => row.id),
		...inactive.map((row) => row.id)
	]
	assert.equal(expected.length, 1050)
	assert.equal(response.status, 200)
	// Exactly the keys and values of a single send at the end: no `complete` on a full run.
	assert.deepEqual(Object.keys(body), ['ok', 'day', 'emitted', 'expiring', 'inactive'])
	assert.deepEqual(body, {
		ok: true,
		day: new Date().toISOString().slice(0, 10),
		emitted: 1050,
		expiring: 600,
		inactive: 450
	})
	// The same batches a single send at the end would have made.
	assert.deepEqual(
		batches.map((batch) => batch.length),
		[500, 500, 50]
	)
	assert.deepEqual(ids(batches.flat()), expected)
	assert.equal(batches.flat()[0].event, 'subscription_expiring')
	assert.equal(batches.flat().at(-1)?.event, 'user_inactive')
	assert.match(batches.flat()[1].event_id, /^expiring:.*:2026-09-26$/)
	// The email lookups ran ten at a time, not one by one.
	assert.equal(lookups, 1150)
	assert.equal(maxInFlight, 10)
})

test('a run cut short has already sent every batch it filled', async () => {
	const expiring = expiringRows(800)
	rows(expiring, [])
	// The lookup for user 650 never answers until released: the function killed mid-run.
	let reached!: () => void
	const stalled = new Promise<void>((resolve) => (reached = resolve))
	let release!: () => void
	const held = new Promise<void>((resolve) => (release = resolve))
	onLookup = (id) => {
		if (id !== expiring[650].id) return
		reached()
		return held
	}

	const pending = run()
	await stalled
	assert.deepEqual(
		batches.map((batch) => batch.length),
		[500]
	)
	assert.deepEqual(ids(batches[0]), rowIds(expiring.slice(0, 500)))

	release()
	const { body } = await pending
	assert.deepEqual(
		batches.map((batch) => batch.length),
		[500, 300]
	)
	assert.equal(body.emitted, 800)
})

test('near maxDuration it stops, sends what it has, and says the run is incomplete', async (t) => {
	t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 8, 24, 9) })
	const expiring = expiringRows(40)
	rows(expiring, inactiveRows(5))
	// The lookups for user 25 take the run past its deadline (maxDuration less 30 seconds).
	onLookup = (id) => {
		if (id === expiring[25].id) t.mock.timers.tick((maxDuration - 29) * 1000)
	}

	const { response, body, logs } = await run()

	assert.equal(response.status, 200)
	// Users 0 to 29 were looked up (three rounds of ten); the rest never were.
	assert.equal(lookups, 30)
	assert.deepEqual(body, {
		ok: true,
		day: '2026-09-24',
		emitted: 30,
		expiring: 30,
		inactive: 0,
		complete: false
	})
	assert.deepEqual(ids(batches.flat()), rowIds(expiring.slice(0, 30)))
	assert.deepEqual(queried, ['expiringSubscriptions'], 'the inactive sweep never starts')
	const warning = logs.find((line) => line.level === 'warn')
	assert.match(warning?.message ?? '', /stopped at its deadline/)
})

test('a query that fails answers 500, and the batches already sent stay sent', async () => {
	rows(expiringRows(620), [])
	Object.assign(profileStore, {
		inactiveSince: async () => {
			throw new Error('connection terminated')
		}
	})
	const { response, body, logs } = await run()
	assert.equal(response.status, 500)
	assert.deepEqual(body, { error: 'Lifecycle sweep failed' })
	// A single send at the end would have sent nothing; a re-run sends the rest, deduped.
	assert.deepEqual(
		batches.map((batch) => batch.length),
		[500]
	)
	assert.ok(logs.some((line) => line.level === 'error'))
})
