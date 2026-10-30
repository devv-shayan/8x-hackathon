import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WifiOff } from 'lucide-react-native'
import { Text } from '@/components/ui/Text'
import { useColors } from '@/contexts/ThemeContext'
import { Durations, Easings } from '@/lib/motion'
import { useNetworkStatus } from '@/lib/useNetworkStatus'

/** How long "Back online" stays before the pill leaves, ms. */
const BACK_ONLINE_MS = 2000

const enter = FadeInUp.duration(Durations.base)
	.easing(Easings.out)
	.reduceMotion(ReduceMotion.System)
const leave = FadeOutUp.duration(Durations.exit)
	.easing(Easings.in)
	.reduceMotion(ReduceMotion.System)

/**
 * A pill under the status bar while the connection drops mid-session, which
 * turns to "Back online" for two seconds when it returns. A launch with no
 * connection is OfflineOverlay's job, not this one.
 */
export default function OfflineBanner() {
	const insets = useSafeAreaInsets()
	const c = useColors()
	const online = useNetworkStatus()
	const wasOffline = useRef(false)
	const [state, setState] = useState<'hidden' | 'offline' | 'back'>('hidden')

	useEffect(() => {
		if (online === null) return
		if (!online) {
			wasOffline.current = true
			setState('offline')
			return
		}
		if (!wasOffline.current) return
		wasOffline.current = false
		setState('back')
		const timer = setTimeout(() => setState('hidden'), BACK_ONLINE_MS)
		return () => clearTimeout(timer)
	}, [online])

	if (state === 'hidden') return null
	const back = state === 'back'

	return (
		<View pointerEvents="none" style={[s.wrap, { top: insets.top + 8 }]}>
			<Animated.View
				entering={enter}
				exiting={leave}
				accessibilityRole="alert"
				accessibilityLiveRegion="polite"
				style={[s.pill, { backgroundColor: c.hero, borderColor: c.heroBorder }]}
			>
				{back ? (
					<View style={[s.dot, { backgroundColor: c.success }]} />
				) : (
					<WifiOff size={15} color={c.heroTextSecondary} strokeWidth={2} />
				)}
				<Text variant="bodySm" style={{ color: c.heroText }}>
					{back ? 'Back online' : 'No connection'}
				</Text>
			</Animated.View>
		</View>
	)
}

const s = StyleSheet.create({
	wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
	pill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingHorizontal: 14,
		paddingVertical: 9,
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth
	},
	dot: { width: 8, height: 8, borderRadius: 4 }
})
