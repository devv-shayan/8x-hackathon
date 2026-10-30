import { useState, type ReactNode, type RefObject } from 'react'
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { familyFor } from '@/lib/typography'
import { Text } from './Text'

interface TextInputFieldProps extends Omit<TextInputProps, 'style'> {
	label?: string
	/** Shown under the field in the error colour; also marks the field invalid. */
	error?: string | null
	/** Shown under the field when there is no error. */
	hint?: string
	/** A leading icon; receives the colour to draw in. */
	icon?: (color: string) => ReactNode
	inputRef?: RefObject<TextInput | null>
}

/**
 * A labelled text field on the well colour. Focus draws the accent border;
 * an error draws the error border and says what is wrong beneath it. The
 * keyboard follows the active scheme.
 */
export default function TextInputField({
	label,
	error,
	hint,
	icon,
	inputRef,
	onFocus,
	onBlur,
	...props
}: TextInputFieldProps) {
	const { colors: c, radii, isDark } = useTheme()
	const [focused, setFocused] = useState(false)
	const border = error ? c.errorText : focused ? c.brandInk : c.borderSoft

	return (
		<View style={s.wrap}>
			{label ? (
				<Text variant="eyebrow" tone="secondary">
					{label}
				</Text>
			) : null}
			<View
				style={[
					s.field,
					{
						backgroundColor: c.well,
						borderColor: border,
						borderWidth: focused || error ? 1.5 : 1,
						borderRadius: radii.input
					}
				]}
			>
				{icon ? icon(focused ? c.brandInk : c.textTertiary) : null}
				<TextInput
					ref={inputRef}
					placeholderTextColor={c.textTertiary}
					selectionColor={c.brandInk}
					cursorColor={c.brandInk}
					keyboardAppearance={isDark ? 'dark' : 'light'}
					style={[s.input, { color: c.textPrimary, fontFamily: familyFor('text', 400) }]}
					onFocus={(e) => {
						setFocused(true)
						onFocus?.(e)
					}}
					onBlur={(e) => {
						setFocused(false)
						onBlur?.(e)
					}}
					accessibilityLabel={props.accessibilityLabel ?? label}
					{...props}
				/>
			</View>
			{error ? (
				<Text variant="caption" tone="error" accessibilityLiveRegion="polite">
					{error}
				</Text>
			) : hint ? (
				<Text variant="caption" tone="tertiary">
					{hint}
				</Text>
			) : null}
		</View>
	)
}

const s = StyleSheet.create({
	wrap: { gap: 8 },
	field: {
		minHeight: 52,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingHorizontal: 16
	},
	input: { flex: 1, fontSize: 16, paddingVertical: 12, includeFontPadding: false }
})
