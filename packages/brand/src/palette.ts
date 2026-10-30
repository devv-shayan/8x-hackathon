/**
 * Palette builder: authored neutrals from a preset's scheme spec + the one
 * accent hex from brand.config → a complete role-typed Palette.
 *
 * Every accent role is DERIVED here, with contrast enforced by construction,
 * so a play that changes the accent never has to hand-pick a tint. The
 * contrast test (`__tests__/contrast.test.ts`) then proves it for all four
 * palettes across a spread of accents.
 */

import {
	composite,
	contrast,
	ensureContrast,
	luminance,
	mostContrasting,
	shiftLightness,
	toHex,
	withAlpha
} from './color'
import type { Palette, PresetName, SchemeSpec } from './types'

/** WCAG 2.2 AA for normal text. */
export const AA = 4.5
/** WCAG 2.2 non-text contrast (focus rings, essential boundaries). */
export const AA_NON_TEXT = 3
/**
 * What derivations aim for: AA plus a hair of margin, so a derived colour
 * never lands exactly on the 4.5 line (the tests still assert plain AA).
 */
const DERIVE_TARGET = AA + 0.05

/**
 * Text colour for a fill: whichever of the preset's ink and paper contrasts
 * more; if neither reaches AA (only possible for mid-tone fills), pure
 * black/white, of which one always clears 4.58:1.
 */
export function onColor(fill: string, onFill: SchemeSpec['onFill']): string {
	const best = mostContrasting(fill, [onFill.ink, onFill.paper])
	if (contrast(best, fill) >= AA) return best
	return mostContrasting(fill, ['#000000', '#ffffff'])
}

/** Two gradient stops around `fill`, compressed until `on` passes on both. */
function gradientAround(fill: string, on: string): readonly [string, string] {
	for (let d = 0.04; d > 0; d -= 0.005) {
		const from = shiftLightness(fill, d)
		const to = shiftLightness(fill, -d)
		if (contrast(on, from) >= DERIVE_TARGET && contrast(on, to) >= DERIVE_TARGET) {
			return [from, to] as const
		}
	}
	return [fill, fill] as const
}

export function buildPalette(
	preset: PresetName,
	spec: SchemeSpec,
	accent: string,
	art: { scrim: string; ink: string }
): Palette {
	const dark = spec.scheme === 'dark'
	const away = dark ? 'lighten' : 'darken'
	const { bg, well, surface, surface2, surface3 } = spec.ground
	const grounds = [bg, well, surface, surface2, surface3]
	const t = spec.text
	const A = spec.alpha

	// ── Accent ────────────────────────────────────────────────────────────────
	const brandFill = toHex(accent)
	const onBrand = onColor(brandFill, spec.onFill)
	// Hover moves the fill away from its text colour, so contrast only rises.
	const brandFillHover = shiftLightness(
		brandFill,
		luminance(onBrand) > luminance(brandFill) ? -0.045 : 0.045
	)
	const brandDim = withAlpha(brandFill, A.brandDim)
	// Accent text has to read on every ground AND on its own dim chip.
	const brandInk = ensureContrast(
		brandFill,
		[...grounds, ...grounds.map((g) => composite(brandDim, g))],
		DERIVE_TARGET,
		away
	)

	// ── Semantic ──────────────────────────────────────────────────────────────
	const semantic = (key: keyof SchemeSpec['semantic']) => {
		const { solid, text } = spec.semantic[key]
		return {
			[key]: solid,
			[`on${key[0]!.toUpperCase()}${key.slice(1)}`]: onColor(solid, spec.onFill),
			[`${key}Soft`]: withAlpha(solid, A.semanticSoft),
			[`${key}Border`]: withAlpha(solid, A.semanticBorder),
			[`${key}Text`]: text
		}
	}

	return {
		preset,
		scheme: spec.scheme,
		name: spec.name,

		bg,
		bgFade: withAlpha(bg, 0),
		well,
		surface,
		surface2,
		surface3,

		textPrimary: t.primary,
		textBody: t.body,
		textSecondary: t.secondary,
		textTertiary: t.tertiary,
		textDisabled: t.disabled,
		textInverse: dark ? bg : surface,

		borderHairline: withAlpha(t.primary, A.hairline),
		borderSoft: withAlpha(t.primary, A.soft),
		borderActive: withAlpha(t.primary, A.active),
		borderFocus: brandInk,
		borderGlass: withAlpha('#ffffff', A.glass),

		brandFill,
		brandFillHover,
		brandInk,
		onBrand,
		brandDim,
		brandBorder: withAlpha(brandInk, A.brandBorder),
		brandGlow: withAlpha(brandFill, A.brandGlow),
		brandGradient: gradientAround(brandFill, onBrand),

		...(semantic('success') as Pick<
			Palette,
			'success' | 'onSuccess' | 'successSoft' | 'successBorder' | 'successText'
		>),
		...(semantic('warning') as Pick<
			Palette,
			'warning' | 'onWarning' | 'warningSoft' | 'warningBorder' | 'warningText'
		>),
		...(semantic('error') as Pick<
			Palette,
			'error' | 'onError' | 'errorSoft' | 'errorBorder' | 'errorText'
		>),
		...(semantic('info') as Pick<
			Palette,
			'info' | 'onInfo' | 'infoSoft' | 'infoBorder' | 'infoText'
		>),

		overlay: withAlpha(spec.shadowTint, A.overlay),
		scrim: withAlpha(bg, A.scrim),
		artScrim: art.scrim,
		inkOnArt: art.ink,
		tintTrack: withAlpha(t.primary, A.track),
		shimmer: dark ? surface2 : surface3,
		shimmerSweep: withAlpha(dark ? t.primary : '#ffffff', A.shimmerSweep),
		shadowTint: spec.shadowTint,
		blurTint: dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight',
		glassTint: withAlpha(dark ? well : surface, A.glassTint),
		glassFallback: dark ? well : surface,
		statusBarStyle: dark ? 'light' : 'dark',

		hero: spec.hero.bg,
		heroText: spec.hero.text,
		heroTextSecondary: spec.hero.textSecondary,
		heroBorder: withAlpha(spec.hero.text, 0.14),
		heroBrandInk: ensureContrast(brandFill, [spec.hero.bg], DERIVE_TARGET, 'lighten')
	}
}
