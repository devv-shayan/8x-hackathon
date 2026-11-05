import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { Bell } from 'lucide-react-native'
import { withAlpha } from '@app/brand'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/motion'

const DROP_DELAY_MS = 400
const DROP_FROM = -120
const GLASS = 0.94

function when(at: Date, now: Date): string {
	const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
	return at.toDateString() === now.toDateString() ? `Today ${time}` : `Tomorrow ${time}`
}

/**
 * Maya's next reminder, drawn like the note it will be, sliding down from the top once. The
 * title is the idea's name, as the note's title is.
 */
export function NextReminder({ title, at, now }: { title: string; at: Date; now: Date }) {
	const { colors: c, radii, elevation } = useTheme()
	const reduced = useReducedMotion()
	const drop = useRef(new Animated.Value(reduced ? 1 : 0)).current

	useEffect(() => {
		if (reduced) return
		Animated.spring(drop, {
			toValue: 1,
			delay: DROP_DELAY_MS,
			damping: 14,
			stiffness: 120,
			useNativeDriver: true
		}).start()
	}, [drop, reduced])

	const translateY = drop.interpolate({ inputRange: [0, 1], outputRange: [DROP_FROM, 0] })
	return (
		<Animated.View
			accessible
			accessibilityLabel={`Maya's next reminder, ${when(at, now)}: ${title}`}
			style={[
				s.note,
				{ backgroundColor: withAlpha(c.surface, GLASS), borderRadius: radii['2xl'] },
				elevation.soft,
				{ opacity: drop, transform: [{ translateY }] }
			]}
		>
			<View style={[s.icon, { backgroundColor: c.textPrimary, borderRadius: radii.md }]}>
				<Bell color={c.brandFill} fill={c.brandFill} size={18} strokeWidth={2.2} />
			</View>
			<View style={s.copy}>
				<View style={s.top}>
					<Text variant="eyebrow" tone="secondary">
						Next reminder
					</Text>
					<Text variant="eyebrow" tone="tertiary">
						{when(at, now)}
					</Text>
				</View>
				<Text variant="bodySm" style={s.title} numberOfLines={1}>
					{title}
				</Text>
			</View>
		</Animated.View>
	)
}

const s = StyleSheet.create({
	note: { padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' },
	icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
	copy: { flex: 1, gap: 2 },
	top: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
	title: { fontWeight: '700' }
})
