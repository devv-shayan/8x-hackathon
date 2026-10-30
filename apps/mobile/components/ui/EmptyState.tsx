import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { useTheme } from '@/contexts/ThemeContext'
import { Easings } from '@/lib/motion'
import { Button } from './Button'
import type { IconComponent } from './List'
import { Text } from './Text'

const TILE = 64
const HALO = 132
/** One breath: in and out, ms. Slow enough to read as calm, not as loading. */
const BREATH = 2400

/**
 * What a screen shows when there is nothing yet (or nothing matches): an icon
 * tile over a slowly breathing tint, a title, a line of help, and at most one
 * action. The halo is still under Reduce Motion.
 */
export function EmptyState({
	icon: Icon,
	title,
	body,
	action,
	tone = 'brand'
}: {
	icon: IconComponent
	title: string
	body?: string
	action?: { label: string; onPress: () => void }
	/** error for a failed load. */
	tone?: 'brand' | 'error'
}) {
	const { colors: c } = useTheme()
	const reduceMotion = useReducedMotion()
	const breath = useSharedValue(0)

	useEffect(() => {
		if (reduceMotion) return
		breath.value = withRepeat(withTiming(1, { duration: BREATH, easing: Easings.inOut }), -1, true)
	}, [breath, reduceMotion])

	const halo = useAnimatedStyle(() => ({
		opacity: 0.55 + breath.value * 0.45,
		transform: [{ scale: 0.92 + breath.value * 0.12 }]
	}))

	const tint = tone === 'error' ? c.errorSoft : c.brandDim
	const ink = tone === 'error' ? c.errorText : c.brandInk

	return (
		<View style={s.wrap} accessibilityRole="summary">
			<FadeSlideIn index={0} style={s.art}>
				<Animated.View style={[s.halo, { backgroundColor: tint }, halo]} />
				<View style={[s.tile, { backgroundColor: c.surface, borderColor: c.borderSoft }]}>
					<Icon size={26} color={ink} strokeWidth={1.8} />
				</View>
			</FadeSlideIn>
			<FadeSlideIn index={1} style={s.copy}>
				<Text variant="h3" style={s.center}>
					{title}
				</Text>
				{body ? (
					<Text variant="bodySm" tone="secondary" style={s.center}>
						{body}
					</Text>
				) : null}
			</FadeSlideIn>
			{action ? (
				<FadeSlideIn index={2}>
					<Button label={action.label} variant="secondary" size="sm" onPress={action.onPress} />
				</FadeSlideIn>
			) : null}
		</View>
	)
}

const s = StyleSheet.create({
	wrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 12, gap: 18 },
	art: { width: HALO, height: HALO, alignItems: 'center', justifyContent: 'center' },
	halo: { position: 'absolute', width: HALO, height: HALO, borderRadius: HALO / 2 },
	tile: {
		width: TILE,
		height: TILE,
		borderRadius: 22,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'center'
	},
	copy: { gap: 6, maxWidth: 300 },
	center: { textAlign: 'center' }
})
