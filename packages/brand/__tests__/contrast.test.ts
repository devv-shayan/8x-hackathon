/**
 * Contrast is tested, not eyeballed.
 *
 * For all four palettes (dusk, dawn, daylight, espresso) and for every accent
 * in ACCENTS — each preset's default plus a spread around the hue wheel, light
 * and dark, including the mid-tones that are hardest to put text on — assert
 * WCAG 2.2 AA wherever text meets a ground:
 *
 *   - every text tier on every ground it sits on
 *   - onBrand on brandFill, brandFillHover and both gradient stops
 *   - brandInk on every ground and on its own dim chip
 *   - semantic text on every ground and on its own soft fill; on-colours on solids
 *   - hero and art text on their surfaces; the focus ring at 3:1 on bg
 *
 * A failure prints every offending pair with its ratio.
 */

import { describe, expect, it } from '@jest/globals'
import {
	AA,
	AA_NON_TEXT,
	buildTheme,
	composite,
	contrast,
	type Palette,
	type PresetName,
	type Scheme
} from '../index'

const ACCENTS = [
	'default',
	// Light / luminous
	'#fde047', // lemon
	'#86efac', // mint
	'#7dd3fc', // sky
	'#f9a8d4', // blush
	'#fdba74', // peach
	'#c4b5fd', // lavender
	// Mid-tones — the hardest case for text-on-fill
	'#ef4444', // red
	'#f97316', // orange
	'#22c55e', // green
	'#06b6d4', // cyan
	'#3b82f6', // blue
	'#a855f7', // violet
	'#ec4899', // pink
	'#808080', // neutral grey
	'#0ea5a4', // the pre-preset template teal
	// Deep
	'#7f1d1d', // maroon
	'#14532d', // forest
	'#0f766e', // deep teal
	'#1e3a8a', // navy
	'#581c87', // plum
	// Extremes
	'#ffffff',
	'#000000'
]

const PRESETS: PresetName[] = ['dusk', 'daylight']
const SCHEMES: Scheme[] = ['dark', 'light']

type Check = { label: string; ratio: number; min: number }

function checks(p: Palette): Check[] {
	const grounds = {
		bg: p.bg,
		well: p.well,
		surface: p.surface,
		surface2: p.surface2,
		surface3: p.surface3
	}
	const out: Check[] = []
	const need = (label: string, fg: string, bg: string, min = AA) =>
		out.push({ label, ratio: contrast(fg, bg), min })

	// Text tiers on every ground.
	const tiers = {
		textPrimary: p.textPrimary,
		textBody: p.textBody,
		textSecondary: p.textSecondary,
		textTertiary: p.textTertiary
	}
	for (const [t, fg] of Object.entries(tiers)) {
		for (const [g, bg] of Object.entries(grounds)) need(`${t} on ${g}`, fg, bg)
	}
	need('textInverse on textPrimary', p.textInverse, p.textPrimary)

	// Accent.
	need('onBrand on brandFill', p.onBrand, p.brandFill)
	need('onBrand on brandFillHover', p.onBrand, p.brandFillHover)
	need('onBrand on brandGradient[0]', p.onBrand, p.brandGradient[0])
	need('onBrand on brandGradient[1]', p.onBrand, p.brandGradient[1])
	for (const [g, bg] of Object.entries(grounds)) {
		need(`brandInk on ${g}`, p.brandInk, bg)
		need(`brandInk on brandDim over ${g}`, p.brandInk, composite(p.brandDim, bg))
	}
	need('borderFocus on bg (non-text)', p.borderFocus, p.bg, AA_NON_TEXT)

	// Semantic.
	for (const k of ['success', 'warning', 'error', 'info'] as const) {
		const text = p[`${k}Text`]
		const soft = p[`${k}Soft`]
		const on = p[`on${k[0]!.toUpperCase()}${k.slice(1)}` as `on${Capitalize<typeof k>}`]
		for (const [g, bg] of Object.entries(grounds)) {
			need(`${k}Text on ${g}`, text, bg)
			need(`${k}Text on ${k}Soft over ${g}`, text, composite(soft, bg))
		}
		need(`on${k} on ${k}`, on, p[k])
	}

	// Surfaces that ignore the scheme.
	need('heroText on hero', p.heroText, p.hero)
	need('heroTextSecondary on hero', p.heroTextSecondary, p.hero)
	need('heroBrandInk on hero', p.heroBrandInk, p.hero)
	// Worst case for art: the scrim over a pure-white image.
	need('inkOnArt on artScrim over white', p.inkOnArt, composite(p.artScrim, '#ffffff'))

	return out
}

describe.each(PRESETS)('%s', (preset) => {
	describe.each(SCHEMES)('%s scheme', (scheme) => {
		it.each(ACCENTS)('accent %s: every text pair clears AA', (accent) => {
			const p = buildTheme(preset, accent).palettes[scheme]
			const failures = checks(p)
				.filter((c) => c.ratio < c.min)
				.map((c) => `${c.label}: ${c.ratio.toFixed(2)} < ${c.min}`)
			expect(failures).toEqual([])
		})
	})
})

describe('palette structure', () => {
	it.each(PRESETS.flatMap((pr) => SCHEMES.map((s) => [pr, s] as const)))(
		'%s/%s: text tiers step down in contrast, disabled stays visible',
		(preset, scheme) => {
			const p = buildTheme(preset).palettes[scheme]
			const r = [p.textPrimary, p.textBody, p.textSecondary, p.textTertiary, p.textDisabled].map(
				(t) => contrast(t, p.bg)
			)
			for (let i = 1; i < r.length; i++) expect(r[i]!).toBeLessThan(r[i - 1]!)
			// Disabled is exempt from AA (inactive UI) but must not vanish.
			expect(r[4]!).toBeGreaterThanOrEqual(2)
		}
	)

	it.each(PRESETS)('%s: the hero stays dark in both schemes', (preset) => {
		const t = buildTheme(preset)
		expect(t.palettes.light.hero).toBe(t.palettes.dark.hero)
		expect(contrast('#000000', t.palettes.light.hero)).toBeLessThan(2)
	})

	it.each(PRESETS)('%s: brandFill is exactly the configured accent', (preset) => {
		expect(buildTheme(preset, '#3B82F6').palettes.light.brandFill).toBe('#3b82f6')
		expect(buildTheme(preset, '#3B82F6').palettes.dark.brandFill).toBe('#3b82f6')
	})

	it('rejects an accent that is not a hex', () => {
		expect(() => buildTheme('dusk', 'teal')).toThrow(/accent must be a hex/)
	})
})
