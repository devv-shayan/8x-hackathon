import NetInfo from '@react-native-community/netinfo'
import { api, ApiError, errorMessage, onSessionExpired, shouldRetry } from '@/lib/api'
import { env } from '@/lib/env'
import { log } from '@/lib/logger'

// lib/supabase.ts owns the session; each test says what it holds.
jest.mock('@/lib/supabase', () => ({
	isSupabaseEnabled: true,
	currentAccessToken: jest.fn(),
	refreshedAccessToken: jest.fn(),
	endRejectedSession: jest.fn()
}))
const mockSupabase = jest.requireMock('@/lib/supabase') as {
	isSupabaseEnabled: boolean
	currentAccessToken: jest.Mock
	refreshedAccessToken: jest.Mock
	endRejectedSession: jest.Mock
}
// The device's connection state, which tells "offline" from "the server didn't answer".
jest.mock('@react-native-community/netinfo', () => ({
	__esModule: true,
	default: { fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })) }
}))
jest.mock('@/lib/env', () => ({ env: {} }))
jest.mock('@/lib/logger', () => ({ log: { error: jest.fn(), warn: jest.fn() } }))
const mutableEnv = env as { EXPO_PUBLIC_SITE_URL?: string }

const SITE = 'https://play.example.com'
const ITEM_ID = '0b6f4a4e-6a57-4a8b-9c52-3a4f0f4d2b11'
const fetchMock = jest.fn()

function respond(status: number, body: unknown) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => {
			if (typeof body === 'string') throw new SyntaxError('Unexpected token <')
			return body
		}
	}
}

function item(overrides: Record<string, unknown> = {}) {
	return {
		id: ITEM_ID,
		name: 'Launch plan',
		owner: 'Avery',
		status: 'active',
		completion: 40,
		health: 90,
		active_users: 3,
		summary: null,
		created_at: '2026-09-20T10:00:00.000Z',
		updated_at: '2026-09-24T09:14:11.831Z',
		...overrides
	}
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
	try {
		await promise
	} catch (e) {
		expect(e).toBeInstanceOf(ApiError)
		return e as ApiError
	}
	throw new Error('the request resolved, but it should have thrown')
}

beforeEach(() => {
	mutableEnv.EXPO_PUBLIC_SITE_URL = SITE
	mockSupabase.isSupabaseEnabled = true
	mockSupabase.currentAccessToken.mockReset().mockResolvedValue({ token: 'token-1' })
	mockSupabase.refreshedAccessToken.mockReset().mockResolvedValue({ token: 'token-2' })
	mockSupabase.endRejectedSession.mockReset().mockResolvedValue(undefined)
	fetchMock.mockReset().mockResolvedValue(respond(200, { items: [item()], next_cursor: null }))
	global.fetch = fetchMock as unknown as typeof fetch
	jest.mocked(log.error).mockClear()
})

describe('requests', () => {
	it('calls the route with the session token and parses the response', async () => {
		const page = await api('listItems', { query: { limit: 20 } })
		expect(page.items[0].name).toBe('Launch plan')
		expect(page.next_cursor).toBeNull()
		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe(`${SITE}/api/app/v1/items?limit=20`)
		expect(init.method).toBe('GET')
		expect(init.headers.Authorization).toBe('Bearer token-1')
		expect(init.body).toBeUndefined()
	})

	it('fills path parameters and passes a cursor back verbatim', async () => {
		fetchMock.mockResolvedValue(respond(200, { item: item() }))
		await api('getItem', { params: { id: ITEM_ID } })
		expect(fetchMock.mock.calls[0][0]).toBe(`${SITE}/api/app/v1/items/${ITEM_ID}`)

		fetchMock.mockResolvedValue(respond(200, { items: [], next_cursor: null }))
		await api('listItems', { query: { cursor: 'abc+/=', limit: undefined } })
		expect(fetchMock.mock.calls[1][0]).toBe(`${SITE}/api/app/v1/items?cursor=abc%2B%2F%3D`)
	})

	it('tolerates a trailing slash on EXPO_PUBLIC_SITE_URL', async () => {
		mutableEnv.EXPO_PUBLIC_SITE_URL = `${SITE}/`
		await api('listItems')
		expect(fetchMock.mock.calls[0][0]).toBe(`${SITE}/api/app/v1/items`)
	})

	it('sends a JSON body, checked against the contract first', async () => {
		fetchMock.mockResolvedValue(
			respond(200, {
				profile: {
					id: ITEM_ID,
					email: 'a@example.com',
					display_name: 'Avery',
					avatar_url: null,
					plan: 'free',
					locale: null,
					marketing_consent: false,
					created_at: null
				}
			})
		)
		await api('updateProfile', { body: { display_name: '  Avery  ' } })
		const [, init] = fetchMock.mock.calls[0]
		expect(init.method).toBe('PATCH')
		expect(init.headers['Content-Type']).toBe('application/json')
		expect(JSON.parse(init.body)).toEqual({ display_name: 'Avery' })
	})

	it('refuses to send what the contract refuses, like a money column', async () => {
		const error = await rejection(api('updateProfile', { body: { plan_type: 'premium' } as never }))
		expect(error.code).toBe('invalid_request')
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('sends no token to a public route', async () => {
		fetchMock.mockResolvedValue(
			respond(200, {
				min_supported_version: { ios: null, android: null },
				store_url: { ios: null, android: null }
			})
		)
		await api('getConfig')
		expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
		expect(mockSupabase.currentAccessToken).not.toHaveBeenCalled()
	})
})

describe('not configured', () => {
	it('says so, without a request, when there is no site URL', async () => {
		delete mutableEnv.EXPO_PUBLIC_SITE_URL
		const error = await rejection(api('listItems'))
		expect(error.code).toBe('not_configured')
		expect(error.hint).toMatch(/EXPO_PUBLIC_SITE_URL/)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('says so for a signed-in route when Supabase is not set up', async () => {
		mockSupabase.isSupabaseEnabled = false
		const error = await rejection(api('getProfile'))
		expect(error.code).toBe('not_configured')
		expect(error.hint).toMatch(/EXPO_PUBLIC_SUPABASE_URL/)
		expect(fetchMock).not.toHaveBeenCalled()
	})
})

describe('failures are errors, never empty results', () => {
	it('carries the route’s code, message and issues', async () => {
		fetchMock.mockResolvedValue(
			respond(400, {
				error: {
					code: 'invalid_request',
					message: 'Some of what was sent is not valid.',
					issues: [{ path: 'limit', message: 'Too big' }]
				}
			})
		)
		const error = await rejection(api('listItems'))
		expect(error).toMatchObject({ code: 'invalid_request', status: 400 })
		expect(error.message).toBe('Some of what was sent is not valid.')
		expect(error.issues).toEqual([{ path: 'limit', message: 'Too big' }])
	})

	it('keeps a code it does not know, and its status', async () => {
		fetchMock.mockResolvedValue(
			respond(429, { error: { code: 'rate_limited', message: 'Slow down.' } })
		)
		const error = await rejection(api('listItems'))
		expect(error).toMatchObject({ code: 'rate_limited', status: 429, message: 'Slow down.' })
	})

	it.each([
		[404, 'not_found'],
		[500, 'internal'],
		[502, 'internal'],
		[503, 'unavailable']
	])('reads a %i that is not the v1 error shape by its status', async (status, code) => {
		fetchMock.mockResolvedValue(respond(status, '<html>Bad gateway</html>'))
		expect((await rejection(api('listItems'))).code).toBe(code)
	})

	it('rejects a success that breaks the contract, and reports it', async () => {
		fetchMock.mockResolvedValue(respond(200, { items: [item({ status: 'deleted' })] }))
		const error = await rejection(api('listItems'))
		expect(error.code).toBe('invalid_response')
		expect(log.error).toHaveBeenCalledTimes(1)
	})

	it('rejects a success that is not JSON (a wrong site URL answering with a page)', async () => {
		fetchMock.mockResolvedValue(respond(200, '<!doctype html>'))
		expect((await rejection(api('listItems'))).code).toBe('invalid_response')
	})

	it('is offline at once when the request never leaves the phone', async () => {
		jest
			.mocked(NetInfo.fetch)
			.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false } as never)
		fetchMock.mockRejectedValue(new TypeError('Network request failed'))
		const error = await rejection(api('listItems'))
		expect(error.code).toBe('offline')
		expect(errorMessage(error)).toMatch(/offline/)
	})

	it('is unreachable, not offline, when the phone is online but the server did not answer', async () => {
		fetchMock.mockRejectedValue(new TypeError('Network request failed'))
		const error = await rejection(api('listItems'))
		expect(error.code).toBe('unreachable')
		expect(errorMessage(error)).toMatch(/couldn't reach our server/)
	})

	it('gives up after its timeout', async () => {
		jest.useFakeTimers()
		try {
			fetchMock.mockImplementation(
				(_url: string, init: { signal: AbortSignal }) =>
					new Promise((_resolve, reject) => {
						init.signal.addEventListener('abort', () =>
							reject(new DOMException('Aborted', 'AbortError'))
						)
					})
			)
			const pending = rejection(api('listItems', { timeoutMs: 5_000 }))
			await jest.advanceTimersByTimeAsync(5_000)
			expect((await pending).code).toBe('timeout')
		} finally {
			jest.useRealTimers()
		}
	})

	it('is cancelled, not timed out, when TanStack Query cancels it', async () => {
		const controller = new AbortController()
		fetchMock.mockImplementation(
			(_url: string, init: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					init.signal.addEventListener('abort', () =>
						reject(new DOMException('Aborted', 'AbortError'))
					)
				})
		)
		const pending = rejection(api('listItems', { signal: controller.signal }))
		controller.abort()
		expect((await pending).code).toBe('cancelled')
	})
})

describe('the session', () => {
	it('is signed_out, without a request, when this device has no session', async () => {
		mockSupabase.currentAccessToken.mockResolvedValue({ failure: 'signed_out' })
		expect((await rejection(api('listItems'))).code).toBe('signed_out')
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('is offline, not signed out, when the token could not be refreshed offline', async () => {
		mockSupabase.currentAccessToken.mockResolvedValue({ failure: 'offline' })
		expect((await rejection(api('listItems'))).code).toBe('offline')
		expect(mockSupabase.endRejectedSession).not.toHaveBeenCalled()
	})

	it('refreshes once and retries once after a 401', async () => {
		fetchMock
			.mockResolvedValueOnce(respond(401, { error: { code: 'unauthorized', message: 'Expired' } }))
			.mockResolvedValueOnce(respond(200, { items: [], next_cursor: null }))
		await api('listItems')
		expect(fetchMock).toHaveBeenCalledTimes(2)
		expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-2')
		expect(mockSupabase.endRejectedSession).not.toHaveBeenCalled()
	})

	it('signs out, and says so once, when the server refuses the session for good', async () => {
		const expired = jest.fn()
		const unsubscribe = onSessionExpired(expired)
		try {
			fetchMock.mockResolvedValue(
				respond(401, { error: { code: 'unauthorized', message: 'Expired' } })
			)
			mockSupabase.refreshedAccessToken.mockResolvedValue({ failure: 'signed_out' })
			const errors = await Promise.all([
				rejection(api('listItems')),
				rejection(api('listNotifications')),
				rejection(api('getProfile'))
			])
			expect(errors.map((e) => e.code)).toEqual(['unauthorized', 'unauthorized', 'unauthorized'])
			expect(mockSupabase.endRejectedSession).toHaveBeenCalledTimes(1)
			expect(expired).toHaveBeenCalledTimes(1)
		} finally {
			unsubscribe()
		}
	})

	it('never reads a 503 (the server could not check the token) as signed out', async () => {
		fetchMock.mockResolvedValue(
			respond(503, { error: { code: 'unavailable', message: "We couldn't check your session." } })
		)
		expect((await rejection(api('listItems'))).code).toBe('unavailable')
		expect(mockSupabase.refreshedAccessToken).not.toHaveBeenCalled()
		expect(mockSupabase.endRejectedSession).not.toHaveBeenCalled()
	})
})

describe('shouldRetry', () => {
	const error = (code: string, status: number | null = null) => new ApiError(code, 'x', { status })

	it('retries a timeout, an unreachable server and its own failures, twice at most', () => {
		expect(shouldRetry(0, error('timeout'))).toBe(true)
		expect(shouldRetry(0, error('unreachable'))).toBe(true)
		expect(shouldRetry(0, error('internal', 500))).toBe(true)
		expect(shouldRetry(1, error('unavailable', 503))).toBe(true)
		expect(shouldRetry(2, error('internal', 500))).toBe(false)
	})

	it('does not retry what a second try cannot fix', () => {
		expect(shouldRetry(0, error('offline'))).toBe(false)
		expect(shouldRetry(0, error('not_found', 404))).toBe(false)
		expect(shouldRetry(0, error('unauthorized', 401))).toBe(false)
		expect(shouldRetry(0, error('invalid_response', 200))).toBe(false)
		expect(shouldRetry(0, error('not_configured', 503))).toBe(false)
		expect(shouldRetry(0, new Error('not an ApiError'))).toBe(false)
	})
})
