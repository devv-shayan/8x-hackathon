/**
 * Theme assembly: preset + accent → everything both apps read.
 */

import { daylight } from '../presets/daylight'
import { dusk } from '../presets/dusk'
import { parseColor, withAlpha } from './color'
import { buildPalette } from './palette'
import { layout, space } from './scale'
import type {
	ElevationLevel,
	ElevationSpec,
	NativeShadow,
	Palette,
	Preset,
	PresetName,
	Scheme,
	Theme
} from './types'

export const presets: Record<PresetName, Preset> = { dusk, daylight }

export const SCHEMES: readonly Scheme[] = ['dark', 'light']

function nativeShadow(spec: ElevationSpec, palette: Palette): NativeShadow {
	return {
		shadowColor: palette.shadowTint,
		shadowOffset: { width: 0, height: spec.y },
		shadowOpacity: palette.scheme === 'dark' ? spec.dark : spec.light,
		shadowRadius: spec.blur / 2,
		elevation: spec.android
	}
}

function cssShadow(spec: ElevationSpec, palette: Palette): string {
	const opacity = palette.scheme === 'dark' ? spec.dark : spec.light
	if (opacity === 0) return 'none'
	const tint = withAlpha(palette.shadowTint, opacity)
	return `0 ${spec.y}px ${spec.blur}px ${spec.spread}px ${tint}`
}

function assertAccent(accent: string): string {
	if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent.trim())) {
		throw new Error(
			`@app/brand: accent must be a hex colour like '#3b82f6' (or 'default'), got '${accent}'`
		)
	}
	parseColor(accent)
	return accent.trim().toLowerCase()
}

/**
 * Build the full theme for a preset. `accent` is a hex, or 'default' for the
 * preset's own accent.
 */
export function buildTheme(presetName: PresetName, accent: string = 'default'): Theme {
	const preset = presets[presetName]
	if (!preset) {
		throw new Error(`@app/brand: unknown preset '${presetName}' (use 'dusk' or 'daylight')`)
	}
	const hex = accent === 'default' ? preset.defaultAccent : assertAccent(accent)
	const palettes = {
		dark: buildPalette(preset.name, preset.schemes.dark, hex, preset.art),
		light: buildPalette(preset.name, preset.schemes.light, hex, preset.art)
	}
	const levels = Object.keys(preset.elevation) as ElevationLevel[]
	const perScheme = <T>(fn: (spec: ElevationSpec, p: Palette) => T) =>
		Object.fromEntries(
			SCHEMES.map((s) => [
				s,
				Object.fromEntries(levels.map((l) => [l, fn(preset.elevation[l], palettes[s])]))
			])
		) as Record<Scheme, Record<ElevationLevel, T>>

	return {
		preset: preset.name,
		primaryScheme: preset.primaryScheme,
		accent: hex,
		palettes,
		fonts: preset.fonts,
		type: preset.type,
		radii: preset.radii,
		space,
		layout,
		elevation: perScheme(nativeShadow),
		shadowCss: perScheme(cssShadow),
		motion: preset.motion
	}
}
