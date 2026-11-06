import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { SceneName } from '@app/pixel'
import { PressableScale } from '@/components/motion/PressableScale'
import { BRAND_MARK_CELLS } from '@/components/ui/BrandMark'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/motion'
import { PixelBackdrop } from './PixelBackdrop'

/** How long each cell of the mark waits before the next one lights. */
const TICK_MS = 180
const CELL = 7
const GAP = 1

/** The 3x3 mark lighting cell by cell, then starting over. Still and whole under Reduce Motion. */
function TickingMark() {
	const { colors: c } = useTheme()
	const still = useReducedMotion()
	const [lit, setLit] = useState(still ? BRAND_MARK_CELLS.length : 1)

	useEffect(() => {
		if (still) return
		const id = setInterval(() => setLit((n) => (n >= BRAND_MARK_CELLS.length ? 1 : n + 1)), TICK_MS)
		return () => clearInterval(id)
	}, [still])

	return (
		<View style={s.mark}>
			{BRAND_MARK_CELLS.map((cell, i) => {
				const on = still || i < lit
				return (
					<View
						key={i}
						style={[
							s.cell,
							!on && { backgroundColor: c.surface3 },
							on && cell === 'ink' && { backgroundColor: c.textPrimary },
							on &&
								cell === 'lime' && {
									backgroundColor: c.brandFill,
									borderWidth: 1,
									borderColor: c.textPrimary
								}
						]}
					/>
				)
			})}
		</View>
	)
}

/**
 * A screen's wait, in the app's own look: the scene's moving background and a small white pill
 * with the mark ticking and one short line. `onBack` adds a Cancel pill, so a slow load can
 * still be left.
 */
export function LoadingScreen({
	label,
	scene = 'explain',
	onBack
}: {
	label: string
	scene?: SceneName
	onBack?: () => void
}) {
	const { colors: c, elevation } = useTheme()
	const insets = useSafeAreaInsets()
	return (
		<View style={s.fill}>
			<PixelBackdrop scene={scene} />
			{onBack ? (
				<View style={[s.top, { top: insets.top + 8 }]} pointerEvents="box-none">
					<PressableScale
						onPress={onBack}
						accessibilityRole="button"
						style={[s.back, { backgroundColor: c.surface }, elevation.soft]}
					>
						<Text variant="label" style={s.backText}>
							Cancel
						</Text>
					</PressableScale>
				</View>
			) : null}
			<View style={s.center} pointerEvents="none">
				<View
					style={[s.pill, { backgroundColor: c.surface }, elevation.soft]}
					accessible
					accessibilityRole="progressbar"
					accessibilityLabel={label}
					accessibilityLiveRegion="polite"
				>
					<TickingMark />
					<Text variant="label">{label}</Text>
				</View>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	top: { position: 'absolute', left: 16, zIndex: 2 },
	back: { height: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center' },
	backText: { fontSize: 15 },
	center: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24
	},
	pill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 18,
		paddingVertical: 12,
		borderRadius: 24
	},
	mark: { width: CELL * 3 + GAP * 2, flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
	cell: { width: CELL, height: CELL }
})
