// The Play Stats roster's `plan` filter (GET /api/dashboard/v1/users). A plan the roster answers
// lists exactly that bucket; any other value is a 400, never the whole roster: returning
// everyone for a filter it cannot apply reads as data, not as a gap. These drive the real
// handler against a fake Play Stats store, which records the filter each request asked for.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const KEY = 'dashboard-test-key'

// Read at import time by the modules under test, so set before importing them.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SECRET_KEY = 'fake-service-key'
process.env.DASHBOARD_API_KEY = KEY
// Nothing connects to it: the store is replaced below.
process.env.DATABASE_URL = 'postgresql://user:password@db.test:5432/app'

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = new URL(new Request(input, init).url)
	const match = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/)
	if (match) return Response.json({ id: match[1], email: `${match[1]}@example.test` })
	return Response.json({ error: `unexpected ${url.pathname}` }, { status: 500 })
}) as typeof fetch

const { GET } = await import('./route')
const { playStatsStore } = await import('@/server/db/play-stats')
const { bucketFor, NON_PAYING_BUCKETS } = await import('@/lib/dashboard-stats')
const { NextRequest } = await import('next/server')

let filters: string[] = []
Object.assign(playStatsStore, {
	rosterPage: async (filter: string) => {
		filters.push(filter)
		return []
	},
	userIdsForEvent: async () => [],
	rosterByIds: async () => []
})

beforeEach(() => {
	filters = []
})

async function roster(query: string) {
	const response = await GET(
		new NextRequest(`http://web.test/api/dashboard/v1/users${query}`, {
			headers: { authorization: `Bearer ${KEY}` }
		})
	)
	return { status: response.status, body: await response.json() }
}

/** The plans a 400 says this play answers. */
async function answeredPlans(): Promise<string[]> {
	const { body } = await roster('?plan=unknown')
	return String(body.error)
		.replace(/^.*This play answers: /, '')
		.split(', ')
}

test('plan=test is a 400 that lists the plans the roster answers, and queries nothing', async () => {
	const { status, body } = await roster('?plan=test')
	assert.equal(status, 400)
	assert.equal(
		body.error,
		'Unknown plan "test". This play answers: free, granted, promo, sandbox, trial, premium'
	)
	assert.deepEqual(filters, [])
})

test('plan=test is a 400 alongside a stage, too', async () => {
	for (const stage of ['purchase', 'checkout']) {
		assert.equal((await roster(`?stage=${stage}&plan=test`)).status, 400)
	}
	assert.deepEqual(filters, [])
})

test('each plan the roster answers asks the store for its own filter', async () => {
	const expected: Record<string, string> = {
		free: 'free',
		granted: 'granted',
		promo: 'promo',
		sandbox: 'sandbox',
		trial: 'trial',
		premium: 'paying'
	}
	for (const [plan, filter] of Object.entries(expected)) {
		filters = []
		const { status } = await roster(`?plan=${plan}`)
		assert.equal(status, 200, plan)
		assert.deepEqual(filters, [filter], plan)
	}
	filters = []
	await roster('')
	assert.deepEqual(filters, ['all'])
})

test('stage=purchase lists paying accounts whatever the plan', async () => {
	await roster('?stage=purchase')
	await roster('?stage=purchase&plan=trial')
	assert.deepEqual(filters, ['paying', 'paying'])
})

test('the roster answers exactly the buckets bucketFor can put someone in', async () => {
	// Every combination of the columns bucketFor reads, including the NULLs a row can carry.
	const produced = new Set<string>()
	for (const plan_type of ['free', 'premium'])
		for (const premium_environment of [null, 'production', 'sandbox'])
			for (const premium_source of [null, 'purchase', 'promo', 'grant'])
				for (const premium_status of [null, 'active', 'trialing', 'past_due', 'expired'])
					produced.add(
						bucketFor({ plan_type, premium_environment, premium_source, premium_status })
					)

	const answered = await answeredPlans()
	assert.deepEqual([...produced].sort(), [...answered].sort())
	// A reserved bucket nobody can land in (the contract's `test`) is not a filter.
	for (const bucket of NON_PAYING_BUCKETS) {
		assert.equal(answered.includes(bucket), produced.has(bucket), bucket)
	}
})
