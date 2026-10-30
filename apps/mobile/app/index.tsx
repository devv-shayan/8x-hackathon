/**
 * Welcome — the first thing a new person sees. One promise, a glimpse of the
 * product, one way forward.
 *
 * 🎨 REPLACE: the tagline and description come from lib/constants.ts; the
 * three preview cards below are sample UI standing in for your product's own
 * first screen. Swap their content (or the whole stack) for a real glimpse of
 * your app — it rebrands with the preset either way.
 */
import { useEffect } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
	FadeInDown,
	ReduceMotion,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import { Check, Sparkles } from 'lucide-react-native'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { Button } from '@/components/ui/Button'
import { Glow, LogoMark, ProgressBar } from '@/components/ui/Marks'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/lib/constants'
import { Durations, Easings, Springs } from '@/lib/motion'
import { makeStyles } from '@/lib/themedStyles'

/** Delay between the cards being dealt, ms. */
const DEAL_STEP = 90
/** Delay between headline words, ms. */
const WORD_STEP = 45
/** Half a float cycle, ms: slow enough to read as breathing, not bobbing. */
const FLOAT = 2200

export default function WelcomeScreen() {
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const { layout } = useTheme()
	const s = useStyles()
	const words = APP_TAGLINE.split(' ')
	const copyBase = words.length * WORD_STEP + 120

	return (
		<View style={s.root}>
			<Glow size={width * 1.5} strength={1.2} style={[s.glow, { left: -width * 0.25 }]} />

			<View style={[s.top, { paddingTop: insets.top + 12, paddingHorizontal: layout.gutterWide }]}>
				<LogoMark name={APP_NAME} size={32} />
				<Text variant="label">{APP_NAME}</Text>
			</View>

			<View style={s.stage}>
				<DealtCards />
			</View>

			<View style={[s.copy, { paddingHorizontal: layout.gutterWide }]}>
				<View style={s.headline} accessibilityRole="header" accessibilityLabel={APP_TAGLINE}>
					{words.map((word, i) => (
						<Animated.View
							key={`${word}-${i}`}
							entering={FadeInDown.delay(260 + i * WORD_STEP)
								.duration(Durations.enter)
								.easing(Easings.out)
								.reduceMotion(ReduceMotion.System)}
						>
							<Text variant="display">{word} </Text>
						</Animated.View>
					))}
				</View>
				<FadeSlideIn index={0} base={copyBase}>
					<Text variant="lead" tone="secondary">
						{APP_DESCRIPTION}
					</Text>
				</FadeSlideIn>
			</View>

			<FadeSlideIn
				index={1}
				base={copyBase}
				style={[
					s.actions,
					{ paddingBottom: insets.bottom + 16, paddingHorizontal: layout.gutterWide }
				]}
			>
				<Button
					label="Get started"
					size="lg"
					withArrow
					fullWidth
					onPress={() => router.push('/(auth)/login')}
				/>
				<Button
					label="I already have an account"
					variant="ghost"
					fullWidth
					onPress={() => router.push('/(auth)/login')}
				/>
				<Text variant="caption" tone="tertiary" style={s.legal}>
					By continuing you agree to the{' '}
					<Text
						variant="caption"
						tone="secondary"
						style={s.link}
						onPress={() => router.push('/terms')}
						accessibilityRole="link"
					>
						Terms
					</Text>{' '}
					and{' '}
					<Text
						variant="caption"
						tone="secondary"
						style={s.link}
						onPress={() => router.push('/privacy')}
						accessibilityRole="link"
					>
						Privacy Policy
					</Text>
					.
				</Text>
			</FadeSlideIn>
		</View>
	)
}

// ─── Dealt cards ──────────────────────────────────────────────────────────────
// Three cards dealt onto the table on the gentle spring, then left breathing.

const CARDS = [
	{ rotate: -8, x: -46, y: -52, z: 1 },
	{ rotate: 6, x: 42, y: -8, z: 2 },
	{ rotate: -2, x: -6, y: 56, z: 3 }
] as const

function DealtCards() {
	const s = useStyles()
	const { colors: c } = useTheme()
	return (
		<View
			style={s.deck}
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
		>
			<DealtCard index={0}>
				<Text variant="eyebrow" tone="tertiary">
					This week
				</Text>
				<Text variant="number" style={s.bigNumber}>
					24
				</Text>
				<Text variant="caption" tone="secondary">
					items moved forward
				</Text>
			</DealtCard>
			<DealtCard index={1}>
				<View style={s.row}>
					<View style={[s.chip, { backgroundColor: c.successSoft }]}>
						<Check size={16} color={c.successText} strokeWidth={2.4} />
					</View>
					<View style={s.flex}>
						<Text variant="label">Morning review</Text>
						<Text variant="caption" tone="secondary">
							Done · 8:40
						</Text>
					</View>
				</View>
			</DealtCard>
			<DealtCard index={2}>
				<View style={s.row}>
					<View style={[s.chip, { backgroundColor: c.brandDim }]}>
						<Sparkles size={16} color={c.brandInk} strokeWidth={2} />
					</View>
					<View style={s.flex}>
						<Text variant="label">Your first project</Text>
						<Text variant="caption" tone="secondary">
							3 of 5 steps
						</Text>
					</View>
				</View>
				<ProgressBar value={0.62} />
			</DealtCard>
		</View>
	)
}

function DealtCard({ index, children }: { index: number; children: React.ReactNode }) {
	const s = useStyles()
	const reduceMotion = useReducedMotion()
	const pose = CARDS[index] ?? CARDS[0]
	const dealt = useSharedValue(reduceMotion ? 1 : 0)
	const float = useSharedValue(0)

	useEffect(() => {
		if (reduceMotion) {
			dealt.value = 1
			return
		}
		dealt.value = withDelay(index * DEAL_STEP, withSpring(1, Springs.gentle))
		float.value = withDelay(
			900 + index * 400,
			withRepeat(
				withSequence(
					withTiming(1, { duration: FLOAT, easing: Easings.inOut }),
					withTiming(0, { duration: FLOAT, easing: Easings.inOut })
				),
				-1,
				false
			)
		)
	}, [dealt, float, index, reduceMotion])

	const style = useAnimatedStyle(() => ({
		opacity: Math.min(1, dealt.value * 1.4),
		transform: [
			{ translateX: pose.x },
			{ translateY: pose.y - (1 - dealt.value) * 60 - float.value * 5 },
			{ rotate: `${pose.rotate * dealt.value}deg` },
			{ scale: 0.9 + dealt.value * 0.1 }
		]
	}))

	return <Animated.View style={[s.card, { zIndex: pose.z }, style]}>{children}</Animated.View>
}

const useStyles = makeStyles((c, t) => ({
	root: { flex: 1, backgroundColor: c.bg },
	glow: { position: 'absolute', top: -80 },
	top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	stage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 220 },
	deck: { width: 260, height: 200, alignItems: 'center', justifyContent: 'center' },
	card: {
		position: 'absolute',
		width: 236,
		gap: 10,
		padding: 16,
		borderRadius: t.radii.card,
		backgroundColor: c.surface2,
		borderColor: c.borderHairline,
		borderWidth: StyleSheet.hairlineWidth,
		...t.elevation.raised
	},
	row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	chip: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
	flex: { flex: 1 },
	bigNumber: { marginTop: -2 },
	copy: { gap: 14, paddingBottom: 24 },
	headline: { flexDirection: 'row', flexWrap: 'wrap' },
	actions: { gap: 6 },
	legal: { textAlign: 'center', marginTop: 8 },
	link: { textDecorationLine: 'underline' }
}))
