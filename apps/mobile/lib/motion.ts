/**
 * Motion language — springs, easings, durations and the staggered entrance,
 * read from the active preset (dusk is calm, daylight is crisp). Import from
 * here instead of tuning a spring per screen.
 *
 * Grammar
 *   Press      every tappable springs to PRESS.button (cards PRESS.card) on
 *              Springs.snappy, with a meaning-named haptic (lib/haptics).
 *   Entrances  enter(i) down the screen, capped stagger. Never on a pushed
 *              screen's title — the navigation transition IS the entrance, and
 *              nested entering animations flash on pop.
 *   Sheets     short fade-rise on Timings.modalIn / modalOut; no springy push.
 *   Lists      layoutTransition for inserts and removals.
 *   Reduced    every spring and timing carries ReduceMotion.System, so the OS
 *   motion     setting turns movement into an instant change; check
 *              useReducedMotion() where a loop or a sequence needs a calmer
 *              fallback of its own.
 */
import {
	Easing,
	FadeIn,
	FadeInDown,
	FadeOut,
	LinearTransition,
	ReduceMotion,
	withSequence,
	withTiming,
	type WithSpringConfig,
	type WithTimingConfig
} from 'react-native-reanimated'
import { Platform } from 'react-native'
import { theme, type SpringSpec } from '@app/brand'

export { useReducedMotion } from 'react-native-reanimated'

const m = theme.motion

const spring = (s: SpringSpec): WithSpringConfig => ({ ...s, reduceMotion: ReduceMotion.System })

/** Named springs. snappy: taps, toggles · smooth: sheets, lens · gentle: big calm moves · settle: snap-backs. */
export const Springs = {
	snappy: spring(m.springs.snappy),
	smooth: spring(m.springs.smooth),
	gentle: spring(m.springs.gentle),
	settle: spring(m.springs.settle)
} satisfies Record<string, WithSpringConfig>

/** Decisive curves — never linear. */
export const Easings = {
	out: Easing.bezier(...m.easing.out),
	inOut: Easing.bezier(...m.easing.inOut),
	in: Easing.bezier(...m.easing.in)
}
export const EASE_OUT = Easings.out
export const EASE_IN_OUT = Easings.inOut

export const Durations = m.duration

/** Press-in scale targets. */
export const PRESS = m.press

const timing = (duration: number, easing = Easings.out): WithTimingConfig => ({
	duration,
	easing,
	reduceMotion: ReduceMotion.System
})

export const Timings = {
	fast: timing(m.duration.fast),
	base: timing(m.duration.base),
	slow: timing(m.duration.slow, Easings.inOut),
	modalIn: timing(m.duration.modalIn),
	modalOut: timing(m.duration.modalOut, Easings.in)
} satisfies Record<string, WithTimingConfig>

/**
 * Staggered entrance for block `index` down a screen:
 *
 *   <Animated.View entering={enter(0)}>…title…</Animated.View>
 *   <Animated.View entering={enter(1)}>…body…</Animated.View>
 *
 * The stagger step and cap come from the preset; `base` offsets a group that
 * arrives after something else.
 */
export function enter(index = 0, opts?: { base?: number; step?: number; duration?: number }) {
	const delay = (opts?.base ?? 0) + Math.min(index, m.stagger.cap) * (opts?.step ?? m.stagger.step)
	const fadeUp = FadeInDown.delay(delay)
		.duration(opts?.duration ?? m.duration.enter)
		.easing(Easings.out)
		.reduceMotion(ReduceMotion.System)
	// The preset's rise distance, on native. Reanimated's web renderer treats an
	// entering animation with custom initial values as a custom animation and
	// pins the element at its first measured position when it ends, so content
	// that reflows later overlaps; the web keeps the stock FadeInDown rise.
	return Platform.OS === 'web'
		? fadeUp
		: fadeUp.withInitialValues({ opacity: 0, transform: [{ translateY: m.stagger.distance }] })
}

/** A plain fade for decorative layers (glows, grain) that should arrive last. */
export function fade(delay = 0, duration = m.duration.slow) {
	return FadeIn.delay(delay)
		.duration(duration)
		.easing(Easings.out)
		.reduceMotion(ReduceMotion.System)
}

/** The matching exit. */
export function exitFade(duration = m.duration.exit) {
	return FadeOut.duration(duration).easing(Easings.in).reduceMotion(ReduceMotion.System)
}

/** Layout transition for lists: items slide into place on the smooth spring. */
export const layoutTransition = LinearTransition.springify()
	.damping(m.springs.smooth.damping)
	.stiffness(m.springs.smooth.stiffness)
	.mass(m.springs.smooth.mass)
	.reduceMotion(ReduceMotion.System)

/**
 * The refusal shake (disabled CTA tapped, wrong code): assign to a
 * translateX shared value and pair with haptic.warning().
 *
 *   x.value = shake()
 */
export function shake(distance = 6) {
	const step = timing(60)
	return withSequence(
		withTiming(-distance, step),
		withTiming(distance, step),
		withTiming(-distance * 0.66, step),
		withTiming(0, step)
	)
}
