import type { ReactNode } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { useColors } from '@/contexts/ThemeContext'
import type { HapticMeaning } from '@/lib/haptics'

/**
 * A round, icon-only control (back, close, more). 40pt drawn, 44pt touch
 * target. Icon-only means it must be labelled for screen readers.
 */
export function IconButton({
	icon,
	onPress,
	accessibilityLabel,
	tone = 'surface',
	size = 40,
	haptic = 'select',
	style
}: {
	/** Receives the colour to draw in. */
	icon: (color: string) => ReactNode
	onPress: () => void
	accessibilityLabel: string
	/** surface: on the page. glass: over imagery or the hero surface. */
	tone?: 'surface' | 'glass'
	size?: number
	haptic?: HapticMeaning | false
	style?: StyleProp<ViewStyle>
}) {
	const c = useColors()
	const glass = tone === 'glass'
	return (
		<PressableScale
			onPress={onPress}
			haptic={haptic}
			scaleTo={0.9}
			accessibilityLabel={accessibilityLabel}
			hitSlop={(44 - size) / 2 + 2}
			style={[
				s.base,
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: glass ? c.glassTint : c.surface,
					borderColor: glass ? c.borderGlass : c.borderSoft
				},
				style
			]}
		>
			{icon(glass ? c.inkOnArt : c.textPrimary)}
		</PressableScale>
	)
}

const s = StyleSheet.create({
	base: {
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: StyleSheet.hairlineWidth
	}
})
