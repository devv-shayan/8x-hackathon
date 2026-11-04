import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { PIXEL_FIELDS } from '@app/pixel'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { formatTimestamp } from '@/lib/formatTimestamp'

/** Where the strip is: its blocks take the colours of that screen's pixel background. */
export type StripScene = 'explain' | 'class' | 'warm_up'

/** Each scene's tones, mid first, then darker, then lighter: the backgrounds' own palettes. */
const TONES: Record<StripScene, readonly [string, string, string]> = {
	explain: tones(PIXEL_FIELDS.voiceWaves.palette, [1, 0, 2]),
	class: tones(PIXEL_FIELDS.goldDrift.palette, [1, 0, 2]),
	warm_up: tones(PIXEL_FIELDS.tunnel.palette, [3, 2, 4])
}

function tones(palette: readonly string[], [mid, dark, light]: [number, number, number]) {
	return [palette[mid]!, palette[dark]!, palette[light]!] as const
}

/** One block, and the space under it: the backgrounds' square pixels, at the sheet's scale. */
const CELL = 3
const GAP = 1
/** The tallest column, in blocks: an odd number, so a column has a middle block. */
const MAX_BLOCKS = 7

/**
 * While recording: a red dot and the time, then the live wave as columns of pixel blocks,
 * newest on the right, and an optional control at the end (explain's stop button).
 */
export function RecordingStrip({
	seconds,
	levels,
	bars,
	scene,
	end
}: {
	seconds: number
	/** Recent loudness, 0–1, oldest first. */
	levels: number[]
	bars: number
	scene: StripScene
	end?: ReactNode
}) {
	const { colors: c } = useTheme()
	const [mid, dark, light] = TONES[scene]
	return (
		<View
			style={s.strip}
			accessibilityRole="progressbar"
			accessibilityLabel={`Recording, ${Math.round(seconds)} seconds`}
		>
			<View style={s.timer}>
				<View style={[s.dot, { backgroundColor: c.error }]} />
				<Text variant="eyebrow">{formatTimestamp(Math.floor(seconds))}</Text>
			</View>
			<View style={s.wave} accessibilityElementsHidden>
				{Array.from({ length: bars }, (_, i) => {
					const level = levels[i - (bars - levels.length)]
					if (level === undefined) {
						return (
							<View key={i} style={s.column}>
								<View style={[s.cell, { backgroundColor: c.surface3 }]} />
							</View>
						)
					}
					// 1, 3, 5 or 7 blocks, centred, louder is taller.
					const half = Math.round(level * ((MAX_BLOCKS - 1) / 2))
					return (
						<View key={i} style={s.column}>
							{Array.from({ length: half * 2 + 1 }, (_, k) => {
								const away = Math.abs(k - half)
								// The middle in the mid tone, its neighbours dithered with the dark one
								// from column to column, and the ends light, as the backgrounds shade.
								const colour = away === 0 ? mid : away === 1 ? (i % 2 ? dark : mid) : light
								return <View key={k} style={[s.cell, { backgroundColor: colour }]} />
							})}
						</View>
					)
				})}
			</View>
			{end}
		</View>
	)
}

const s = StyleSheet.create({
	strip: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
	timer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	dot: { width: 8, height: 8, borderRadius: 4 },
	wave: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		height: MAX_BLOCKS * CELL + (MAX_BLOCKS - 1) * GAP
	},
	column: { gap: GAP, alignItems: 'center' },
	cell: { width: CELL, height: CELL }
})
