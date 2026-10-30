/**
 * The stored appearance preference: follow the OS, or pin light / dark.
 *
 * Kept out of ThemeContext so the root layout can PRELOAD it alongside fonts,
 * i18n and the session while the splash is still up. Without that, the first
 * frame paints in the default scheme and then snaps to the user's choice — a
 * flash of the wrong world on every cold start.
 *
 * Nothing stored means the preset's own scheme (dusk opens dark, daylight
 * opens light); the choice is only persisted once the user makes one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'app:themePref:v1'

let cached: ThemePref | null = null
let loaded = false

const isPref = (v: unknown): v is ThemePref => v === 'system' || v === 'light' || v === 'dark'

/** The stored preference if it has been read this launch (null = none chosen yet). */
export function cachedThemePref(): ThemePref | null {
	return cached
}

/** Read the stored preference once per launch. Never throws. */
export async function loadThemePref(): Promise<ThemePref | null> {
	if (loaded) return cached
	try {
		const raw = await AsyncStorage.getItem(KEY)
		cached = isPref(raw) ? raw : null
	} catch {
		cached = null
	}
	loaded = true
	return cached
}

/** Persist a choice. A write that fails still applies for this session. */
export async function saveThemePref(pref: ThemePref): Promise<void> {
	cached = pref
	loaded = true
	try {
		await AsyncStorage.setItem(KEY, pref)
	} catch {
		// Non-fatal: the in-memory value holds until the next launch.
	}
}
