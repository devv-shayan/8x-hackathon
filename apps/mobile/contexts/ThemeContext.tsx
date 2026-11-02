/**
 * Theming: the preset comes from packages/brand (brand.config.ts), and the
 * scheme is the preset's own. The app has one light look, like the website, so
 * there is no appearance preference and the OS's dark mode doesn't change it.
 *
 * Components never branch on `isDark` to pick a colour — they ask the palette
 * for a role (`colors.surface`, `colors.brandInk`) and the palette knows the
 * scheme. Read it with useTheme() / useColors(), or build styles once per
 * palette with makeStyles / useThemedStyles (lib/themedStyles.ts).
 */
import { createContext, useContext, type ReactNode } from 'react'
import {
	theme,
	type ElevationLevel,
	type NativeShadow,
	type Palette,
	type PresetName,
	type Scheme,
	type Theme
} from '@app/brand'

export interface ThemeValue {
	preset: PresetName
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
}

const scheme = theme.primaryScheme

const value: ThemeValue = {
	preset: theme.preset,
	scheme,
	isDark: scheme === 'dark',
	colors: theme.palettes[scheme],
	elevation: theme.elevation[scheme],
	type: theme.type,
	radii: theme.radii,
	space: theme.space,
	layout: theme.layout,
	motion: theme.motion
}

const ThemeContext = createContext<ThemeValue>(value)

export function ThemeProvider({ children }: { children: ReactNode }) {
	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
	return useContext(ThemeContext)
}

/** The palette alone — the common case for inline props like icon colours. */
export function useColors(): Palette {
	return useContext(ThemeContext).colors
}
