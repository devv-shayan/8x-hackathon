/**
 * Web tokens as CSS custom properties, generated from the TS theme at
 * request/build time — there is no second, hand-synced copy to drift.
 *
 * The root layout inlines `brandCss()` in <head> and sets
 * `<html data-preset="…" data-scheme="…">`. Any element can re-scope a
 * section with its own `data-scheme` (e.g. a dark band on a light page).
 *
 * Colours are emitted as channels plus an optional alpha so Tailwind's
 * opacity modifiers keep working:
 *   --c-surface: 18 27 45;          (opaque)
 *   --c-border-soft: 239 242 249;   --c-border-soft-a: 0.11;
 * and the Tailwind preset reads them as
 *   rgb(var(--c-surface) / calc(var(--c-surface-a, 1) * <alpha-value>))
 */

import { alphaOf, toChannels } from './color'
import type { Palette, Scheme, Theme, TypeRole } from './types'
import { SCHEMES } from './theme'

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

/** Every string colour role in a palette, in declaration order. */
export function colorRoles(p: Palette): string[] {
	return (Object.keys(p) as (keyof Palette)[]).filter((k) => {
		const v = p[k]
		return (
			typeof v === 'string' &&
			(v.startsWith('#') || v.startsWith('rgb')) &&
			k !== 'blurTint' &&
			k !== 'statusBarStyle'
		)
	}) as string[]
}

function colorVars(p: Palette): string[] {
	const lines: string[] = []
	const push = (name: string, value: string) => {
		lines.push(`--c-${name}:${toChannels(value)};`)
		const a = alphaOf(value)
		if (a < 1) lines.push(`--c-${name}-a:${a};`)
	}
	for (const role of colorRoles(p)) push(kebab(role), p[role as keyof Palette] as string)
	push('brand-gradient-from', p.brandGradient[0])
	push('brand-gradient-to', p.brandGradient[1])
	return lines
}

const bezier = (b: readonly number[]) => `cubic-bezier(${b.join(',')})`

/** Web font CSS variables set by next/font in the root layout. */
export const WEB_FONT_VARS: Record<string, string> = {
	Inter: '--font-inter',
	'Source Serif 4': '--font-source-serif',
	'Bricolage Grotesque': '--font-bricolage'
}

function presetVars(t: Theme): string[] {
	const family = (group: 'display' | 'text') => {
		const f = t.fonts[group]
		const v = WEB_FONT_VARS[f.name]
		return `${v ? `var(${v}), ` : ''}'${f.name}', ${f.fallback}`
	}
	const lines = [`--font-display:${family('display')};`, `--font-text:${family('text')};`]
	for (const [role, spec] of Object.entries(t.type) as [TypeRole, Theme['type'][TypeRole]][]) {
		const r = kebab(role)
		lines.push(
			`--type-${r}-family:var(--font-${spec.family});`,
			`--type-${r}-weight:${spec.weight};`,
			`--type-${r}-tracking:${spec.tracking}em;`
		)
	}
	for (const [k, v] of Object.entries(t.radii)) lines.push(`--radius-${k}:${v}px;`)
	const m = t.motion
	lines.push(
		`--ease-out:${bezier(m.easing.out)};`,
		`--ease-in-out:${bezier(m.easing.inOut)};`,
		`--ease-in:${bezier(m.easing.in)};`
	)
	for (const [k, v] of Object.entries(m.duration)) lines.push(`--dur-${kebab(k)}:${v}ms;`)
	lines.push(`--stagger-step:${m.stagger.step}ms;`, `--rise:${m.stagger.distance}px;`)
	return lines
}

function schemeBlock(t: Theme, scheme: Scheme): string {
	const p = t.palettes[scheme]
	const sel = `[data-preset="${t.preset}"][data-scheme="${scheme}"],[data-preset="${t.preset}"] [data-scheme="${scheme}"]`
	const shadows = Object.entries(t.shadowCss[scheme]).map(([k, v]) => `--shadow-${k}:${v};`)
	return `${sel}{color-scheme:${scheme};${[...colorVars(p), ...shadows].join('')}}`
}

/** The CSS text for a theme: preset-level variables plus one block per scheme. */
export function brandCss(t: Theme): string {
	const presetBlock = `[data-preset="${t.preset}"]{${presetVars(t).join('')}}`
	return [presetBlock, ...SCHEMES.map((s) => schemeBlock(t, s))].join('\n')
}
