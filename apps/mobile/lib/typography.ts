/**
 * Typography — the role scale from packages/brand, as React Native styles.
 *
 * Two families per preset: `display` (dusk: Source Serif 4, daylight:
 * Bricolage Grotesque) for headlines, and `text` (Inter) for everything the
 * user operates. Each family is loaded as separate files per weight, so a
 * weight must become a family NAME: Android silently falls back to the system
 * font when it sees a custom fontFamily with a fontWeight. familyFor() and the
 * Text component do that mapping.
 *
 *   <Text variant="h1">…</Text>                    (preferred)
 *   <Text style={[Type.h1, { color: c.textPrimary }]}>…</Text>
 *
 * The names in packages/brand (theme.fonts.*.files) must match the keys
 * registered in lib/fonts.ts.
 */
import type { TextStyle } from 'react-native'
import { theme, type FontGroup, type TypeRole, type TypeSpec } from '@app/brand'

const WEIGHTS = [400, 500, 600, 700, 800] as const

function numericWeight(weight?: string | number | null): number {
	if (weight === 'bold') return 700
	if (weight === 'normal' || weight == null) return 400
	const n = Number(weight)
	return Number.isFinite(n) ? n : 400
}

/**
 * The registered font family for a weight in a group, using the nearest
 * weight the preset actually loads (ties go heavier).
 */
export function familyFor(group: FontGroup, weight?: string | number | null): string {
	const files = theme.fonts[group].files
	const want = numericWeight(weight)
	let best = WEIGHTS.find((w) => files[w]) ?? 400
	for (const w of WEIGHTS) {
		if (!files[w]) continue
		if (
			Math.abs(w - want) < Math.abs(best - want) ||
			(Math.abs(w - want) === Math.abs(best - want) && w > best)
		) {
			best = w
		}
	}
	return files[best] ?? files[400] ?? 'System'
}

/** fontWeight → the Inter (text) family. Kept for existing call sites. */
export function weightToFamily(weight?: string | number | null): string {
	return familyFor('text', weight)
}

/** RN style for one role: family, size, line height, tracking in points. */
export function typeStyle(spec: TypeSpec): TextStyle {
	return {
		fontFamily: familyFor(spec.family, spec.weight),
		fontSize: spec.size,
		lineHeight: spec.lineHeight,
		letterSpacing: Math.round(spec.tracking * spec.size * 100) / 100,
		...(spec.uppercase && { textTransform: 'uppercase' as const }),
		...(spec.tabular && { fontVariant: ['tabular-nums' as const] })
	}
}

/** The role scale for the active preset. Apply a colour in the consuming style. */
export const Type = Object.fromEntries(
	(Object.keys(theme.type) as TypeRole[]).map((role) => [role, typeStyle(theme.type[role])])
) as Record<TypeRole, TextStyle>

/** Tabular figures — on every number that can change (prices, counters, timers). */
export const numericStyle: TextStyle = { fontVariant: ['tabular-nums'] }
