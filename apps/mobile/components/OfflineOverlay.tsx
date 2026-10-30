import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated'
import NetInfo from '@react-native-community/netinfo'
import { WifiOff } from 'lucide-react-native'
import { EmptyState } from '@/components/ui/EmptyState'
import { useColors } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { Durations } from '@/lib/motion'
import { isOffline, useNetworkStatus } from '@/lib/useNetworkStatus'

const fadeIn = FadeIn.duration(Durations.base).reduceMotion(ReduceMotion.System)
const fadeOut = FadeOut.duration(Durations.base).reduceMotion(ReduceMotion.System)

/**
 * Full-screen state for a launch with no connection. It decides on the FIRST
 * connectivity reading (useNetworkStatus starts at null, not true, so a
 * launch offline is seen as offline). Once the app has been online this
 * session it never returns: OfflineBanner handles drops mid-session.
 */
export default function OfflineOverlay() {
	const c = useColors()
	const online = useNetworkStatus()
	const decided = useRef(false)
	const [visible, setVisible] = useState(false)
	const [checking, setChecking] = useState(false)

	useEffect(() => {
		if (online === null) return
		if (!decided.current) {
			decided.current = true
			setVisible(!online)
			return
		}
		if (online) setVisible(false)
	}, [online])

	async function retry() {
		setChecking(true)
		const state = await NetInfo.fetch()
		setChecking(false)
		if (!isOffline(state)) {
			haptic.success()
			setVisible(false)
		} else {
			haptic.warning()
		}
	}

	if (!visible) return null

	return (
		<Animated.View
			entering={fadeIn}
			exiting={fadeOut}
			style={[StyleSheet.absoluteFill, s.center, { backgroundColor: c.bg }]}
			accessibilityViewIsModal
		>
			<View style={s.body}>
				<EmptyState
					icon={WifiOff}
					title="You're offline"
					body="Check your Wi-Fi or mobile data, then try again."
					action={{ label: checking ? 'Checking…' : 'Try again', onPress: retry }}
				/>
			</View>
		</Animated.View>
	)
}

const s = StyleSheet.create({
	center: { alignItems: 'center', justifyContent: 'center' },
	body: { width: '100%', paddingHorizontal: 24 }
})
