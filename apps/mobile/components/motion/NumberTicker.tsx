import { useEffect, useRef, useState } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import type { TypeRole } from '@app/brand'
import { Text, type TextTone } from '@/components/ui/Text'
import { Durations } from '@/lib/motion'

const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * A number that ticks to its new value instead of jumping, in tabular figures
 * so the digits never shift width mid-count. With Reduce Motion on it simply
 * shows the new value.
 */
export function NumberTicker({
	value,
	format = (n) => Math.round(n).toLocaleString(),
	duration = Durations.slow,
	variant = 'number',
	tone,
	style,
	accessibilityLabel
}: {
	value: number
	format?: (n: number) => string
	duration?: number
	variant?: TypeRole
	tone?: TextTone
	style?: StyleProp<TextStyle>
	accessibilityLabel?: string
}) {
	const reduceMotion = useReducedMotion()
	const [shown, setShown] = useState(value)
	const from = useRef(value)
	const frame = useRef<number | null>(null)

	useEffect(() => {
		if (reduceMotion || from.current === value) {
			from.current = value
			setShown(value)
			return
		}
		const start = from.current
		const began = Date.now()
		const step = () => {
			const t = Math.min(1, (Date.now() - began) / duration)
			const next = start + (value - start) * easeOut(t)
			setShown(next)
			if (t < 1) frame.current = requestAnimationFrame(step)
			else from.current = value
		}
		frame.current = requestAnimationFrame(step)
		return () => {
			if (frame.current !== null) cancelAnimationFrame(frame.current)
			from.current = value
		}
	}, [value, duration, reduceMotion])

	return (
		<Text
			variant={variant}
			tone={tone}
			tabular
			style={style}
			accessibilityLabel={accessibilityLabel ?? format(value)}
		>
			{format(shown)}
		</Text>
	)
}
