import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from './Text'

/**
 * The small mono label in caps that opens a sheet ("Question 2 of 4"), with an optional
 * right side: a second label, a count, or progress pips.
 */
export function MonoLabel({
	children,
	right,
	style
}: {
	children: string
	right?: ReactNode
	style?: StyleProp<ViewStyle>
}) {
	return (
		<View style={[s.row, style]}>
			<Text variant="eyebrow" tone="secondary" numberOfLines={1} style={s.left}>
				{children}
			</Text>
			{typeof right === 'string' ? (
				<Text variant="eyebrow" tone="secondary" numberOfLines={1}>
					{right}
				</Text>
			) : (
				right
			)}
		</View>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
	left: { flexShrink: 1 }
})
