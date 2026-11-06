import { useState, type ReactNode, type RefObject } from 'react'
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { familyFor } from '@/lib/typography'
import { FocusRing, NO_SYSTEM_OUTLINE } from './FocusRing'
import { Text } from './Text'

const LINE_HEIGHT = 22
const PAD_Y = 14
const SINGLE_LINE_HEIGHT = 52

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
 * A labelled text field, as the website draws one: white with a hairline edge, and on focus
 * an ink border inside a lime ring. An error draws the error border and says what is wrong
 * beneath it. A multiline field is tall enough for its `numberOfLines`, and starts typing at
 * the top. The keyboard follows the active scheme.
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
	const border = error ? c.errorText : focused ? c.textPrimary : c.borderActive
	const lines = props.multiline ? (props.numberOfLines ?? 1) : 1

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
					props.multiline ? s.fieldMultiline : null,
					{
						backgroundColor: c.surface,
						borderColor: border,
						borderRadius: radii.input,
						minHeight: Math.max(SINGLE_LINE_HEIGHT, lines * LINE_HEIGHT + PAD_Y * 2)
					}
				]}
			>
				{focused && !error ? <FocusRing radius={radii.input} /> : null}
				{icon ? icon(focused ? c.textPrimary : c.textTertiary) : null}
				<TextInput
					ref={inputRef}
					placeholderTextColor={c.textTertiary}
					// iOS draws its caret in this colour, Android its highlight, so lime goes only there.
					selectionColor={Platform.OS === 'android' ? c.brandDim : c.textPrimary}
					selectionHandleColor={c.textPrimary}
					cursorColor={c.textPrimary}
					underlineColorAndroid="transparent"
					keyboardAppearance={isDark ? 'dark' : 'light'}
					style={[
						s.input,
						{ color: c.textPrimary, fontFamily: familyFor('text', 400) },
						NO_SYSTEM_OUTLINE
					]}
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
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		borderWidth: 1,
		paddingHorizontal: 16
	},
	fieldMultiline: { alignItems: 'stretch' },
	input: {
		flex: 1,
		fontSize: 16,
		lineHeight: LINE_HEIGHT,
		paddingVertical: PAD_Y,
		includeFontPadding: false,
		textAlignVertical: 'top'
	}
})
