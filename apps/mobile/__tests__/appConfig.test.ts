import { appConfigSchema } from '@app/contract'
import {
	checkForRequiredUpdate,
	compareVersions,
	CONFIG_TIMEOUT_MS,
	requiredUpdate,
	type AppConfig
} from '@/lib/appConfig'
import { env } from '@/lib/env'
import { log } from '@/lib/logger'

// lib/env.ts is tested on its own (env.test.ts); here it is a plain object the
// tests set, the way a build would have inlined it.
// The device's connection state, which tells "offline" from "the server didn't answer".
jest.mock('@react-native-community/netinfo', () => ({
	__esModule: true,
	default: { fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })) }
}))
jest.mock('@/lib/env', () => ({ env: {} }))
jest.mock('@/lib/logger', () => ({ log: { error: jest.fn(), warn: jest.fn() } }))
// GET config is public: the API client never asks for a session here.
jest.mock('@/lib/supabase', () => ({
	isSupabaseEnabled: true,
	currentAccessToken: jest.fn(),
	refreshedAccessToken: jest.fn(),
	endRejectedSession: jest.fn()
}))
const mutableEnv = env as { EXPO_PUBLIC_SITE_URL?: string }

const SITE = 'https://play.example.com'
const IOS_STORE = 'https://apps.apple.com/app/id1234567890'
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.yourcompany.myapp'
const fetchMock = jest.fn()

/** The v1 response, as apps/web must serve it. */
function config(overrides: Partial<AppConfig> = {}): AppConfig {
	return {
		min_supported_version: { ios: '1.3.0', android: '1.3.0' },
		store_url: { ios: IOS_STORE, android: PLAY_STORE },
		...overrides
	}
}

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

beforeEach(() => {
	mutableEnv.EXPO_PUBLIC_SITE_URL = SITE
	fetchMock.mockReset().mockResolvedValue(respond(200, config()))
	global.fetch = fetchMock as unknown as typeof fetch
	jest.mocked(log.error).mockClear()
	jest.mocked(log.warn).mockClear()
})

describe('compareVersions', () => {
	it('orders versions numerically, not as strings', () => {
		expect(compareVersions('1.2.0', '1.3.0')).toBeLessThan(0)
		expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
		expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0)
	})

	it('treats missing parts as zero', () => {
		expect(compareVersions('1.4', '1.4.0')).toBe(0)
		expect(compareVersions('2', '1.9')).toBeGreaterThan(0)
	})

	it('returns null for anything that is not a numeric version', () => {
		expect(compareVersions('1.2.0-beta', '1.3.0')).toBeNull()
		expect(compareVersions('', '1.0.0')).toBeNull()
		expect(compareVersions('1.0.0', 'latest')).toBeNull()
	})
})

describe('appConfigSchema', () => {
	it('accepts the v1 shape, with null meaning no minimum', () => {
		expect(appConfigSchema.safeParse(config()).success).toBe(true)
		const none = config({
			min_supported_version: { ios: null, android: null },
			store_url: { ios: null, android: null }
		})
		expect(appConfigSchema.safeParse(none).success).toBe(true)
	})

	it('ignores fields it does not know, so v1 can grow without breaking old builds', () => {
		const parsed = appConfigSchema.safeParse({ ...config(), maintenance: { active: false } })
		expect(parsed.success).toBe(true)
	})

	it('rejects a minimum without a store link to send people to', () => {
		const parsed = appConfigSchema.safeParse(
			config({ store_url: { ios: null, android: PLAY_STORE } })
		)
		expect(parsed.success).toBe(false)
	})

	it('rejects a non-https store link and a malformed version', () => {
		expect(
			appConfigSchema.safeParse(
				config({ store_url: { ios: 'itms-apps://apps.apple.com/app/id1', android: PLAY_STORE } })
			).success
		).toBe(false)
		expect(
			appConfigSchema.safeParse(config({ min_supported_version: { ios: 'v1.3', android: null } }))
				.success
		).toBe(false)
	})
})

describe('requiredUpdate', () => {
	it('requires an update below the minimum, with that platform’s store link', () => {
		expect(requiredUpdate(config(), 'ios', '1.2.9')).toEqual({
			appVersion: '1.2.9',
			minSupportedVersion: '1.3.0',
			storeUrl: IOS_STORE
		})
		expect(requiredUpdate(config(), 'android', '1.0.0')?.storeUrl).toBe(PLAY_STORE)
	})

	it('lets the minimum itself and anything newer through', () => {
		expect(requiredUpdate(config(), 'ios', '1.3.0')).toBeNull()
		expect(requiredUpdate(config(), 'ios', '1.3')).toBeNull()
		expect(requiredUpdate(config(), 'android', '2.0.0')).toBeNull()
	})

	it('lets everything through when the platform has no minimum', () => {
		const iosOnly = config({ min_supported_version: { ios: '1.3.0', android: null } })
		expect(requiredUpdate(iosOnly, 'android', '0.1.0')).toBeNull()
	})

	it('lets a native version it cannot parse through', () => {
		expect(requiredUpdate(config(), 'ios', '1.2.0 (beta)')).toBeNull()
	})
})

describe('checkForRequiredUpdate', () => {
	it('asks GET /api/app/v1/config and applies the minimum', async () => {
		const result = await checkForRequiredUpdate({ platform: 'ios', appVersion: '1.0.0' })
		expect(result?.minSupportedVersion).toBe('1.3.0')
		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe(`${SITE}/api/app/v1/config`)
		expect(init.method).toBe('GET')
		expect(init.headers.Authorization).toBeUndefined()
		expect(init.signal).toBeDefined()
	})

	it('tolerates a trailing slash on EXPO_PUBLIC_SITE_URL', async () => {
		mutableEnv.EXPO_PUBLIC_SITE_URL = `${SITE}/`
		await checkForRequiredUpdate({ platform: 'ios', appVersion: '1.0.0' })
		expect(fetchMock.mock.calls[0][0]).toBe(`${SITE}/api/app/v1/config`)
	})

	it('returns null for a supported version', async () => {
		expect(await checkForRequiredUpdate({ platform: 'android', appVersion: '1.3.0' })).toBeNull()
	})

	// The hard rule: nothing but a valid response naming a higher minimum blocks the app.
	describe('never blocks the app when the check cannot be made', () => {
		it('makes no request without a site URL or a native version', async () => {
			mutableEnv.EXPO_PUBLIC_SITE_URL = undefined
			expect(await checkForRequiredUpdate({ platform: 'ios', appVersion: '1.0.0' })).toBeNull()
			mutableEnv.EXPO_PUBLIC_SITE_URL = SITE
			expect(await checkForRequiredUpdate({ platform: 'ios', appVersion: null })).toBeNull()
			expect(fetchMock).not.toHaveBeenCalled()
		})

		it('opens normally when the route does not exist yet (404)', async () => {
			fetchMock.mockResolvedValue(respond(404, '<html>Not found</html>'))
			expect(await checkForRequiredUpdate({ platform: 'ios', appVersion: '1.0.0' })).toBeNull()
			expect(log.warn).toHaveBeenCalled()
			expect(log.error).not.toHaveBeenCalled()
		})

		it('opens normally on a server error', async () => {
			fetchMock.mockResolvedValue(respond(503, { error: 'unavailable' }))
			expect(await checkForRequiredUpdate({ platform: 'ios', appVersion: '1.0.0' })).toBeNull()
		})

		it('opens normally when offline', async () => {
			fetchMock.mockRejectedValue(new TypeError('Network request failed'))
			expect(await checkForRequiredUpdate({ platform: 'ios', appVersion: '1.0.0' })).toBeNull()
			expect(log.error).not.toHaveBeenCalled()
		})

		it('opens normally when a 200 is not JSON (a wrong site URL answering with a page)', async () => {
			fetchMock.mockResolvedValue(respond(200, '<html>Welcome</html>'))
			expect(await checkForRequiredUpdate({ platform: 'ios', appVersion: '1.0.0' })).toBeNull()
		})

		it('opens normally, and reports it, when the body breaks the v1 contract', async () => {
			fetchMock.mockResolvedValue(respond(200, { min_supported_version: '9.9.9' }))
			expect(await checkForRequiredUpdate({ platform: 'ios', appVersion: '1.0.0' })).toBeNull()
			expect(log.error).toHaveBeenCalledTimes(1)
		})

		it('gives up after the timeout and opens normally', async () => {
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
				const pending = checkForRequiredUpdate({ platform: 'ios', appVersion: '1.0.0' })
				jest.advanceTimersByTime(CONFIG_TIMEOUT_MS)
				expect(await pending).toBeNull()
			} finally {
				jest.useRealTimers()
			}
		})
	})
})
