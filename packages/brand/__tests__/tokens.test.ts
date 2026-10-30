/**
 * The colour maths and the web output the rest of the package stands on.
 */

import { describe, expect, it } from '@jest/globals'
import {
	brandCss,
	buildTheme,
	colorRoles,
	composite,
	contrast,
	ensureContrast,
	fromOklch,
	mix,
	parseColor,
	toOklch,
	withAlpha
} from '../index'
import { webPreset } from '../src/tailwind'

describe('colour maths', () => {
	it('parses hex and rgb() forms', () => {
		expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 })
		expect(parseColor('#11223380').a).toBeCloseTo(0.5, 2)
		expect(parseColor('rgba(1, 2, 3, 0.4)')).toEqual({ r: 1, g: 2, b: 3, a: 0.4 })
		expect(parseColor('rgb(1 2 3 / 0.4)')).toEqual({ r: 1, g: 2, b: 3, a: 0.4 })
		expect(() => parseColor('teal')).toThrow()
	})

	it('matches WCAG reference ratios', () => {
		expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
		expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
		expect(contrast('#ffffff', '#ffffff')).toBe(1)
	})

	it('composites translucent colours before measuring', () => {
		expect(composite('rgba(0,0,0,0.5)', '#ffffff')).toBe('#808080')
		expect(contrast(withAlpha('#000000', 0.5), '#ffffff')).toBeCloseTo(
			contrast('#808080', '#ffffff'),
			5
		)
	})

	it('round-trips OKLCH', () => {
		for (const hex of ['#5fccf9', '#fbab2f', '#090f1e', '#f3f0e9', '#c3292e']) {
			expect(fromOklch(toOklch(hex))).toBe(hex)
		}
	})

	it('mixes perceptually and clamps t', () => {
		expect(mix('#000000', '#ffffff', 0)).toBe('#000000')
		expect(mix('#000000', '#ffffff', 2)).toBe('#ffffff')
	})

	it('ensureContrast keeps the hue and reaches the target', () => {
		const out = ensureContrast('#fbab2f', ['#f3f0e9'], 4.5, 'darken')
		expect(contrast(out, '#f3f0e9')).toBeGreaterThanOrEqual(4.5)
		expect(Math.abs(toOklch(out).h - toOklch('#fbab2f').h)).toBeLessThan(8)
	})
})

describe('web output', () => {
	const t = buildTheme('dusk')

	it('emits a variable for every colour role in both schemes', () => {
		const css = brandCss(t)
		for (const role of colorRoles(t.palettes.dark)) {
			const name = role.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
			expect(css).toContain(`--c-${name}:`)
		}
		expect(css).toContain('[data-preset="dusk"][data-scheme="dark"]')
		expect(css).toContain('[data-preset="dusk"][data-scheme="light"]')
		expect(css).toContain('--font-display:')
		expect(css).toContain('--shadow-card:')
	})

	it('points every Tailwind colour at a variable the CSS defines', () => {
		const css = brandCss(t)
		const colors = webPreset(t.palettes.dark).theme.extend.colors
		for (const value of Object.values(colors)) {
			const name = /var\(--c-([a-z0-9-]+)\)/.exec(value)?.[1]
			expect(name).toBeDefined()
			expect(css).toContain(`--c-${name}:`)
		}
	})

	it('changes only the accent roles when the accent changes', () => {
		const a = buildTheme('daylight').palettes.light
		const b = buildTheme('daylight', '#3b82f6').palettes.light
		expect(b.bg).toBe(a.bg)
		expect(b.textPrimary).toBe(a.textPrimary)
		expect(b.brandFill).not.toBe(a.brandFill)
	})
})
