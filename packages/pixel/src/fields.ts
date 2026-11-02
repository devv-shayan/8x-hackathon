import { createFbm } from './noise'
import type { Field } from './dither'

// The landing page's generative backgrounds, one per section, each named for what it shows.
//
// These palettes are illustration colours for the pixel art, not UI tokens: each is a ramp
// from shadow to highlight that a dither steps through. UI colour still comes from
// packages/brand and the landing tokens in landing.css.

const fbm = createFbm()
const square = (v: number) => v * v

/** Warm-up rings: where each starts, as a share of width and height. */
const RIPPLE_SOURCES = [
	[0.18, 0.3],
	[0.42, 0.78],
	[0.7, 0.25],
	[0.9, 0.7]
] as const
/** Seconds one ripple takes to spread and fade. */
const RIPPLE_PERIOD = 4.5

export const PIXEL_FIELDS = {
	/** Explain: warped wave bands, like a voice explaining out loud. */
	voiceWaves: {
		palette: ['#3f6b22', '#7fb342', '#c3e35a', '#eef9a6', '#fbffe9'],
		cell: 4,
		field: ((x, y, t, aspect) => {
			const warp = fbm(x * 1.5, y * 1.5, t * 0.15)
			const wave =
				Math.sin(x * aspect * 9 + t * 1.1 + warp * 3.2) * Math.sin(y * 5 - t * 0.6 + warp * 2)
			return 0.5 + 0.38 * wave + 0.12 * fbm(x * 4, y * 4, t * 0.3)
		}) satisfies Field
	},
	/** Teach the class: slow gold noise, brighter to the right. */
	goldDrift: {
		palette: ['#8a5a10', '#c98d1c', '#e8b84a', '#f6dc8d', '#fff3cc'],
		cell: 5,
		field: ((x, y, t) =>
			0.5 +
			0.55 * fbm(x * 2.2 + t * 0.06, y * 1.6 - t * 0.04, t * 0.18) +
			0.18 * (x - 0.5)) satisfies Field
	},
	/** See what stuck: rings spreading out like gaps coming back, each one brighter. */
	warmUpRipples: {
		palette: ['#7a1e34', '#b8324a', '#e3593a', '#f6a15b', '#ffd9a8'],
		cell: 4,
		field: ((x, y, t, aspect) => {
			let value = 0.42 + 0.35 * fbm(x * 1.8, y * 1.4, t * 0.12)
			RIPPLE_SOURCES.forEach(([sx, sy], i) => {
				const phase = ((t + i * 1.1) % RIPPLE_PERIOD) / RIPPLE_PERIOD
				const distance = Math.hypot((x - sx) * aspect, y - sy)
				value += Math.exp(-square((distance - phase * 1.1) * 18)) * (1 - phase) * (0.35 + 0.15 * i)
			})
			return value
		}) satisfies Field
	},
	/** The black band: lime rings pulling inward, set right so the text on the left stays clear. */
	tunnel: {
		palette: ['#0b0b0b', '#171c0c', '#3c4a10', '#9fba18', '#f7fe62'],
		cell: 4,
		field: ((x, y, t, aspect) => {
			const dx = (x - 0.72) * aspect
			const dy = y - 0.55
			const r = Math.sqrt(dx * dx + dy * dy) + 0.02
			const angle = Math.atan2(dy, dx)
			const depth = 0.35 / r + t * 0.45
			const ring =
				0.5 +
				0.5 * Math.sin(depth * 9 + fbm(Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, t * 0.2) * 3)
			const nearCentre = Math.min(1, r * 2.2)
			const leftQuiet = Math.min(1, Math.max(0.25, (x - 0.05) * 1.6))
			return (
				0.03 +
				ring * nearCentre * 0.85 * (0.6 + 0.4 * fbm(angle * 1.2, depth * 0.5, t * 0.1)) * leftQuiet
			)
		}) satisfies Field
	},
	/** The closing band: lime noise whose edges break into moving blocks. */
	limeEdges: {
		palette: ['#a9c41a', '#d7ef5a', '#f1fb7a', '#fbffd0', '#ffffff'],
		cell: 6,
		field: ((x, y, t) => {
			const edge = Math.min(x, 1 - x, y, 1 - y)
			const value = 0.48 + 0.4 * fbm(x * 2 + t * 0.05, y * 1.5, t * 0.15)
			return value + Math.max(0, 0.12 - edge) * -3.5 * (1 + 0.5 * Math.sin(t * 1.5 + x * 20))
		}) satisfies Field
	},
	/** Maya's card, in her orange. */
	maya: {
		palette: ['#2a1a12', '#7a3a18', '#d4671f', '#f19a4f', '#ffd2a8'],
		cell: 4,
		field: ((x, y, t) => 0.35 + 0.5 * fbm(x * 2, y * 2, t * 0.15) + 0.3 * (x - 0.3)) satisfies Field
	},
	/** Omar's card, in his violet. */
	omar: {
		palette: ['#3b2f7a', '#7c5cff', '#a99bff', '#d9d2ff', '#f4f1ff'],
		cell: 4,
		field: ((x, y, t) =>
			0.55 + 0.5 * fbm(x * 2 + 3, y * 2, t * 0.15) - 0.25 * (1 - y)) satisfies Field
	}
} as const

export type PixelFieldName = keyof typeof PIXEL_FIELDS
