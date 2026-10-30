/**
 * 8xResearch's interview widget: off without a product key, and the build asks
 * for the microphone exactly when the app will show it.
 *
 * What these pin: no key (or a malformed one) renders nothing and adds no
 * permission; the widget mounts only for signed-in, onboarded people; the
 * launcher clears the tab bar through bottomInset; the interview's callbacks
 * reach analytics; and lib/env.ts and the config plugin accept the same keys.
 */
import { render } from '@testing-library/react-native'
import { track } from '@/lib/analytics'
import { env, parseEnv, RESEARCH_PRODUCT_KEY } from '@/lib/env'
import ResearchWidget, { PAYWALL_PATH } from '@/components/ResearchWidget'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withResearchWidget = require('../research-widget.plugin')

jest.mock('@/lib/env', () => ({
	...jest.requireActual('@/lib/env'),
	env: {}
}))
jest.mock('@/lib/logger', () => ({ log: { error: jest.fn(), warn: jest.fn() } }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/components/TabBar', () => ({ useTabBarTop: () => 102 }))
let mockPathname = '/'
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }))

type WidgetProps = {
	productKey: string
	bottomInset: number
	onStart: () => void
	onComplete: () => void
	onFailure: (failure: { reason?: string }) => void
	onClose: () => void
}
let widget: WidgetProps | null = null
jest.mock('@8xresearch/research-widget', () => ({
	EightxResearch: (props: WidgetProps) => {
		widget = props
		return null
	}
}))

const KEY = '0123456789abcdef01'
const mutableEnv = env as { EXPO_PUBLIC_RESEARCH_PRODUCT_KEY?: string }

beforeEach(() => {
	widget = null
	mockPathname = '/'
	delete mutableEnv.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY
	jest.mocked(track).mockClear()
})

describe('<ResearchWidget>', () => {
	it('renders nothing without a product key', () => {
		render(<ResearchWidget visible />)
		expect(widget).toBeNull()
	})

	it('renders nothing for someone signed out or mid-onboarding', () => {
		mutableEnv.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY = KEY
		render(<ResearchWidget visible={false} />)
		expect(widget).toBeNull()
	})

	it('renders nothing on the paywall, where it would cover Continue', () => {
		mutableEnv.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY = KEY
		mockPathname = PAYWALL_PATH
		render(<ResearchWidget visible />)
		expect(widget).toBeNull()
	})

	it('mounts with the key above the tab bar and reports the interview', () => {
		mutableEnv.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY = KEY
		render(<ResearchWidget visible />)
		expect(widget?.productKey).toBe(KEY)
		expect(widget?.bottomInset).toBe(102)
		widget?.onStart()
		widget?.onComplete()
		widget?.onClose()
		widget?.onFailure({ reason: 'microphone-denied' })
		widget?.onFailure({})
		expect(track).toHaveBeenCalledWith('research_interview_started')
		expect(track).toHaveBeenCalledWith('research_interview_completed')
		expect(track).toHaveBeenCalledWith('research_interview_closed')
		expect(track).toHaveBeenCalledWith('research_interview_failed', {
			reason: 'microphone-denied'
		})
		expect(track).toHaveBeenCalledWith('research_interview_failed', { reason: 'unknown' })
	})
})

describe('the product key', () => {
	it('is dropped from the env when it is not an 8xResearch key', () => {
		expect(
			parseEnv({ EXPO_PUBLIC_RESEARCH_PRODUCT_KEY: KEY }).EXPO_PUBLIC_RESEARCH_PRODUCT_KEY
		).toBe(KEY)
		for (const bad of ['', 'REPLACE_WITH_YOUR_PRODUCT_KEY', 'not-a-key', `${KEY}0`]) {
			expect(
				parseEnv({ EXPO_PUBLIC_RESEARCH_PRODUCT_KEY: bad }).EXPO_PUBLIC_RESEARCH_PRODUCT_KEY
			).toBeUndefined()
		}
	})

	it('means the same thing to the app and to the build', () => {
		expect(withResearchWidget.PRODUCT_KEY.source).toBe(RESEARCH_PRODUCT_KEY.source)
		for (const value of [KEY, 'REPLACE_WITH_YOUR_PRODUCT_KEY', 'ABCDEF0123456789AB', '']) {
			expect(withResearchWidget.researchWidgetEnabled(value)).toBe(
				parseEnv({ EXPO_PUBLIC_RESEARCH_PRODUCT_KEY: value }).EXPO_PUBLIC_RESEARCH_PRODUCT_KEY !==
					undefined
			)
		}
	})
})

describe('research-widget.plugin.js', () => {
	const MIC = '$(PRODUCT_NAME) uses the microphone only when you choose to answer by voice.'
	const base = () => ({
		name: 'MyApp',
		slug: 'my-app',
		ios: { infoPlist: {} },
		android: {
			permissions: [],
			blockedPermissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO']
		}
	})
	const saved = process.env.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY
	afterEach(() => {
		if (saved === undefined) delete process.env.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY
		else process.env.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY = saved
	})

	it('changes nothing without a key', () => {
		delete process.env.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY
		expect(withResearchWidget(base(), { microphonePermission: MIC })).toEqual(base())
	})

	it('adds the microphone with a key', () => {
		process.env.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY = KEY
		const config = withResearchWidget(base(), { microphonePermission: MIC })
		expect(config.android.permissions).toEqual([
			'android.permission.RECORD_AUDIO',
			'android.permission.MODIFY_AUDIO_SETTINGS'
		])
		expect(config.android.blockedPermissions).toEqual(['android.permission.CAMERA'])
		expect(config.ios.infoPlist.NSMicrophoneUsageDescription).toBe(MIC)
	})

	it('refuses a key without a purpose string', () => {
		process.env.EXPO_PUBLIC_RESEARCH_PRODUCT_KEY = KEY
		expect(() => withResearchWidget(base(), {})).toThrow(/microphonePermission/)
	})
})
