import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/motion'

const PULSE_MS = 700
const PULSE_SCALE = 1.25

/**
 * One square per day of an idea's ruler, then one for due: the days gone are filled, today is
 * lime and pulses, the days still to come are outlines. Each square is a day Maya sends a note.
 */
export function StageRuler({ window, daysPassed }: { window: number; daysPassed: number }) {
	const { colors: c } = useTheme()
	const reduced = useReducedMotion()
	const pulse = useRef(new Animated.Value(0)).current

	useEffect(() => {
		if (reduced) return
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulse, {
					toValue: 1,
					duration: PULSE_MS,
					easing: Easing.inOut(Easing.sin),
					useNativeDriver: true
				}),
				Animated.timing(pulse, {
					toValue: 0,
					duration: PULSE_MS,
					easing: Easing.inOut(Easing.sin),
					useNativeDriver: true
				})
			])
		)
		loop.start()
		return () => loop.stop()
	}, [pulse, reduced])

	const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, PULSE_SCALE] })
	const days = Array.from({ length: window + 1 }, (_, day) => day)
	return (
		<View
			style={s.ruler}
			accessible
			accessibilityLabel={
				daysPassed >= window ? 'Due today' : `Day ${daysPassed} of ${window} before it's due`
			}
		>
			{days.map((day) => {
				const today = day === daysPassed
				const gone = day < daysPassed
				const square = (
					<View
						style={[
							s.square,
							{
								backgroundColor: today ? c.brandFill : gone ? c.textPrimary : 'transparent',
								borderColor: today || gone ? c.textPrimary : c.borderSoft
							}
						]}
					/>
				)
				return (
					<View key={day} style={s.cell}>
						{today ? (
							<Animated.View style={{ transform: [{ scale }] }}>{square}</Animated.View>
						) : (
							square
						)}
						<Text variant="eyebrow" tone={today ? 'primary' : 'tertiary'}>
							{day === window ? '!' : `D${day}`}
						</Text>
					</View>
				)
			})}
		</View>
	)
}

const s = StyleSheet.create({
	ruler: { flexDirection: 'row', gap: 6 },
	cell: { alignItems: 'center', gap: 4 },
	square: { width: 22, height: 22, borderWidth: 2 }
})
