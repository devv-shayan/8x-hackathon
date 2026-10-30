/**
 * Tailwind wiring for both apps, derived from the same TS source.
 *
 * Web: every colour, radius, shadow and easing points at a CSS variable that
 * src/css.ts emits, so `bg-surface`, `text-ink`… re-theme with the preset and
 * the scheme with no `dark:` variants.
 *
 * Mobile (NativeWind): React Native has no CSS variables, so the native
 * colours are the active preset's primary-scheme values.
 */

import { colorRoles } from './css'
import { layout } from './scale'
import type { Palette, Theme } from './types'

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

/** A Tailwind colour backed by `--c-<name>` (+ optional `--c-<name>-a`) that honours `/50` modifiers. */
export const cssColor = (name: string) =>
	`rgb(var(--c-${name}) / calc(var(--c-${name}-a, 1) * <alpha-value>))`

/**
 * The web preset. New code should use the role names (`bg-surface2`,
 * `text-ink-secondary`, `bg-brand text-on-brand`, `text-brand-ink`…).
 * The names marked "compat" keep the pre-preset pages rendering until the
 * web restyle moves them onto roles.
 */
export function webPreset(sample: Palette) {
	const roles: Record<string, string> = {}
	for (const role of colorRoles(sample)) roles[kebab(role)] = cssColor(kebab(role))

	const colors: Record<string, string> = {
		...roles,
		// Short role aliases
		well: cssColor('well'),
		ink: cssColor('text-primary'),
		'ink-body': cssColor('text-body'),
		'ink-secondary': cssColor('text-secondary'),
		'ink-tertiary': cssColor('text-tertiary'),
		'ink-disabled': cssColor('text-disabled'),
		'ink-inverse': cssColor('text-inverse'),
		'line-hairline': cssColor('border-hairline'),
		'line-soft': cssColor('border-soft'),
		'line-active': cssColor('border-active'),
		'line-focus': cssColor('border-focus'),
		'line-glass': cssColor('border-glass'),
		brand: cssColor('brand-fill'),
		'brand-hover': cssColor('brand-fill-hover'),
		'brand-from': cssColor('brand-gradient-from'),
		'brand-to': cssColor('brand-gradient-to'),

		// compat — pre-preset names, mapped onto roles
		background: cssColor('bg'),
		'surface-raised': cssColor('surface3'),
		'ink-soft': cssColor('text-secondary'),
		'ink-mute': cssColor('text-tertiary'),
		// Was 2.6:1 (below AA) and used for placeholders; floored at the AA tier.
		'ink-faint': cssColor('text-tertiary'),
		muted: cssColor('text-tertiary'),
		'border-soft': cssColor('border-soft'),
		'border-active': cssColor('border-active'),
		accent: cssColor('brand-fill'),
		'accent-soft': cssColor('brand-fill-hover'),
		'accent-deep': cssColor('brand-ink'),
		'accent-border': cssColor('brand-border'),
		'accent-ghost': cssColor('brand-dim'),
		'accent-glow': cssColor('brand-glow'),
		danger: cssColor('error'),
		'danger-soft': cssColor('error-soft'),
		'success-soft': cssColor('success-soft'),
		'warning-soft': cssColor('warning-soft')
	}

	return {
		theme: {
			extend: {
				colors,
				// Text on grounds must use the AA-adjusted ink, not the raw fill.
				textColor: {
					accent: cssColor('brand-ink'),
					'accent-soft': cssColor('brand-ink'),
					// compat: every `text-background` in the pre-preset pages sits on bg-accent.
					background: cssColor('on-brand'),
					success: cssColor('success-text'),
					warning: cssColor('warning-text'),
					danger: cssColor('error-text'),
					error: cssColor('error-text'),
					info: cssColor('info-text')
				},
				// Visible borders (focus, selected) need ≥ 3:1, which the raw fill may not have.
				borderColor: { DEFAULT: cssColor('border-soft'), accent: cssColor('brand-ink') },
				// The bare `ring` default is set in globals.css (--tw-ring-color): Tailwind
				// cannot parse a var() colour for it and would fall back to its stock blue.
				ringColor: { accent: cssColor('brand-ink') },
				outlineColor: { accent: cssColor('brand-ink') },
				fontFamily: {
					sans: ['var(--font-text)'],
					display: ['var(--font-display)']
				},
				borderRadius: {
					sm: 'var(--radius-sm)',
					md: 'var(--radius-md)',
					lg: 'var(--radius-lg)',
					xl: 'var(--radius-xl)',
					'2xl': 'var(--radius-2xl)',
					'3xl': 'var(--radius-3xl)',
					'4xl': 'var(--radius-4xl)',
					pill: 'var(--radius-pill)',
					button: 'var(--radius-button)',
					input: 'var(--radius-input)',
					chip: 'var(--radius-chip)',
					row: 'var(--radius-row)',
					card: 'var(--radius-card)',
					sheet: 'var(--radius-sheet)'
				},
				boxShadow: {
					soft: 'var(--shadow-soft)',
					card: 'var(--shadow-card)',
					raised: 'var(--shadow-raised)',
					overlay: 'var(--shadow-overlay)',
					cta: 'var(--shadow-cta)',
					// compat
					'card-strong': 'var(--shadow-raised)',
					// Was a coloured halo; now the tinted CTA elevation (no glow halos).
					glow: 'var(--shadow-cta)'
				},
				transitionTimingFunction: {
					DEFAULT: 'var(--ease-out)',
					out: 'var(--ease-out)',
					'in-out': 'var(--ease-in-out)',
					in: 'var(--ease-in)'
				},
				transitionDuration: {
					DEFAULT: 'var(--dur-fast)',
					fast: 'var(--dur-fast)',
					base: 'var(--dur-base)',
					slow: 'var(--dur-slow)'
				},
				maxWidth: { content: `${layout.maxContent}px` }
			}
		},
		plugins: []
	}
}

/**
 * NativeWind colours: the same names as the web preset, resolved to the
 * active preset's primary-scheme values (no CSS variables on native).
 */
export function nativeColors(t: Theme): Record<string, string> {
	const p = t.palettes[t.primaryScheme]
	const out: Record<string, string> = {}
	for (const role of colorRoles(p)) out[kebab(role)] = p[role as keyof Palette] as string
	return {
		...out,
		ink: p.textPrimary,
		'ink-secondary': p.textSecondary,
		'ink-tertiary': p.textTertiary,
		brand: p.brandFill,
		// compat names from the old mobile config
		background: p.bg,
		accent: p.brandInk,
		muted: p.textTertiary
	}
}
