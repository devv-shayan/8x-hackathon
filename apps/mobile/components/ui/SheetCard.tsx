import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/contexts/ThemeContext'

/** The gap between the sheet and the screen's edges. The sheet radius is 55 less this. */
const INSET = 8
const PAD_TOP = 24
const PAD_X = 20
const PAD_BOTTOM = 20

/**
 * The white card that holds a screen's content over its pixel background: inset from the
 * sides and the bottom, its corners concentric with the phone's, and clear of the home
 * indicator. Put it last in a column that fills the screen, so it sits at the bottom and the
 * background shows above it.
 */
export function SheetCard({
	children,
	style
}: {
	children: ReactNode
	style?: StyleProp<ViewStyle>
}) {
	const { colors: c, radii } = useTheme()
	const insets = useSafeAreaInsets()
	return (
		<View
			style={[
				s.sheet,
				{
					backgroundColor: c.surface,
					borderRadius: radii.sheet,
					paddingBottom: Math.max(PAD_BOTTOM, insets.bottom + PAD_BOTTOM - INSET * 2)
				},
				style
			]}
		>
			{children}
		</View>
	)
}

const s = StyleSheet.create({
	sheet: { margin: INSET, marginTop: 0, paddingTop: PAD_TOP, paddingHorizontal: PAD_X }
})
