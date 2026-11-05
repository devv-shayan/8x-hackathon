/**
 * Maya's reminders run only in a real build. Expo Go has no remote push since SDK 53 and
 * errors when expo-notifications is used, so there the module is never loaded.
 */

type Environment = 'storeClient' | 'standalone' | 'bare'

function loadWith(environment: Environment, os: 'ios' | 'android' | 'web' = 'android') {
	let support: typeof import('@/lib/push-support') | undefined
	jest.isolateModules(() => {
		jest.doMock('expo-constants', () => ({
			__esModule: true,
			default: { executionEnvironment: environment },
			ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' }
		}))
		jest.doMock('react-native', () => ({ Platform: { OS: os } }))
		support = jest.requireActual<typeof import('@/lib/push-support')>('@/lib/push-support')
	})
	if (!support) throw new Error('push-support did not load')
	return support
}

describe('push support', () => {
	afterEach(() => {
		jest.dontMock('expo-constants')
		jest.dontMock('react-native')
	})

	it('is off in Expo Go, and never loads the module there', async () => {
		const support = loadWith('storeClient')
		expect(support.PUSH_SUPPORTED).toBe(false)
		expect(await support.loadNotifications()).toBeNull()
	})

	it('is off in the browser', async () => {
		const support = loadWith('standalone', 'web')
		expect(support.PUSH_SUPPORTED).toBe(false)
		expect(await support.loadNotifications()).toBeNull()
	})

	// Jest cannot run import() without --experimental-vm-modules; Metro, which builds the
	// app, can. So the load itself is left to the build.
	it('is on in a store build', () => {
		expect(loadWith('standalone', 'ios').PUSH_SUPPORTED).toBe(true)
		expect(loadWith('standalone', 'android').PUSH_SUPPORTED).toBe(true)
	})

	it('is on in a development build', () => {
		expect(loadWith('bare').PUSH_SUPPORTED).toBe(true)
	})
})
