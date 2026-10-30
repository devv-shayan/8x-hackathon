// createAppRoute and requireUser: every /api/app/v1 route's auth, input and
// output guarantees. The real Supabase client runs against a fake Auth server
// (globalThis.fetch is replaced), so "Supabase was never asked" is observable.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import type { Endpoint } from '@app/contract'

const USER = '00000000-0000-4000-8000-000000000001'
const GOOD = 'good-access-token'

let authCalls: string[] = []

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const request = new Request(input, init)
	const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
	authCalls.push(token)
	if (token === 'network-down') throw new TypeError('fetch failed')
	if (token === 'gateway-down') return new Response('bad gateway', { status: 502 })
	if (token === GOOD) {
		return Response.json({
			id: USER,
			aud: 'authenticated',
			email: 'sam@example.test',
			app_metadata: {},
			user_metadata: {},
			created_at: '2026-09-01T00:00:00Z'
		})
	}
	return Response.json({ code: 403, error_code: 'bad_jwt', msg: 'invalid JWT' }, { status: 403 })
}) as typeof fetch

const { createAppRoute } = await import('./app-route')
const { ApiError } = await import('./app-errors')

const echo = {
	method: 'POST',
	path: '/api/app/v1/echo',
	auth: 'user',
	query: z.object({ n: z.coerce.number().int().optional() }),
	body: z.object({ name: z.string().min(1) }).strict(),
	response: z.object({ name: z.string(), user: z.string(), n: z.number().nullable() }),
	status: 201
} as const satisfies Endpoint

const publicPing = {
	method: 'GET',
	path: '/api/app/v1/ping',
	auth: 'public',
	response: z.object({ ok: z.literal(true) }),
	status: 200
} as const satisfies Endpoint

const withParam = {
	method: 'GET',
	path: '/api/app/v1/things/:id',
	auth: 'user',
	params: z.object({ id: z.uuid() }),
	response: z.object({ id: z.string() }),
	status: 200
} as const satisfies Endpoint

let handled = 0
const echoRoute = createAppRoute(echo, async ({ user, body, query }) => {
	handled++
	return { body: { name: body.name, user: user.id, n: query.n ?? null } }
})

function call(
	route: ReturnType<typeof createAppRoute>,
	{
		auth,
		body,
		query = '',
		params = {},
		method = 'POST'
	}: {
		auth?: string
		body?: string
		query?: string
		params?: Record<string, string>
		method?: string
	} = {}
) {
	const headers = new Headers({ 'content-type': 'application/json' })
	if (auth != null) headers.set('authorization', auth)
	const req = new NextRequest(`http://web.test/api/app/v1/echo${query}`, { method, headers, body })
	return route(req, { params: Promise.resolve(params) })
}

async function quietly<T>(
	fn: () => Promise<T>
): Promise<{ result: T; logs: Record<string, unknown>[] }> {
	const lines: string[] = []
	const write = process.stdout.write
	// supabase-js prints a failed fetch to stderr itself; that is not ours to test.
	const consoleError = console.error
	process.stdout.write = ((chunk: string | Uint8Array) => {
		lines.push(String(chunk))
		return true
	}) as typeof process.stdout.write
	console.error = () => {}
	try {
		const result = await fn()
		return { result, logs: lines.map((line) => JSON.parse(line)) }
	} finally {
		process.stdout.write = write
		console.error = consoleError
	}
}

beforeEach(() => {
	authCalls = []
	handled = 0
	process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
	process.env.SUPABASE_SECRET_KEY = 'fake-secret-key'
})

// First, while no Supabase client has been created and cached yet.
test('no Supabase credentials: 503 not_configured, handler never runs', async () => {
	delete process.env.NEXT_PUBLIC_SUPABASE_URL
	delete process.env.SUPABASE_URL
	delete process.env.SUPABASE_SECRET_KEY
	const { result: res } = await quietly(() =>
		call(echoRoute, { auth: `Bearer ${GOOD}`, body: '{"name":"a"}' })
	)
	assert.equal(res.status, 503)
	assert.equal((await res.json()).error.code, 'not_configured')
	assert.equal(handled, 0)
})

test('a valid token: the handler gets the verified user and the parsed input', async () => {
	const res = await call(echoRoute, {
		auth: `Bearer ${GOOD}`,
		body: '{"name":"Sam"}',
		query: '?n=3'
	})
	assert.equal(res.status, 201)
	assert.deepEqual(await res.json(), { name: 'Sam', user: USER, n: 3 })
	assert.equal(res.headers.get('cache-control'), 'private, no-store')
	assert.deepEqual(authCalls, [GOOD])
})

test('the bearer scheme is case-insensitive and the token trimmed', async () => {
	const res = await call(echoRoute, { auth: `bearer   ${GOOD}  `, body: '{"name":"Sam"}' })
	assert.equal(res.status, 201)
})

test('no token, another scheme, or an empty one: 401, and Supabase is never asked', async () => {
	for (const auth of [undefined, `Basic ${GOOD}`, 'Bearer', 'Bearer    ', GOOD]) {
		const res = await call(echoRoute, { auth, body: '{"name":"a"}' })
		assert.equal(res.status, 401, String(auth))
		assert.deepEqual(await res.json(), {
			error: { code: 'unauthorized', message: 'Your session has expired. Sign in again.' }
		})
	}
	assert.deepEqual(authCalls, [])
	assert.equal(handled, 0)
})

test('a token Supabase refuses (malformed, expired, revoked, user deleted): 401', async () => {
	const res = await call(echoRoute, { auth: 'Bearer expired-or-revoked', body: '{"name":"a"}' })
	assert.equal(res.status, 401)
	assert.equal(res.headers.get('cache-control'), 'private, no-store')
	assert.equal(handled, 0)
})

test('Supabase unreachable or failing: 503 unavailable, never 401', async () => {
	for (const token of ['network-down', 'gateway-down']) {
		const { result: res, logs } = await quietly(() =>
			call(echoRoute, { auth: `Bearer ${token}`, body: '{"name":"a"}' })
		)
		assert.equal(res.status, 503, token)
		assert.equal((await res.json()).error.code, 'unavailable')
		assert.equal(logs.length, 1)
	}
	assert.equal(handled, 0)
})

test('a body that is not JSON, or breaks the contract: 400 with the issues', async () => {
	const notJson = await call(echoRoute, { auth: `Bearer ${GOOD}`, body: 'name=Sam' })
	assert.equal(notJson.status, 400)
	assert.equal((await notJson.json()).error.message, 'Send a JSON body.')

	const extra = await call(echoRoute, {
		auth: `Bearer ${GOOD}`,
		body: '{"name":"a","plan_type":"premium"}'
	})
	assert.equal(extra.status, 400)
	const body = await extra.json()
	assert.equal(body.error.code, 'invalid_request')
	assert.ok(body.error.issues.length > 0)

	const badQuery = await call(echoRoute, {
		auth: `Bearer ${GOOD}`,
		body: '{"name":"a"}',
		query: '?n=x'
	})
	assert.equal(badQuery.status, 400)
	assert.equal((await badQuery.json()).error.issues[0].path, 'n')
	assert.equal(handled, 0)
})

test('a response that breaks the contract is a 500, never a partial 200', async () => {
	const broken = createAppRoute(echo, async () => ({
		body: { name: 'Sam', user: USER } as never
	}))
	const { result: res, logs } = await quietly(() =>
		call(broken, { auth: `Bearer ${GOOD}`, body: '{"name":"Sam"}' })
	)
	assert.equal(res.status, 500)
	assert.deepEqual(await res.json(), {
		error: { code: 'internal', message: 'Something went wrong on our side. Try again.' }
	})
	assert.equal(logs.length, 1)
	assert.match(String(logs[0]?.message), /failed its contract/)
})

test('an ApiError keeps its code and status; anything else is a generic 500', async () => {
	const gone = createAppRoute(echo, async () => {
		throw new ApiError('not_found', "That doesn't exist, or it isn't yours.")
	})
	const res = await call(gone, { auth: `Bearer ${GOOD}`, body: '{"name":"a"}' })
	assert.equal(res.status, 404)
	assert.equal((await res.json()).error.code, 'not_found')

	const boom = createAppRoute(echo, async () => {
		throw new Error('relation "items" does not exist')
	})
	const { result, logs } = await quietly(() =>
		call(boom, { auth: `Bearer ${GOOD}`, body: '{"name":"a"}' })
	)
	assert.equal(result.status, 500)
	const text = await result.text()
	assert.equal(text.includes('relation'), false, 'no internals in the body')
	assert.equal(logs.length, 1)
})

test('a public endpoint runs without auth and asks Supabase nothing', async () => {
	const ping = createAppRoute(publicPing, async () => ({
		body: { ok: true as const },
		headers: { 'Cache-Control': 'public, max-age=60' }
	}))
	const res = await call(ping, { method: 'GET' })
	assert.equal(res.status, 200)
	assert.equal(res.headers.get('cache-control'), 'public, max-age=60')
	assert.deepEqual(authCalls, [])
})

test('a path parameter that cannot be valid is a 404, like a row that is not yours', async () => {
	const thing = createAppRoute(withParam, async ({ params }) => ({ body: { id: params.id } }))
	const bad = await call(thing, { auth: `Bearer ${GOOD}`, method: 'GET', params: { id: 'nope' } })
	assert.equal(bad.status, 404)
	const id = '0b6a7c1e-4f3d-4c2a-9e8b-1d2c3b4a5f60'
	const ok = await call(thing, { auth: `Bearer ${GOOD}`, method: 'GET', params: { id } })
	assert.deepEqual(await ok.json(), { id })
})
