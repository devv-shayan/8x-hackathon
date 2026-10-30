import { StyleSheet, View } from 'react-native'
import { LogIn, RefreshCw, Unplug, WifiOff } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import type { IconComponent } from '@/components/ui/List'
import { Text } from '@/components/ui/Text'
import { ApiError, errorCode, errorMessage } from '@/lib/api'

/**
 * What a screen shows when its data didn't load: never an empty list
 * (docs/rules/error-handling.md). The message is the API client's, written for
 * the person; the state follows the failure:
 *
 * - not configured: a calm "not connected" state, no retry (it can't help). In
 *   a development build it also names what to set up.
 * - offline: says so; the query refetches by itself when the connection returns.
 * - session over: no retry; the app is already signing out.
 * - anything else: the message, and Try again.
 */

type Kind = 'not_configured' | 'offline' | 'session' | 'failed'

function kindOf(error: unknown): Kind {
	switch (errorCode(error)) {
		case 'not_configured':
			return 'not_configured'
		case 'offline':
			return 'offline'
		case 'unauthorized':
		case 'signed_out':
			return 'session'
		default:
			return 'failed'
	}
}

const ICON: Record<Kind, IconComponent> = {
	not_configured: Unplug,
	offline: WifiOff,
	session: LogIn,
	failed: RefreshCw
}

function bodyOf(error: unknown): string {
	const hint = __DEV__ && error instanceof ApiError ? error.hint : undefined
	return hint ? `${errorMessage(error)}\n\n${hint}` : errorMessage(error)
}

/** A section's whole content, when its data didn't load. */
export function QueryErrorState({
	error,
	title,
	onRetry
}: {
	error: unknown
	/** What didn't load, e.g. "Couldn't load your items". */
	title: string
	onRetry: () => void
}) {
	const kind = kindOf(error)
	return (
		<EmptyState
			icon={ICON[kind]}
			tone={kind === 'not_configured' ? 'brand' : 'error'}
			title={kind === 'not_configured' ? 'Not connected yet' : title}
			body={bodyOf(error)}
			action={
				kind === 'failed' || kind === 'offline'
					? { label: 'Try again', onPress: onRetry }
					: undefined
			}
		/>
	)
}

/** One line and a retry, for a secondary section that didn't load. */
export function InlineQueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
	const kind = kindOf(error)
	return (
		<View style={s.inline}>
			<Text variant="bodySm" tone="secondary" style={s.flex}>
				{errorMessage(error)}
			</Text>
			{kind === 'failed' || kind === 'offline' ? (
				<Button label="Try again" variant="ghost" size="sm" onPress={onRetry} />
			) : null}
		</View>
	)
}

/** "Show more" under a paged list, while the API says there is more. */
export function LoadMore({
	hasMore,
	loading,
	error,
	onPress,
	label = 'Show more'
}: {
	hasMore: boolean
	loading: boolean
	/** A failed next page: the list stays, and this says so. */
	error?: unknown
	onPress: () => void
	label?: string
}) {
	if (error) return <InlineQueryError error={error} onRetry={onPress} />
	if (!hasMore) return null
	return (
		<Button
			label={label}
			variant="secondary"
			size="sm"
			loading={loading}
			onPress={onPress}
			style={s.more}
		/>
	)
}

const s = StyleSheet.create({
	inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	flex: { flex: 1 },
	more: { alignSelf: 'center' }
})
