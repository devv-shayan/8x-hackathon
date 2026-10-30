import {
	Text as RNText,
	StyleSheet,
	type TextProps as RNTextProps,
	type TextStyle
} from 'react-native'
import type { FontGroup, Palette, TypeRole } from '@app/brand'
import { theme } from '@app/brand'
import { useColors } from '@/contexts/ThemeContext'
import { Type, familyFor } from '@/lib/typography'

/** Text colour roles a Text can take by name. */
export type TextTone =
	| 'primary'
	| 'body'
	| 'secondary'
	| 'tertiary'
	| 'disabled'
	| 'inverse'
	| 'brand'
	| 'onBrand'
	| 'success'
	| 'warning'
	| 'error'
	| 'info'

const TONE: Record<TextTone, keyof Palette> = {
	primary: 'textPrimary',
	body: 'textBody',
	secondary: 'textSecondary',
	tertiary: 'textTertiary',
	disabled: 'textDisabled',
	inverse: 'textInverse',
	brand: 'brandInk',
	onBrand: 'onBrand',
	success: 'successText',
	warning: 'warningText',
	error: 'errorText',
	info: 'infoText'
}

export interface TextProps extends RNTextProps {
	/** A role from the preset's type scale (family, weight, size, leading, tracking). */
	variant?: TypeRole
	/** Colour by role. Defaults to 'primary' when a variant is set; a style colour wins. */
	tone?: TextTone
	/** Force tabular figures (on automatically for the `number` role). */
	tabular?: boolean
	/** Which family `fontWeight` maps into. Defaults to the variant's family, else 'text'. */
	family?: FontGroup
}

/**
 * Drop-in replacement for React Native's <Text>, and the only place RN's Text
 * is imported.
 *
 * - `fontWeight` becomes the matching font FAMILY for the preset's loaded
 *   files. Android, given a custom fontFamily plus a fontWeight, looks for a
 *   system variant that does not exist and silently falls back to Roboto.
 * - includeFontPadding is off, so Android and iOS line boxes match.
 * - `variant` applies the role scale and caps OS font scaling at the role's
 *   `maxScale` (display type must not break layout at the largest Dynamic Type
 *   sizes; body text keeps scaling). Pass allowFontScaling or
 *   maxFontSizeMultiplier to override — both are respected.
 * - Numbers: `tabular` (or the `number` role) sets tabular-nums so digits do
 *   not shift width as they change.
 *
 * Existing call sites (style-only, no variant) render exactly as before.
 */
export function Text({
	style,
	variant,
	tone,
	tabular,
	family,
	maxFontSizeMultiplier,
	...props
}: TextProps) {
	const colors = useColors()
	const role = variant ? theme.type[variant] : undefined
	const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle
	const { fontWeight, fontFamily: explicitFamily, ...rest } = flat

	const group = family ?? role?.family ?? 'text'
	const fontFamily = explicitFamily ?? familyFor(group, fontWeight ?? role?.weight)

	const toneKey = tone ?? (variant && rest.color === undefined ? 'primary' : undefined)
	const color = toneKey ? (colors[TONE[toneKey]] as string) : undefined

	const numeric = tabular || role?.tabular
	const fontVariant = numeric
		? Array.from(new Set([...(rest.fontVariant ?? []), 'tabular-nums' as const]))
		: rest.fontVariant

	return (
		<RNText
			maxFontSizeMultiplier={maxFontSizeMultiplier ?? role?.maxScale}
			style={[
				variant ? Type[variant] : null,
				color ? { color } : null,
				rest,
				{ fontFamily, includeFontPadding: false },
				fontVariant ? { fontVariant } : null
			]}
			{...props}
		/>
	)
}
