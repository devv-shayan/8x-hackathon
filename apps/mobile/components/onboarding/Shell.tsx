import { useEffect, useRef, useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import Animated, {
	FadeIn,
	FadeOut,
	ReduceMotion,
	interpolate,
	interpolateColor,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	type SharedValue
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronLeft } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { Durations, Timings, shake } from '@/lib/motion'

/** A second tap on the CTA inside this window is ignored (no double-submits). */
const DOUBLE_TAP_GUARD_MS = 1000
/** Height of the fade that lets content scroll under the floating CTA. */
const FADE = 56
const DOT = 6
const DOT_ACTIVE = 22

const hintIn = FadeIn.duration(Durations.fast).reduceMotion(ReduceMotion.System)
const hintOut = FadeOut.duration(Durations.exit).reduceMotion(ReduceMotion.System)

/**
 * The frame every onboarding step sits in: back and skip in a top bar with the
 * progress dots between them, the step's content, and a floating CTA that the
 * content scrolls under (through a fade to the ground, never a hard edge).
 *
 * The CTA refuses rather than going dead: tapped while the step isn't
 * answered, it shakes, ticks the warning haptic and says what is missing. A
 * second tap within a second is ignored, so a fast double tap can't submit
 * twice or skip a step.
 */
export function OnboardingShell({
	step,
	total,
	onBack,
	onSkip,
	cta,
	children
}: {
	/** 0-based. */
	step: number
	total: number
	onBack?: () => void
	onSkip?: () => void
	cta: {
		label: string
		onPress: () => void
		loading?: boolean
		/** Set while the step can't continue; the CTA then refuses with this message. */
		refusal?: string | null
	}
	children: ReactNode
}) {
	const insets = useSafeAreaInsets()
	const { colors: c, layout } = useTheme()
	const [ctaH, setCtaH] = useState(0)
	const [hint, setHint] = useState<string | null>(null)
	const lastTap = useRef(0)
	const x = useSharedValue(0)

	// The hint belongs to the refusal it explains.
	useEffect(() => {
		if (!cta.refusal) setHint(null)
	}, [cta.refusal])

	const ctaStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

	function press() {
		const now = Date.now()
		if (now - lastTap.current < DOUBLE_TAP_GUARD_MS) return
		lastTap.current = now
		cta.onPress()
	}

	function refuse() {
		haptic.warning()
		x.value = shake()
		setHint(cta.refusal ?? null)
	}

	return (
		<View style={[s.root, { backgroundColor: c.bg }]}>
			<View style={[s.bar, { paddingTop: insets.top + 6, paddingHorizontal: layout.gutter - 4 }]}>
				<View style={s.side}>
					{onBack ? (
						<IconButton
							onPress={onBack}
							accessibilityLabel="Back"
							icon={(color) => <ChevronLeft size={22} color={color} strokeWidth={2} />}
						/>
					) : null}
				</View>
				<ProgressDots step={step} total={total} />
				<View style={[s.side, s.right]}>
					{onSkip ? (
						<Button label="Skip" variant="ghost" size="sm" onPress={onSkip} haptic="select" />
					) : null}
				</View>
			</View>

			<KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<ScrollView
					style={s.flex}
					contentContainerStyle={[
						s.content,
						{ paddingHorizontal: layout.gutterWide, paddingBottom: ctaH + FADE }
					]}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					{children}
				</ScrollView>

				<View
					pointerEvents="box-none"
					style={s.dock}
					onLayout={(e) => setCtaH(e.nativeEvent.layout.height)}
				>
					<LinearGradient pointerEvents="none" colors={[c.bgFade, c.bg]} style={{ height: FADE }} />
					<View
						style={[
							s.ctaWrap,
							{
								backgroundColor: c.bg,
								paddingHorizontal: layout.gutterWide,
								paddingBottom: insets.bottom + 16
							}
						]}
					>
						{hint ? (
							<Animated.View entering={hintIn} exiting={hintOut}>
								<Text
									variant="bodySm"
									tone="warning"
									style={s.hint}
									accessibilityLiveRegion="polite"
								>
									{hint}
								</Text>
							</Animated.View>
						) : null}
						<Animated.View style={ctaStyle}>
							<Button
								label={cta.label}
								size="lg"
								withArrow
								fullWidth
								loading={cta.loading}
								disabled={!!cta.refusal}
								onDisabledPress={refuse}
								onPress={press}
							/>
						</Animated.View>
					</View>
				</View>
			</KeyboardAvoidingView>
		</View>
	)
}

/**
 * All the dots are driven by ONE value (the step), so neighbours ease
 * together: width by distance from the current step, colour filling in as the
 * step is reached (and staying filled once passed).
 */
function ProgressDots({ step, total }: { step: number; total: number }) {
	const progress = useSharedValue(step)
	useEffect(() => {
		progress.value = withTiming(step, Timings.base)
	}, [step, progress])
	return (
		<View
			style={s.dots}
			accessibilityRole="progressbar"
			accessibilityLabel={`Step ${step + 1} of ${total}`}
		>
			{Array.from({ length: total }, (_, i) => (
				<Dot key={i} index={i} progress={progress} />
			))}
		</View>
	)
}

function Dot({ index, progress }: { index: number; progress: SharedValue<number> }) {
	const { colors: c } = useTheme()
	const style = useAnimatedStyle(() => {
		const distance = Math.abs(progress.value - index)
		const reached = interpolate(progress.value, [index - 1, index], [0, 1], 'clamp')
		return {
			width: interpolate(distance, [0, 1], [DOT_ACTIVE, DOT], 'clamp'),
			backgroundColor: interpolateColor(reached, [0, 1], [c.borderActive, c.brandInk])
		}
	})
	return <Animated.View style={[s.dot, style]} />
}

const s = StyleSheet.create({
	root: { flex: 1 },
	flex: { flex: 1 },
	bar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
	side: { width: 88, justifyContent: 'center' },
	right: { alignItems: 'flex-end' },
	dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
	dot: { height: DOT, borderRadius: DOT / 2 },
	content: { paddingTop: 20, gap: 24 },
	dock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
	ctaWrap: { gap: 10 },
	hint: { textAlign: 'center' }
})
