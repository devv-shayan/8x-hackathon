import { AccountDeletionError, deleteAccount } from '@/lib/account'
import { env } from '@/lib/env'
import { currentAccessToken, endRejectedSession, refreshedAccessToken } from '@/lib/supabase'

// The session is lib/supabase.ts's; here each test says what it holds.
jest.mock('@/lib/supabase', () => ({
	isSupabaseEnabled: true,
	currentAccessToken: jest.fn(),
	refreshedAccessToken: jest.fn(),
	endRejectedSession: jest.fn()
}))
// lib/env.ts is tested on its own (env.test.ts); here it is a plain object the
// tests set, the way a build would have inlined it.
// The device's connection state, which tells "offline" from "the server didn't answer".
jest.mock('@react-native-community/netinfo', () => ({
	__esModule: true,
	default: { fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })) }
}))
jest.mock('@/lib/env', () => ({ env: {} }))
jest.mock('@/lib/logger', () => ({ log: { error: jest.fn(), warn: jest.fn() } }))
const mutableEnv = env as { EXPO_PUBLIC_SITE_URL?: string }

const SITE = 'https://play.example.com'
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

async function failure(): Promise<AccountDeletionError> {
	try {
		await deleteAccount()
	} catch (e) {
		expect(e).toBeInstanceOf(AccountDeletionError)
		return e as AccountDeletionError
	}
	throw new Error('deleteAccount resolved, but it should have thrown')
}

beforeEach(() => {
	mutableEnv.EXPO_PUBLIC_SITE_URL = SITE
	jest.mocked(currentAccessToken).mockReset().mockResolvedValue({ token: 'access-token' })
	jest.mocked(refreshedAccessToken).mockReset().mockResolvedValue({ failure: 'signed_out' })
	jest.mocked(endRejectedSession).mockReset().mockResolvedValue()
	fetchMock.mockReset().mockResolvedValue(respond(200, { ok: true }))
	global.fetch = fetchMock as unknown as typeof fetch
})

describe('deleteAccount', () => {
	it('calls DELETE /api/app/v1/account with the access token as a Bearer token', async () => {
		await deleteAccount()
		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe(`${SITE}/api/app/v1/account`)
		expect(init.method).toBe('DELETE')
		expect(init.headers.Authorization).toBe('Bearer access-token')
		expect(init.body).toBeUndefined()
	})

	it('fails, without calling anything, when EXPO_PUBLIC_SITE_URL is unset', async () => {
		delete mutableEnv.EXPO_PUBLIC_SITE_URL
		expect((await failure()).reason).toBe('not_configured')
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('fails when there is no session', async () => {
		jest.mocked(currentAccessToken).mockResolvedValue({ failure: 'signed_out' })
		expect((await failure()).reason).toBe('no_session')
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('fails as a network problem when the session cannot be refreshed offline', async () => {
		jest.mocked(currentAccessToken).mockResolvedValue({ failure: 'offline' })
		expect((await failure()).reason).toBe('network')
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('fails when the request never reaches the server', async () => {
		fetchMock.mockRejectedValue(new TypeError('Network request failed'))
		expect((await failure()).reason).toBe('network')
	})

	it('fails on a 401 the refresh cannot fix, and ends the dead session', async () => {
		fetchMock.mockResolvedValue(
			respond(401, { error: { code: 'unauthorized', message: 'Your session has expired.' } })
		)
		expect((await failure()).reason).toBe('unauthorized')
		expect(endRejectedSession).toHaveBeenCalledTimes(1)
	})

	it.each([500, 503])('fails on a %i', async (status) => {
		fetchMock.mockResolvedValue(respond(status, { error: { code: 'internal', message: 'no' } }))
		expect((await failure()).reason).toBe('server')
	})

	it('fails on a 200 that is not the route confirming the deletion', async () => {
		fetchMock.mockResolvedValue(respond(200, '<!doctype html>'))
		expect((await failure()).reason).toBe('server')
		fetchMock.mockResolvedValue(respond(200, { ok: false }))
		expect((await failure()).reason).toBe('server')
	})

	it('writes every failure for the person reading it', async () => {
		fetchMock.mockResolvedValue(respond(500, {}))
		expect((await failure()).message).toMatch(/not deleted/)
	})
})
