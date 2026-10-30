/**
 * The bridge between StyleSheet and a runtime theme.
 *
 * A module-level `StyleSheet.create({ card: { backgroundColor: SURFACE } })`
 * runs once at import and can never change colour. Wrap the same object in a
 * factory of the palette instead:
 *
 *   const useStyles = makeStyles((c) => ({
 *     card: { backgroundColor: c.surface, borderColor: c.borderSoft },
 *   }))
 *   function Row() {
 *     const s = useStyles()
 *     return <View style={s.card} />
 *   }
 *
 * Each palette's sheet is created once, on first use, and reused — one Map
 * lookup per render, not a StyleSheet.create. useThemedStyles is the inline
 * form for one-off components.
 */
import { useMemo } from 'react'
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import type { Palette } from '@app/brand'
import { useTheme, type ThemeValue } from '@/contexts/ThemeContext'

export { withAlpha } from '@app/brand'

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle }

/** Module-level themed StyleSheet, cached per palette. The factory also gets the full theme. */
export function makeStyles<T extends NamedStyles<T>>(factory: (c: Palette, t: ThemeValue) => T) {
	const cache = new Map<Palette, T>()
	return function useStyles(): T {
		const t = useTheme()
		let sheet = cache.get(t.colors)
		if (!sheet) {
			sheet = StyleSheet.create(factory(t.colors, t))
			cache.set(t.colors, sheet)
		}
		return sheet
	}
}

/** Inline themed StyleSheet, rebuilt only when the palette changes. */
export function useThemedStyles<T extends NamedStyles<T>>(factory: (c: Palette) => T): T {
	const { colors } = useTheme()
	// Keyed on the palette only: the factory is a pure function of it, so its
	// identity changing between renders is irrelevant.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	return useMemo(() => StyleSheet.create(factory(colors)), [colors])
}

/**
 * The same caching for values that are not a StyleSheet — gradient colour
 * arrays, shadow objects, navigation themes.
 */
export function makeThemed<T>(factory: (c: Palette, t: ThemeValue) => T) {
	const cache = new Map<Palette, T>()
	return function useThemed(): T {
		const t = useTheme()
		let v = cache.get(t.colors)
		if (v === undefined) {
			v = factory(t.colors, t)
			cache.set(t.colors, v)
		}
		return v
	}
}
