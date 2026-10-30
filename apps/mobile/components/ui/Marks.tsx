import { useEffect, useId } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { parseColor } from '@app/brand'
import { useTheme } from '@/contexts/ThemeContext'
import { Springs } from '@/lib/motion'
import { Text } from './Text'

/**
 * The app's mark until a play drops in its own: the brand gradient in a
 * rounded square with the name's initial in the AA text colour for it.
 * 🎨 REPLACE with the play's logo (an expo-image of assets/icon.png) once it
 * has one.
 */
export function LogoMark({ name, size = 40 }: { name: string; size?: number }) {
	const { colors: c, elevation } = useTheme()
	const radius = size * 0.3
	return (
		<View
			style={[{ width: size, height: size, borderRadius: radius }, elevation.soft]}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			<LinearGradient
				colors={c.brandGradient}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={[StyleSheet.absoluteFill, s.center, { borderRadius: radius }]}
			>
				<Text
					variant="h3"
					style={{ color: c.onBrand, fontSize: size * 0.46, lineHeight: size * 0.56 }}
					maxFontSizeMultiplier={1}
				>
					{name.charAt(0).toUpperCase()}
				</Text>
			</LinearGradient>
		</View>
	)
}

/** Initials on the accent tint — the person, until they have a photo. */
export function Avatar({ initials, size = 64 }: { initials: string; size?: number }) {
	const c = useTheme().colors
	return (
		<View
			style={[
				s.center,
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: c.brandDim,
					borderColor: c.brandBorder,
					borderWidth: StyleSheet.hairlineWidth
				}
			]}
		>
			<Text
				variant="h3"
				style={{ color: c.brandInk, fontSize: size * 0.36, lineHeight: size * 0.44 }}
				maxFontSizeMultiplier={1}
			>
				{initials}
			</Text>
		</View>
	)
}

/**
 * A determinate progress bar: the empty track, and the accent ink filling it
 * on the smooth spring when the value changes.
 */
export function ProgressBar({
	value,
	height = 6,
	accessibilityLabel
}: {
	/** 0–1 */
	value: number
	height?: number
	accessibilityLabel?: string
}) {
	const c = useTheme().colors
	const v = Math.max(0, Math.min(1, value))
	const fill = useSharedValue(0)
	useEffect(() => {
		fill.value = withSpring(v, Springs.smooth)
	}, [v, fill])
	const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }))
	return (
		<View
			accessibilityRole="progressbar"
			accessibilityLabel={accessibilityLabel}
			accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
			style={[s.track, { height, borderRadius: height / 2, backgroundColor: c.tintTrack }]}
		>
			<Animated.View
				style={[{ height, borderRadius: height / 2, backgroundColor: c.brandInk }, style]}
			/>
		</View>
	)
}

/**
 * A soft radial wash of the accent — atmosphere behind a hero moment, never a
 * halo around a control. Drawn as an SVG gradient so it fades to nothing with
 * no hard edge.
 */
export function Glow({
	size,
	color,
	strength = 1,
	style
}: {
	size: number
	/** Defaults to the palette's brandGlow. */
	color?: string
	/** Scales the colour's own alpha. */
	strength?: number
	style?: StyleProp<ViewStyle>
}) {
	const c = useTheme().colors
	const id = useId().replace(/:/g, '')
	const rgba = parseColor(color ?? c.brandGlow)
	const rgb = `rgb(${rgba.r},${rgba.g},${rgba.b})`
	const alpha = Math.min(1, rgba.a * strength)
	return (
		<View pointerEvents="none" style={[{ width: size, height: size }, style]}>
			<Svg width={size} height={size}>
				<Defs>
					<RadialGradient id={id} cx="50%" cy="50%" r="50%">
						<Stop offset="0" stopColor={rgb} stopOpacity={alpha} />
						<Stop offset="0.55" stopColor={rgb} stopOpacity={alpha * 0.35} />
						<Stop offset="1" stopColor={rgb} stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<Rect width={size} height={size} fill={`url(#${id})`} />
			</Svg>
		</View>
	)
}

const s = StyleSheet.create({
	center: { alignItems: 'center', justifyContent: 'center' },
	track: { width: '100%', overflow: 'hidden' }
})
