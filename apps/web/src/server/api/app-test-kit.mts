// Shared by the /api/app/v1 route suites (not a suite itself): a fake Supabase behind
// globalThis.fetch that verifies one access token and hands storage requests to the test,
// recorded store calls, and requests shaped the way the app sends them.
//
// Import it before the route under test, and load the route with `await import()`: the
// Supabase and Play Events modules read their environment when they are first imported.
import { NextRequest, type NextResponse } from 'next/server'

export const USER = '00000000-0000-4000-8000-000000000001'
export const OTHER = '00000000-0000-4000-8000-000000000002'
export const TOKEN = 'good-access-token'
export const EMAIL = 'sam@example.test'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SECRET_KEY = 'fake-secret-key'
process.env.PLAY_INGEST_KEY = 'fake-ingest-key'
process.env.PLATFORM_BASE_URL = 'http://platform.test'
// First-party analytics records only when a database is configured. Nothing connects to it:
// the stores are faked.
process.env.DATABASE_URL = 'postgresql://user:password@db.test:5432/app'

export type FetchCall = { method: string; url: URL; headers: Headers; body: unknown }

/** What the fake answers besides the token check. Reset by `reset()`. */
export const fake: {
	/** The signed-in person's Supabase `user_metadata`. */
	userMetadata: Record<string, unknown>
	/** Every /storage/v1 request. Unset, storage answers a 500. */
	storage: ((call: FetchCall) => Response | Promise<Response>) | null
	fetchCalls: FetchCall[]
	storeCalls: { method: string; args: unknown[] }[]
} = { userMetadata: {}, storage: null, fetchCalls: [], storeCalls: [] }

export function reset() {
	fake.userMetadata = {}
	fake.storage = null
	fake.fetchCalls = []
	fake.storeCalls = []
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const request = new Request(input, init)
	const url = new URL(request.url)
	const text = await request.text()
	let body: unknown = text || undefined
	try {
		body = text ? JSON.parse(text) : undefined
	} catch {
		// not JSON: kept as text
	}
	const call = { method: request.method, url, headers: request.headers, body }
	fake.fetchCalls.push(call)

	if (url.host === 'platform.test') return new Response(null, { status: 202 })
	if (url.pathname === '/auth/v1/user') {
		if (request.headers.get('authorization') !== `Bearer ${TOKEN}`) {
			return Response.json(
				{ code: 403, error_code: 'bad_jwt', msg: 'invalid JWT' },
				{ status: 403 }
			)
		}
		return Response.json({
			id: USER,
			aud: 'authenticated',
			email: EMAIL,
			app_metadata: {},
			user_metadata: fake.userMetadata,
			created_at: '2026-09-01T00:00:00Z'
		})
	}
	if (url.pathname.startsWith('/storage/v1/') && fake.storage) return fake.storage(call)
	return Response.json({ error: `unexpected ${request.method} ${url.pathname}` }, { status: 500 })
}) as typeof fetch

/** Replaces `method` on a store with `impl`, recording each call in `fake.storeCalls`. */
export function fakeStore<T extends object>(
	store: T,
	method: keyof T & string,
	impl: (...args: never[]) => unknown
) {
	Object.assign(store, {
		[method]: async (...args: unknown[]) => {
			fake.storeCalls.push({ method, args })
			return (impl as (...args: unknown[]) => unknown)(...args)
		}
	})
}

type Route = (
	req: NextRequest,
	context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>

/**
 * Calls a route as the app would: the good token unless `token` says otherwise (null: no
 * Authorization header). Returns the parsed body and every log line the call wrote.
 */
export async function send(
	route: Route,
	path: string,
	{
		method = 'GET',
		token = TOKEN,
		body,
		params = {}
	}: {
		method?: string
		token?: string | null
		body?: unknown
		params?: Record<string, string>
	} = {}
) {
	const headers = new Headers()
	if (token !== null) headers.set('authorization', `Bearer ${token}`)
	if (body !== undefined) headers.set('content-type', 'application/json')
	const req = new NextRequest(`http://web.test${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
	})

	const lines: string[] = []
	const write = process.stdout.write
	const consoleError = console.error
	process.stdout.write = ((chunk: string | Uint8Array) => {
		lines.push(String(chunk))
		return true
	}) as typeof process.stdout.write
	// supabase-js prints some failures to stderr itself; that is not ours to test.
	console.error = () => {}
	try {
		const res = await route(req, { params: Promise.resolve(params) })
		return {
			status: res.status,
			headers: res.headers,
			body: await res.json(),
			logs: lines.map((line) => JSON.parse(line) as Record<string, unknown>)
		}
	} finally {
		process.stdout.write = write
		console.error = consoleError
	}
}
