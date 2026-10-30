import { AppState, Platform } from 'react-native'
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'
import { shouldRetry } from './api'
import { isOffline } from './useNetworkStatus'

/**
 * Server state for the app: every query's data comes from lib/api.ts, which
 * throws on any failure, so a query is either data or an error the screen
 * shows (docs/rules/state-management.md).
 *
 * - `networkMode: 'always'`: a request made offline runs and fails at once with
 *   `offline`, and the screen says so. TanStack's default would pause it
 *   instead, which a screen can only show as a skeleton that never ends.
 * - Reconnecting refetches: onlineManager follows NetInfo, so the queries that
 *   failed offline run again, and their screens recover, when the connection
 *   comes back. Returning to the app refetches stale queries the same way.
 * - Retries only what a second try can fix (shouldRetry in lib/api.ts).
 */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			networkMode: 'always',
			retry: shouldRetry,
			staleTime: 30_000,
			gcTime: 5 * 60_000
		},
		mutations: { networkMode: 'always', retry: false }
	}
})

onlineManager.setEventListener((setOnline) =>
	NetInfo.addEventListener((state) => setOnline(!isOffline(state)))
)

// The web build has window focus events of its own.
if (Platform.OS !== 'web') {
	focusManager.setEventListener((setFocused) => {
		const subscription = AppState.addEventListener('change', (state) =>
			setFocused(state === 'active')
		)
		return () => subscription.remove()
	})
}
