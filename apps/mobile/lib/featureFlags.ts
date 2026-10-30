import { useFeatureFlag as usePostHogFlag } from 'posthog-react-native'
import { isPostHogEnabled, posthog } from '@/lib/analytics'

/**
 * A PostHog feature flag, on or off.
 *
 * Returns `defaultValue` until PostHog has an answer for the flag: when PostHog is not
 * configured, while the flags are still loading, and when the request failed or timed out
 * before any flags loaded. The read never waits on the network, so the default is what a
 * person sees whenever PostHog is slow or unreachable: make it the safe, shipped behaviour
 * (docs/rules/feature-flags.md). Once PostHog has answered, its answer wins.
 *
 * Usage:
 *   const showNewFlow = useFeatureFlag('new-onboarding-flow')
 *
 * Create flags in PostHog → Feature Flags.
 */
export function useFeatureFlag(flag: string, defaultValue = false): boolean {
	// The client is passed rather than read from <PostHogProvider>, so a flag reads the same
	// wherever the component sits in the tree.
	const value = usePostHogFlag(flag, posthog ?? undefined)
	if (!isPostHogEnabled || value === undefined) return defaultValue
	return value === true || value === 'true'
}
