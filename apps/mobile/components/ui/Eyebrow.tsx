import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useColors } from '@/contexts/ThemeContext'
import { Text } from './Text'

/**
 * The small tracked caps line that names a section or a moment, led by three
 * dots (the middle one full, the outer two softer). Sits above a title; never
 * on its own.
 */
export function Eyebrow({
	children,
	tone = 'brand',
	style
}: {
	children: string
	tone?: 'brand' | 'muted'
	style?: StyleProp<ViewStyle>
}) {
	const c = useColors()
	const color = tone === 'brand' ? c.brandInk : c.textTertiary
	return (
		<View style={[s.row, style]} accessibilityRole="text">
			<View style={s.dots} importantForAccessibility="no-hide-descendants">
				<View style={[s.dot, { backgroundColor: color, opacity: 0.55 }]} />
				<View style={[s.dot, { backgroundColor: color }]} />
				<View style={[s.dot, { backgroundColor: color, opacity: 0.55 }]} />
			</View>
			<Text variant="eyebrow" style={{ color }} numberOfLines={1}>
				{children}
			</Text>
		</View>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	dots: { flexDirection: 'row', gap: 3 },
	dot: { width: 3, height: 3, borderRadius: 1.5 }
})
