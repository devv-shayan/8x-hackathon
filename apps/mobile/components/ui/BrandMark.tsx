import { StyleSheet, View } from 'react-native'
import { useColors } from '@/contexts/ThemeContext'
import { APP_NAME } from '@/lib/constants'
import { Text } from './Text'

/** The website's mark: a 3x3 block of pixels with one lime cell, a student's raised hand. */
const CELLS = ['ink', 'ink', 'ink', 'ink', 'off', 'off', 'ink', 'ink', 'lime'] as const
const CELL = 6
const GAP = 1

/** The mark and the name, in ink, or in paper with `light` on a dark background. */
export function BrandMark({ light = false }: { light?: boolean }) {
	const c = useColors()
	const ink = light ? c.heroText : c.textPrimary
	return (
		<View style={s.row} accessibilityRole="text" accessibilityLabel={APP_NAME}>
			<View style={s.grid}>
				{CELLS.map((cell, i) => (
					<View
						key={i}
						style={[
							s.cell,
							cell === 'ink' && { backgroundColor: ink },
							cell === 'lime' && { backgroundColor: c.brandFill, borderWidth: 1, borderColor: ink }
						]}
					/>
				))}
			</View>
			<Text variant="label" style={{ color: ink }}>
				{APP_NAME.toLowerCase()}
			</Text>
		</View>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	grid: { width: CELL * 3 + GAP * 2, flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
	cell: { width: CELL, height: CELL }
})
