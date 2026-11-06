import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
	type SharedValue
} from 'react-native-reanimated'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Springs, Timings, useReducedMotion } from '@/lib/motion'

const STAMP_TILT = '-8deg'
const STAMP_FROM = 2.2
const DUST_MS = 700
/** Where each speck of chalk ends up, from the middle of the burst. */
const SPECKS: readonly (readonly [number, number])[] = [
	[-90, -60],
	[90, -54],
	[-62, 58],
	[66, 62],
	[-118, 8],
	[118, 2],
	[0, -82],
	[10, 80],
	[-40, -94],
	[46, 90]
]

/** The stamp thumps down at a tilt. Right is lime; wrong is softer, and never a red X. */
export function Stamp({ isRight }: { isRight: boolean }) {
	const { colors: c, radii } = useTheme()
	const scale = useSharedValue(STAMP_FROM)
	const opacity = useSharedValue(0)
	useEffect(() => {
		scale.value = withSpring(1, Springs.snappy)
		opacity.value = withTiming(1, Timings.fast)
	}, [scale, opacity])
	const style = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ rotate: STAMP_TILT }, { scale: scale.value }]
	}))
	return (
		<Animated.View
			pointerEvents="none"
			style={[
				s.stamp,
				{
					backgroundColor: isRight ? c.brandFill : c.surface,
					borderColor: c.textPrimary,
					borderRadius: radii.md
				},
				style
			]}
		>
			<Text variant="h3" style={{ color: c.onBrand }}>
				{isRight ? 'Correct!' : 'Not quite'}
			</Text>
		</Animated.View>
	)
}

function Speck({
	progress,
	x,
	y,
	color
}: {
	progress: SharedValue<number>
	x: number
	y: number
	color: string
}) {
	const style = useAnimatedStyle(() => ({
		opacity: 1 - progress.value,
		transform: [
			{ translateX: x * progress.value },
			{ translateY: y * progress.value },
			{ scale: 1 - 0.6 * progress.value }
		]
	}))
	return <Animated.View style={[s.speck, { backgroundColor: color }, style]} />
}

/** A puff of chalk dust. With Reduce Motion on, there isn't one. */
export function ChalkDust() {
	const { colors: c } = useTheme()
	const reduced = useReducedMotion()
	const progress = useSharedValue(0)
	useEffect(() => {
		progress.value = withTiming(1, { duration: DUST_MS })
	}, [progress])
	if (reduced) return null
	return (
		<View style={s.dust} pointerEvents="none">
			{SPECKS.map(([x, y], i) => (
				<Speck key={i} progress={progress} x={x} y={y} color={c.brandFill} />
			))}
		</View>
	)
}

const s = StyleSheet.create({
	stamp: {
		position: 'absolute',
		top: -12,
		right: 2,
		zIndex: 6,
		paddingHorizontal: 14,
		paddingVertical: 5,
		borderWidth: 3
	},
	dust: { position: 'absolute', top: '50%', left: '50%', zIndex: 5 },
	speck: { position: 'absolute', width: 8, height: 8 }
})
