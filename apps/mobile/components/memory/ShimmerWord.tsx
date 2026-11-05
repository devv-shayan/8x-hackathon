import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/Text'
import { useReducedMotion } from '@/lib/motion'

/** How bright a letter gets as the light passes, above its faded self. */
const LIFT = 0.5
/** How far either side of a letter the light reaches, as a share of the sweep. */
const BAND = 0.14
/** The sweep runs between these shares, so the first and last letters get the whole band. */
const SWEEP_START = 0.15
const SWEEP_SPAN = 0.7
/** A sweep's length and the rest after it, for an idea with no days left; more days, calmer. */
const SWEEP_MS = 900
const REST_MS = 500
const CALMER_SWEEP_MS = 260
const CALMER_REST_MS = 200

/**
 * An idea Maya is forgetting: the word a little faded, with light running through it letter
 * by letter, the way a memory flickers. `solid` is how faded it is (1 is full chalk), and
 * `daysLeft` sets the pace: closer to due, quicker. A full-strength word stays still, and so
 * does every word when Reduce Motion is on. Screen readers hear the word once.
 */
export function ShimmerWord({
	text,
	solid,
	daysLeft
}: {
	text: string
	solid: number
	daysLeft: number | null
}) {
	const reduced = useReducedMotion()
	const sweep = useRef(new Animated.Value(0)).current
	const still = reduced || daysLeft == null || solid >= 1

	useEffect(() => {
		if (still) return
		const days = daysLeft ?? 0
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(sweep, {
					toValue: 1,
					duration: SWEEP_MS + days * CALMER_SWEEP_MS,
					easing: Easing.linear,
					useNativeDriver: true
				}),
				Animated.delay(REST_MS + days * CALMER_REST_MS),
				Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true })
			])
		)
		loop.start()
		return () => loop.stop()
	}, [daysLeft, still, sweep])

	if (still) {
		return (
			<Text variant="display" style={{ opacity: solid }}>
				{text}
			</Text>
		)
	}

	const letters = [...text]
	const last = Math.max(1, letters.length - 1)
	const peak = Math.min(1, solid + LIFT)
	return (
		<View style={s.row} accessible accessibilityRole="text" accessibilityLabel={text}>
			{letters.map((letter, i) => {
				const at = SWEEP_START + (SWEEP_SPAN * i) / last
				const inputRange = [0, at - BAND, at, at + BAND, 1]
				const opacity = sweep.interpolate({
					inputRange,
					outputRange: [solid, solid, peak, solid, solid]
				})
				const translateY = sweep.interpolate({ inputRange, outputRange: [0, 0, -2, 0, 0] })
				return (
					<Animated.View
						key={i}
						importantForAccessibility="no-hide-descendants"
						accessibilityElementsHidden
						style={{ opacity, transform: [{ translateY }] }}
					>
						<Text variant="display">{letter === ' ' ? ' ' : letter}</Text>
					</Animated.View>
				)
			})}
		</View>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }
})
