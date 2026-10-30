import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
	interpolateColor,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import { Check } from 'lucide-react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { useTheme } from '@/contexts/ThemeContext'
import { Springs, Timings } from '@/lib/motion'
import { Text } from './Text'

/** Every option is this tall (or taller at large text sizes), so a list never reflows. */
export const SELECTION_ROW_HEIGHT = 72

/**
 * One option in a single-choice list (onboarding answers, plans). The border
 * and fill cross to the accent over a short timing; the tick pops in on the
 * snappy spring. Every option is the same size, so a choice never reflows.
 */
export function SelectionRow({
	title,
	subtitle,
	selected,
	onPress,
	leading,
	trailing,
	accessibilityLabel,
	style
}: {
	title: string
	subtitle?: string
	selected: boolean
	onPress: () => void
	leading?: ReactNode
	/** Shown instead of the tick (a price, a badge). The tick still marks the choice. */
	trailing?: ReactNode
	accessibilityLabel?: string
	style?: StyleProp<ViewStyle>
}) {
	const { colors: c, radii } = useTheme()
	const on = useSharedValue(selected ? 1 : 0)
	const tick = useSharedValue(selected ? 1 : 0)

	useEffect(() => {
		on.value = withTiming(selected ? 1 : 0, Timings.fast)
		tick.value = selected ? withSpring(1, Springs.snappy) : withTiming(0, Timings.fast)
	}, [selected, on, tick])

	const frame = useAnimatedStyle(() => ({
		borderColor: interpolateColor(on.value, [0, 1], [c.borderSoft, c.brandInk]),
		backgroundColor: interpolateColor(on.value, [0, 1], [c.surface, c.brandDim])
	}))
	const tickStyle = useAnimatedStyle(() => ({
		opacity: tick.value,
		transform: [{ scale: 0.7 + tick.value * 0.3 }]
	}))

	return (
		<PressableScale
			onPress={onPress}
			scaleTo="card"
			haptic="select"
			accessibilityRole="radio"
			accessibilityLabel={accessibilityLabel ?? title}
			accessibilityState={{ checked: selected }}
			style={style}
		>
			<Animated.View style={[s.row, { borderRadius: radii.row }, frame]}>
				{leading}
				<View style={s.text}>
					<Text variant="label">{title}</Text>
					{subtitle ? (
						<Text variant="caption" tone="secondary">
							{subtitle}
						</Text>
					) : null}
				</View>
				{trailing}
				<View style={[s.ring, { borderColor: selected ? c.brandInk : c.borderActive }]}>
					<Animated.View style={[s.tick, { backgroundColor: c.brandInk }, tickStyle]}>
						<Check size={13} color={c.textInverse} strokeWidth={3} />
					</Animated.View>
				</View>
			</Animated.View>
		</PressableScale>
	)
}

const s = StyleSheet.create({
	row: {
		minHeight: SELECTION_ROW_HEIGHT,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderWidth: 1.5
	},
	text: { flex: 1, gap: 2 },
	ring: {
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 1.5,
		alignItems: 'center',
		justifyContent: 'center'
	},
	tick: {
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center'
	}
})
