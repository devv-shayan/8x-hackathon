import { useEffect, useState, type RefObject } from 'react'
import { Platform, StyleSheet, TextInput, View } from 'react-native'
import Animated, {
	ReduceMotion,
	ZoomIn,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated'
import { useTheme } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { Durations, shake } from '@/lib/motion'
import { FocusRing, NO_SYSTEM_OUTLINE } from './FocusRing'
import { Text } from './Text'

export const CODE_LENGTH = 6
/** Caret blink half-period, ms — a touch slower than the system caret, so it reads as deliberate. */
const BLINK = 530

const digitIn = ZoomIn.duration(Durations.fast).reduceMotion(ReduceMotion.System)

/**
 * Six boxes drawn over ONE invisible TextInput spanning the row.
 *
 * The single input is what makes autofill and paste correct: iOS's one-time
 * code suggestion, Android's SMS retriever, a pasted code and plain typing all
 * change one native value — no distributing digits across six inputs, no
 * per-box focus juggling, no native/JS desync. Do not split it back into six
 * inputs.
 *
 * Editing happens at the tail (type to append, backspace to delete). The active
 * box carries a custom caret; a wrong code shakes the row with a warning
 * haptic and paints the boxes in the error colour until the next keystroke.
 */
export function CodeInput({
	value,
	onChange,
	inputRef,
	disabled,
	error,
	accessibilityLabel = 'Six-digit code'
}: {
	value: string
	onChange: (next: string) => void
	inputRef?: RefObject<TextInput | null>
	disabled?: boolean
	/** Flip to true to shake and colour the row; clear it on the next change. */
	error?: boolean
	accessibilityLabel?: string
}) {
	const { colors: c, isDark, radii } = useTheme()
	const [focused, setFocused] = useState(false)
	const active = Math.min(value.length, CODE_LENGTH - 1)

	const x = useSharedValue(0)
	useEffect(() => {
		if (!error) return
		haptic.warning()
		x.value = shake()
	}, [error, x])
	const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

	return (
		<Animated.View style={[s.row, row]}>
			{Array.from({ length: CODE_LENGTH }, (_, i) => {
				const digit = value[i] ?? ''
				const isActive = focused && !disabled && i === active && value.length < CODE_LENGTH
				const border = error ? c.errorText : isActive || digit ? c.textPrimary : c.borderActive
				const radius = Math.min(radii.input, 16)
				return (
					<View
						key={i}
						style={[
							s.box,
							{ borderRadius: radius, borderColor: border, backgroundColor: c.surface }
						]}
					>
						{isActive && !error ? <FocusRing radius={radius} /> : null}
						{digit ? (
							<Animated.View entering={digitIn}>
								<Text variant="number" style={s.digit}>
									{digit}
								</Text>
							</Animated.View>
						) : isActive ? (
							<Caret color={c.textPrimary} />
						) : null}
					</View>
				)
			})}
			<TextInput
				ref={inputRef}
				value={value}
				onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				editable={!disabled}
				keyboardType="number-pad"
				keyboardAppearance={isDark ? 'dark' : 'light'}
				textContentType="oneTimeCode"
				autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
				maxLength={CODE_LENGTH}
				caretHidden
				accessibilityLabel={accessibilityLabel}
				// 0.02, not 0: UIKit skips hit-testing views under 0.01 opacity.
				style={[s.hidden, NO_SYSTEM_OUTLINE]}
			/>
		</Animated.View>
	)
}

function Caret({ color }: { color: string }) {
	const reduceMotion = useReducedMotion()
	const on = useSharedValue(1)
	useEffect(() => {
		if (reduceMotion) return
		on.value = withRepeat(
			withSequence(withTiming(0, { duration: BLINK }), withTiming(1, { duration: BLINK })),
			-1,
			false
		)
	}, [on, reduceMotion])
	const style = useAnimatedStyle(() => ({ opacity: on.value }))
	return <Animated.View pointerEvents="none" style={[s.caret, { backgroundColor: color }, style]} />
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', gap: 8 },
	box: { flex: 1, height: 58, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
	digit: { fontSize: 24, lineHeight: 30 },
	caret: { width: 2, height: 24, borderRadius: 1 },
	hidden: { ...StyleSheet.absoluteFillObject, opacity: 0.02, color: 'transparent' }
})
