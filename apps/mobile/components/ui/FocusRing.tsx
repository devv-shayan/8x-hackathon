import { Platform, StyleSheet, View, type TextStyle } from 'react-native'
import { useColors } from '@/contexts/ThemeContext'

/** The ring's width, and how far it sits outside the field. Matches the website's ring-2. */
const RING = 2

/**
 * The browser draws its own focus box inside a focused input, in the device's accent colour
 * (blue on many). A field shows focus with FocusRing instead. React Native's types don't
 * list `none`, the value that removes it on the web.
 */
export const NO_SYSTEM_OUTLINE = (Platform.OS === 'web'
	? { outlineStyle: 'none' }
	: null) as unknown as TextStyle | null

/**
 * For a ScrollView that sits flush with its field's sides, as inside a SheetCard: it clips
 * the ring's sides otherwise. Give the ScrollView `style`, and its
 * contentContainerStyle `content`.
 */
export const ROOM_FOR_RING = StyleSheet.create({
	style: { marginHorizontal: -(RING + 1) },
	content: { paddingHorizontal: RING + 1 }
})

/**
 * The website's focus: a lime ring just outside the field, whose border turns ink. Put it
 * inside the field's View. It takes no touches and doesn't move the layout.
 */
export function FocusRing({ radius }: { radius: number }) {
	const c = useColors()
	return (
		<View
			testID="focus-ring"
			pointerEvents="none"
			style={[s.ring, { borderColor: c.brandFill, borderRadius: radius + RING + 1 }]}
		/>
	)
}

const s = StyleSheet.create({
	// One point further out than the width, to clear the field's own 1pt border.
	ring: {
		position: 'absolute',
		top: -(RING + 1),
		left: -(RING + 1),
		right: -(RING + 1),
		bottom: -(RING + 1),
		borderWidth: RING
	}
})
