import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * - standard  the everyday card: surface + hairline
 * - raised    one step up the ladder with a tinted shadow; for the card that leads a screen
 * - well      sunken: grouped content inside another surface, inputs, quiet panels
 * - selected  the accent tint and border; a chosen option
 * - hero      the surface that stays dark in both schemes (feature and upgrade panels)
 */
export type CardTier = 'standard' | 'raised' | 'well' | 'selected' | 'hero'

const PADDING = { none: 0, compact: 12, normal: 18, spacious: 24 } as const

interface CardProps extends Omit<ViewProps, 'style'> {
	tier?: CardTier
	padding?: keyof typeof PADDING
	/** Makes the whole card a tappable (springs to .98). */
	onPress?: () => void
	accessibilityLabel?: string
	style?: StyleProp<ViewStyle>
	children?: ReactNode
}

/**
 * Depth comes from the ground ladder first (each tier sits on a lighter or
 * darker step) and shadow second — never shadow alone.
 */
export function Card({
	tier = 'standard',
	padding = 'normal',
	onPress,
	accessibilityLabel,
	style,
	children,
	...rest
}: CardProps) {
	const { colors: c, radii, elevation } = useTheme()
	const pad = PADDING[padding]

	const look: ViewStyle = {
		standard: { backgroundColor: c.surface, borderColor: c.borderHairline },
		raised: { backgroundColor: c.surface2, borderColor: c.borderHairline, ...elevation.card },
		well: { backgroundColor: c.well, borderColor: 'transparent' },
		selected: { backgroundColor: c.brandDim, borderColor: c.brandBorder },
		hero: { backgroundColor: c.hero, borderColor: c.heroBorder, ...elevation.raised }
	}[tier]

	const cardStyle = [s.card, { borderRadius: radii.card, padding: pad }, look, style]

	if (onPress) {
		return (
			<PressableScale
				scaleTo="card"
				haptic="press"
				onPress={onPress}
				accessibilityLabel={accessibilityLabel}
				style={cardStyle}
			>
				{children}
			</PressableScale>
		)
	}
	return (
		<View style={cardStyle} {...rest}>
			{children}
		</View>
	)
}

const s = StyleSheet.create({
	card: { borderWidth: StyleSheet.hairlineWidth }
})
