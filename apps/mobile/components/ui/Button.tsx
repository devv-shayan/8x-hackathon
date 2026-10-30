import type { ReactNode } from 'react'
import {
	ActivityIndicator,
	StyleSheet,
	View,
	type GestureResponderEvent,
	type PressableProps,
	type StyleProp,
	type ViewStyle
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowRight } from 'lucide-react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { useTheme } from '@/contexts/ThemeContext'
import type { HapticMeaning } from '@/lib/haptics'
import { Text } from './Text'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: 50, lg: 56 }
const PAD_X: Record<ButtonSize, number> = { sm: 16, md: 22, lg: 26 }
const FONT: Record<ButtonSize, number> = { sm: 14, md: 15, lg: 16 }
const ARROW = 40

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
	label: string
	variant?: ButtonVariant
	size?: ButtonSize
	loading?: boolean
	fullWidth?: boolean
	/** The arrow-circle end cap (primary, lg): the hero CTA. */
	withArrow?: boolean
	/** A leading icon, drawn in the label colour. */
	icon?: (color: string) => ReactNode
	/**
	 * Keep a disabled button tappable and call this instead — for the refusal
	 * shake ("tell me what's missing") rather than a dead control.
	 */
	onDisabledPress?: () => void
	/** Defaults to 'press' for primary, none for the rest. */
	haptic?: HapticMeaning | false
	style?: StyleProp<ViewStyle>
}

/**
 * The button. Primary is the brand fill (its gradient) with the AA text colour
 * derived for it; secondary is the accent tint; outline, ghost and destructive
 * are quiet. Disabled is a calm well-coloured pill, not a faded brand button.
 * Loading keeps the button's size and swaps the label for a spinner.
 */
export function Button({
	label,
	variant = 'primary',
	size = 'md',
	loading = false,
	fullWidth = false,
	withArrow = false,
	icon,
	disabled,
	onDisabledPress,
	onPress,
	haptic,
	style,
	accessibilityLabel,
	...rest
}: ButtonProps) {
	const { colors: c, radii, elevation } = useTheme()
	const inert = !!disabled && !loading
	const height = HEIGHT[size]
	const radius = Math.min(radii.button, height / 2)
	const arrow = withArrow && size === 'lg'

	const look = inert
		? { bg: c.well, border: c.borderHairline, text: c.textTertiary }
		: {
				primary: { bg: c.brandFill, border: 'transparent', text: c.onBrand },
				secondary: { bg: c.brandDim, border: c.brandBorder, text: c.brandInk },
				outline: { bg: 'transparent', border: c.borderActive, text: c.textPrimary },
				ghost: { bg: 'transparent', border: 'transparent', text: c.textSecondary },
				destructive: { bg: c.errorSoft, border: c.errorBorder, text: c.errorText }
			}[variant]

	const filled = variant === 'primary' && !inert

	function handlePress(e: GestureResponderEvent) {
		if (loading) return
		if (inert) {
			onDisabledPress?.()
			return
		}
		onPress?.(e)
	}

	return (
		<PressableScale
			{...rest}
			onPress={handlePress}
			disabled={(inert && !onDisabledPress) || loading}
			haptic={haptic ?? (variant === 'primary' && !inert ? 'press' : false)}
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityState={{ disabled: inert, busy: loading }}
			style={[
				s.base,
				{
					height,
					borderRadius: radius,
					backgroundColor: look.bg,
					borderColor: look.border,
					paddingLeft: arrow ? PAD_X.lg + 2 : PAD_X[size],
					paddingRight: arrow ? (height - ARROW) / 2 : PAD_X[size],
					alignSelf: fullWidth ? 'stretch' : 'flex-start',
					justifyContent: arrow ? 'space-between' : 'center'
				},
				filled && elevation.cta,
				style
			]}
		>
			{filled ? (
				<LinearGradient
					colors={c.brandGradient}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
				/>
			) : null}

			<View style={[s.content, loading && s.hidden]}>
				{icon ? icon(look.text) : null}
				<Text
					variant="label"
					numberOfLines={1}
					style={{ color: look.text, fontSize: FONT[size] }}
					maxFontSizeMultiplier={1.3}
				>
					{label}
				</Text>
			</View>

			{arrow ? (
				<View
					style={[
						s.arrow,
						{ backgroundColor: inert ? c.surface3 : c.onBrand },
						loading && s.hidden
					]}
				>
					<ArrowRight size={18} strokeWidth={2.2} color={inert ? c.textTertiary : c.brandFill} />
				</View>
			) : null}

			{loading ? (
				<View style={[StyleSheet.absoluteFill, s.center]} pointerEvents="none">
					<ActivityIndicator size="small" color={look.text} />
				</View>
			) : null}
		</PressableScale>
	)
}

const s = StyleSheet.create({
	base: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: StyleSheet.hairlineWidth
	},
	content: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
	arrow: {
		width: ARROW,
		height: ARROW,
		borderRadius: ARROW / 2,
		alignItems: 'center',
		justifyContent: 'center'
	},
	center: { alignItems: 'center', justifyContent: 'center' },
	hidden: { opacity: 0 }
})
