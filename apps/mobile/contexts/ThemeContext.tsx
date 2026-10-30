/**
 * Appearance theming: the preset comes from packages/brand (brand.config.ts),
 * the scheme from the user's preference (system / light / dark).
 *
 * Components never branch on `isDark` to pick a colour — they ask the palette
 * for a role (`colors.surface`, `colors.brandInk`) and the palette knows the
 * scheme. Read it with useTheme() / useColors(), or build styles once per
 * palette with makeStyles / useThemedStyles (lib/themedStyles.ts).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import {
	theme,
	type ElevationLevel,
	type NativeShadow,
	type Palette,
	type PresetName,
	type Scheme,
	type Theme
} from '@app/brand'
import { cachedThemePref, saveThemePref, type ThemePref } from '@/lib/themePref'

export type { ThemePref }

export interface ThemeValue {
	preset: PresetName
	/** What the user chose; the preset's own scheme until they choose. */
	pref: ThemePref
	/** What that resolves to right now. */
	scheme: Scheme
	isDark: boolean
	colors: Palette
	/** Tinted, scheme-aware shadows (spread into a style). */
	elevation: Record<ElevationLevel, NativeShadow>
	type: Theme['type']
	radii: Theme['radii']
	space: Theme['space']
	layout: Theme['layout']
	motion: Theme['motion']
	setPref: (pref: ThemePref) => void
}

function valueFor(pref: ThemePref, scheme: Scheme, setPref: ThemeValue['setPref']): ThemeValue {
	return {
		preset: theme.preset,
		pref,
		scheme,
		isDark: scheme === 'dark',
		colors: theme.palettes[scheme],
		elevation: theme.elevation[scheme],
		type: theme.type,
		radii: theme.radii,
		space: theme.space,
		layout: theme.layout,
		motion: theme.motion,
		setPref
	}
}

// Outside a provider (tests, the error fallback before mount) the preset's own scheme applies.
const ThemeContext = createContext<ThemeValue>(
	valueFor(theme.primaryScheme, theme.primaryScheme, () => {})
)

export function ThemeProvider({ children }: { children: ReactNode }) {
	const system = useColorScheme()
	// The root layout preloads the preference before first paint, so this is
	// already the stored value on mount — no flash.
	const [pref, setPrefState] = useState<ThemePref>(() => cachedThemePref() ?? theme.primaryScheme)

	const setPref = useCallback((next: ThemePref) => {
		setPrefState(next)
		void saveThemePref(next)
	}, [])

	// 'system' follows the OS. Note: app.json's `userInterfaceStyle` must be
	// "automatic" for the OS setting to reach JS; a pinned value reports only that.
	const scheme: Scheme =
		pref === 'system'
			? system === 'light' || system === 'dark'
				? system
				: theme.primaryScheme
			: pref

	const value = useMemo(() => valueFor(pref, scheme, setPref), [pref, scheme, setPref])

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
	return useContext(ThemeContext)
}

/** The palette alone — the common case for inline props like icon colours. */
export function useColors(): Palette {
	return useContext(ThemeContext).colors
}
