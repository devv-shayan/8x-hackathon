// Account deletion from the app (Apple 5.1.1(v), Google Play), through both
// routes installed builds may call: DELETE /api/app/v1/account, and the older
// POST /api/delete-account with a Bearer token. Both end in
// server/account/delete-account.ts, and both must keep the same guarantees:
//
//  - the account deleted is the one the token belongs to, never an id or email
//    from the request
//  - no token, or one Supabase refuses: 401, and nothing is sent or deleted
//  - Supabase unreachable for the token check: 503, nothing sent or deleted
//  - a delete that fails is a 5xx, never a 200
//  - `account_deleted` goes to the platform BEFORE the delete, exactly once
//  - the person's uploads are removed AFTER the delete, and a storage failure
//    then is logged, never a failed deletion
//
// The real Supabase client and Play Events client run against a fake backend
// that records every request, in order.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

const USER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const GOOD = 'good-access-token'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SECRET_KEY = 'fake-secret-key'
process.env.PLAY_INGEST_KEY = 'fake-ingest-key'
process.env.PLATFORM_BASE_URL = 'http://platform.test'

type Call = {
	what: 'token check' | 'event' | 'delete' | 'list uploads' | 'remove uploads'
	detail: unknown
}
let calls: Call[] = []
let deleteFails = false
let storageFails = false
const AVATAR = '9f0c3a7e-1d2b-4c5d-8e6f-7a8b9c0d1e2f.jpg'

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const request = new Request(input, init)
	const url = new URL(request.url)
	if (url.host === 'platform.test') {
		calls.push({ what: 'event', detail: await request.json() })
		return new Response(null, { status: 202 })
	}
	if (url.pathname.startsWith('/auth/v1/admin/users/')) {
		calls.push({ what: 'delete', detail: url.pathname.split('/').pop() })
		return deleteFails
			? Response.json({ code: 500, msg: 'database error' }, { status: 500 })
			: Response.json({})
	}
	if (url.pathname === '/storage/v1/object/list/user-uploads') {
		calls.push({
			what: 'list uploads',
			detail: ((await request.json()) as { prefix: string }).prefix
		})
		return storageFails
			? Response.json({ statusCode: '500', error: 'internal', message: 'down' }, { status: 500 })
			: Response.json([{ name: AVATAR, id: 'f1' }])
	}
	if (url.pathname === '/storage/v1/object/user-uploads' && request.method === 'DELETE') {
		const { prefixes } = (await request.json()) as { prefixes: string[] }
		calls.push({ what: 'remove uploads', detail: prefixes })
		return Response.json(prefixes.map((name) => ({ name })))
	}
	if (url.pathname === '/auth/v1/user') {
		const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
		calls.push({ what: 'token check', detail: token })
		if (token === 'network-down') throw new TypeError('fetch failed')
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
	}
	throw new Error(`unexpected request: ${request.method} ${request.url}`)
}) as typeof fetch

const legacy = await import('../../app/api/delete-account/route')
const v1 = await import('../../app/api/app/v1/account/route')

type Route = {
	name: string
	/** `token` null: no usable token at all. */
	send: (token: string | null, body?: unknown) => Promise<Response>
	/** The exact bodies installed builds were built against. */
	deleted: unknown
	unauthorized: unknown
	unavailable: unknown
	failed: unknown
}

const routes: Route[] = [
	{
		name: 'POST /api/delete-account (Bearer)',
		send: (token, body) =>
			legacy.POST(
				new NextRequest('http://web.test/api/delete-account', {
					method: 'POST',
					// This route decides its path by the header: an empty Bearer is
					// still the app's path, and must not fall through to the others.
					headers: { authorization: `Bearer ${token ?? ''}`, 'content-type': 'application/json' },
					body: JSON.stringify(body ?? {})
				})
			),
		deleted: { ok: true, message: 'Your account has been deleted.' },
		unauthorized: { error: 'Unauthorized' },
		unavailable: { error: 'Could not verify your session. Try again.' },
		failed: { error: 'Your account could not be deleted. Try again.' }
	},
	{
		name: 'DELETE /api/app/v1/account',
		send: (token, body) =>
			v1.DELETE(
				new NextRequest('http://web.test/api/app/v1/account', {
					method: 'DELETE',
					headers: token == null ? {} : { authorization: `Bearer ${token}` },
					body: body === undefined ? undefined : JSON.stringify(body)
				}),
				{ params: Promise.resolve({}) }
			),
		deleted: { ok: true },
		unauthorized: {
			error: { code: 'unauthorized', message: 'Your session has expired. Sign in again.' }
		},
		unavailable: {
			error: {
				code: 'unavailable',
				message: "We couldn't check your session. Try again in a moment."
			}
		},
		failed: {
			error: { code: 'internal', message: 'Something went wrong on our side. Try again.' }
		}
	}
]

let logs: Record<string, unknown>[] = []

async function quietly<T>(fn: () => Promise<T>): Promise<T> {
	const write = process.stdout.write
	const consoleError = console.error
	process.stdout.write = ((chunk: string | Uint8Array) => {
		logs.push(JSON.parse(String(chunk)))
		return true
	}) as typeof process.stdout.write
	console.error = () => {}
	try {
		return await fn()
	} finally {
		process.stdout.write = write
		console.error = consoleError
	}
}

beforeEach(() => {
	calls = []
	logs = []
	deleteFails = false
	storageFails = false
})

for (const route of routes) {
	test(`${route.name}: a valid token deletes that person, event first, once`, async () => {
		const res = await route.send(GOOD)
		assert.equal(res.status, 200)
		assert.deepEqual(await res.json(), route.deleted)
		assert.deepEqual(
			calls.map((call) => call.what),
			['token check', 'event', 'delete', 'list uploads', 'remove uploads']
		)
		const event = calls[1]?.detail as Record<string, unknown>
		assert.equal(event.event, 'account_deleted')
		assert.equal(event.event_id, `deleted:${USER}`)
		assert.deepEqual(event.user, { id: USER, email: 'sam@example.test' })
		assert.deepEqual(event.properties, { reason: 'self_service' })
		assert.equal(calls[2]?.detail, USER)
		// Their own folder, and only it.
		assert.equal(calls[3]?.detail, `${USER}/avatar`)
		assert.deepEqual(calls[4]?.detail, [`${USER}/avatar/${AVATAR}`])
	})

	test(`${route.name}: an id or email in the body is ignored`, async () => {
		const res = await route.send(GOOD, { id: OTHER, user_id: OTHER, email: 'other@example.test' })
		assert.equal(res.status, 200)
		assert.equal(calls.find((call) => call.what === 'delete')?.detail, USER)
	})

	test(`${route.name}: no token: 401, and nothing is checked, sent or deleted`, async () => {
		const res = await route.send(null)
		assert.equal(res.status, 401)
		assert.deepEqual(await res.json(), route.unauthorized)
		assert.deepEqual(calls, [])
	})

	test(`${route.name}: a token Supabase refuses: 401, nothing sent or deleted`, async () => {
		const res = await route.send('expired-or-revoked')
		assert.equal(res.status, 401)
		assert.deepEqual(await res.json(), route.unauthorized)
		assert.deepEqual(
			calls.map((call) => call.what),
			['token check']
		)
	})

	test(`${route.name}: Supabase unreachable: 503, nothing sent or deleted`, async () => {
		const res = await quietly(() => route.send('network-down'))
		assert.equal(res.status, 503)
		assert.deepEqual(await res.json(), route.unavailable)
		assert.deepEqual(
			calls.map((call) => call.what),
			['token check']
		)
	})

	test(`${route.name}: a delete that fails is a 500, never a 200, and keeps their files`, async () => {
		deleteFails = true
		const res = await quietly(() => route.send(GOOD))
		assert.equal(res.status, 500)
		assert.deepEqual(await res.json(), route.failed)
		assert.ok(!calls.some((call) => call.what.endsWith('uploads')))
	})

	test(`${route.name}: storage failing after the delete is logged, and still a 200`, async () => {
		storageFails = true
		const res = await quietly(() => route.send(GOOD))
		assert.equal(res.status, 200)
		assert.deepEqual(await res.json(), route.deleted)
		const line = logs.find((entry) => String(entry.message).includes('uploads were not'))
		assert.equal(line?.folder, `${USER}/avatar`)
	})
}
