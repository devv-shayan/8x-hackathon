/**
 * A flag answers with its declared default until PostHog has answered: not configured, still
 * loading, or unreachable (docs/rules/feature-flags.md, rule 2). The real posthog-react-native
 * hook runs against a stand-in client that answers as @posthog/core does: getFeatureFlag is
 * undefined until flags load, and stays undefined when the request fails before any have
 * loaded; once they have, a flag missing from them is false. onFeatureFlags fires on each load.
 */
import { act, renderHook } from '@testing-library/react-native'
import { useFeatureFlag } from '@/lib/featureFlags'

type Flags = Record<string, boolean | string>

const mockClient = {
	flags: undefined as Flags | undefined,
	listeners: new Set<(flags: Flags) => void>(),
	getFeatureFlag(key: string): boolean | string | undefined {
		if (this.flags === undefined || Object.keys(this.flags).length === 0) return undefined
		return this.flags[key] ?? false
	},
	onFeatureFlags(listener: (flags: Flags) => void) {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	},
	/** A /flags response arriving; `{}` is what a failed request leaves behind. */
	load(flags: Flags) {
		this.flags = flags
		for (const listener of this.listeners) listener(flags)
	}
}
let mockConfigured = true

jest.mock('@/lib/analytics', () => ({
	get isPostHogEnabled() {
		return mockConfigured
	},
	get posthog() {
		return mockConfigured ? mockClient : null
	}
}))

beforeEach(() => {
	mockConfigured = true
	mockClient.flags = undefined
	mockClient.listeners.clear()
})

describe('useFeatureFlag', () => {
	it('returns the default while the flags load', () => {
		expect(renderHook(() => useFeatureFlag('new_flow', true)).result.current).toBe(true)
		expect(renderHook(() => useFeatureFlag('new_flow', false)).result.current).toBe(false)
		expect(renderHook(() => useFeatureFlag('new_flow')).result.current).toBe(false)
	})

	it("returns PostHog's answer once the flags load, over the default", () => {
		const on = renderHook(() => useFeatureFlag('new_flow', false))
		const off = renderHook(() => useFeatureFlag('old_flow', true))
		act(() => mockClient.load({ new_flow: true, old_flow: false }))
		expect(on.result.current).toBe(true)
		expect(off.result.current).toBe(false)
	})

	it('keeps the default when PostHog is unreachable', () => {
		const { result } = renderHook(() => useFeatureFlag('new_flow', true))
		act(() => mockClient.load({}))
		expect(result.current).toBe(true)
	})

	it('reads a flag PostHog did not return for this person as off', () => {
		const { result } = renderHook(() => useFeatureFlag('new_flow', true))
		act(() => mockClient.load({ other_flow: true }))
		expect(result.current).toBe(false)
	})

	it('reads a variant as off and the string "true" as on', () => {
		mockClient.flags = { variant_flow: 'test', string_flow: 'true' }
		expect(renderHook(() => useFeatureFlag('variant_flow', true)).result.current).toBe(false)
		expect(renderHook(() => useFeatureFlag('string_flow')).result.current).toBe(true)
	})

	it('returns the default when PostHog is not configured', () => {
		mockConfigured = false
		mockClient.flags = { new_flow: false }
		// posthog-react-native's hook warns once that it has no client, which is the point here.
		const warn = jest.spyOn(console, 'error').mockImplementation(() => {})
		try {
			expect(renderHook(() => useFeatureFlag('new_flow', true)).result.current).toBe(true)
		} finally {
			warn.mockRestore()
		}
	})
})
