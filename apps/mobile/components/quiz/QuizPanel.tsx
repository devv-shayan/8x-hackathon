import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'
import { withAlpha } from '@app/brand'
import { FIGURE_COLOURS, type Rgb } from '@app/pixel'
import { useTheme } from '@/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/motion'

const BLUR = 40
/** Smoke over the blur, so white text holds up over the brightest part of a glow. */
const SMOKE = 0.42
const EDGE_WIDTH = 1
const DRIFT_PX = 14
const DRIFT_MS = 7000

function toHex([r, g, b]: Rgb) {
	return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** A soft ball of light that drifts slowly. It is what gives the glass something to catch. */
function Orb({
	color,
	size,
	opacity,
	place,
	delayMs
}: {
	color: string
	size: number
	opacity: number
	place: ViewStyle
	delayMs: number
}) {
	const id = useId()
	const reduced = useReducedMotion()
	const drift = useRef(new Animated.Value(0)).current

	useEffect(() => {
		if (reduced) return
		const step = (toValue: number) =>
			Animated.timing(drift, {
				toValue,
				duration: DRIFT_MS,
				easing: Easing.inOut(Easing.sin),
				useNativeDriver: true
			})
		const loop = Animated.loop(Animated.sequence([step(1), step(0)]))
		const start = setTimeout(() => loop.start(), delayMs)
		return () => {
			clearTimeout(start)
			loop.stop()
		}
	}, [delayMs, drift, reduced])

	const offset = drift.interpolate({ inputRange: [0, 1], outputRange: [-DRIFT_PX, DRIFT_PX] })
	return (
		<Animated.View
			pointerEvents="none"
			style={[
				s.orb,
				place,
				{ width: size, height: size, transform: [{ translateX: offset }, { translateY: offset }] }
			]}
		>
			<Svg width={size} height={size}>
				<Defs>
					<RadialGradient id={id} cx="50%" cy="50%" r="50%">
						<Stop offset="0" stopColor={color} stopOpacity={opacity} />
						<Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.45} />
						<Stop offset="1" stopColor={color} stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<Rect width={size} height={size} fill={`url(#${id})`} />
			</Svg>
		</Animated.View>
	)
}

/** The diagonal sheen across the glass, and its edge, brightest where the corners catch light. */
function Sheen({ width, height, radius }: { width: number; height: number; radius: number }) {
	const { colors: c } = useTheme()
	const sheenId = useId()
	const edgeId = useId()
	const inset = EDGE_WIDTH / 2
	const shape = { rx: radius, ry: radius }
	return (
		<View pointerEvents="none" style={StyleSheet.absoluteFill}>
			<Svg width={width} height={height}>
				<Defs>
					<LinearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
						<Stop offset="0" stopColor={c.heroText} stopOpacity={0.18} />
						<Stop offset="0.45" stopColor={c.heroText} stopOpacity={0.05} />
						<Stop offset="1" stopColor={c.heroText} stopOpacity={0.11} />
					</LinearGradient>
					<LinearGradient id={edgeId} x1="0" y1="0" x2="1" y2="1">
						<Stop offset="0" stopColor={c.heroText} stopOpacity={0.7} />
						<Stop offset="0.5" stopColor={c.heroText} stopOpacity={0.14} />
						<Stop offset="1" stopColor={c.heroText} stopOpacity={0.45} />
					</LinearGradient>
				</Defs>
				<Rect width={width} height={height} {...shape} fill={`url(#${sheenId})`} />
				<Rect
					x={inset}
					y={inset}
					width={width - EDGE_WIDTH}
					height={height - EDGE_WIDTH}
					{...shape}
					fill="none"
					stroke={`url(#${edgeId})`}
					strokeWidth={EDGE_WIDTH}
				/>
			</Svg>
		</View>
	)
}

/**
 * A pane of smoky frosted glass for what the quiz says outside a question, with soft light
 * behind it in the students' colours: glass needs something bright to catch, and the black
 * backdrop has nothing. The glow doesn't depend on the blur, so a device that blurs weakly
 * still looks right. `blurTarget` is what Android blurs (a BlurTargetView).
 */
export function QuizPanel({
	children,
	blurTarget
}: {
	children: ReactNode
	blurTarget?: RefObject<View | null>
}) {
	const { colors: c, radii } = useTheme()
	const [size, setSize] = useState({ width: 0, height: 0 })
	const radius = radii['4xl']
	return (
		<View
			style={s.panel}
			onLayout={(e) =>
				setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
			}
		>
			<Orb
				color={toHex(FIGURE_COLOURS.omar[2]!)}
				size={300}
				opacity={0.95}
				place={{ top: -110, left: -110 }}
				delayMs={0}
			/>
			<Orb
				color={toHex(FIGURE_COLOURS.maya[2]!)}
				size={320}
				opacity={0.9}
				place={{ bottom: -120, right: -110 }}
				delayMs={1800}
			/>
			<Orb
				color={c.brandFill}
				size={150}
				opacity={0.45}
				place={{ top: -40, right: -30 }}
				delayMs={900}
			/>
			<View style={[StyleSheet.absoluteFill, s.glass, { borderRadius: radius }]}>
				<BlurView
					intensity={BLUR}
					tint="systemUltraThinMaterialDark"
					blurTarget={blurTarget}
					experimentalBlurMethod="dimezisBlurView"
					style={StyleSheet.absoluteFill}
				/>
				<View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(c.hero, SMOKE) }]} />
			</View>
			{size.width > 0 ? <Sheen width={size.width} height={size.height} radius={radius} /> : null}
			<View style={s.content}>{children}</View>
		</View>
	)
}

const s = StyleSheet.create({
	panel: { alignSelf: 'stretch' },
	orb: { position: 'absolute' },
	glass: { overflow: 'hidden' },
	content: { alignItems: 'center', gap: 14, paddingVertical: 24, paddingHorizontal: 16 }
})
