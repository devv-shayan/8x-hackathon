import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { ShimmerWord } from '@/components/memory/ShimmerWord'
import { useTheme } from '@/contexts/ThemeContext'

/** Faint enough that nothing on top of it has to compete. */
const RESTING = 0.1
const LIFT = 0.34
/** A right answer lights the whole field for a moment. */
const FLASH = 0.26
const ROWS = 16
const WORDS_PER_ROW = 3
const TILT = '-7deg'
/** Only every so many words moves: a screenful of moving letters would drop frames. */
const MOVING_EVERY = 7
const STAGGER_MS = 420
const CALM_DAYS = 2

/** Shown while the quiz loads, before there are the person's own ideas to show. */
const FALLBACK_WORDS = ['teach', 'recall', 'explain', 'remember', 'understand', 'chalk']

/**
 * The quiz's background: rows of the person's own ideas in faint chalk, with light running
 * through a few of them letter by letter, the way it does on Maya's memory. Decoration only,
 * so screen readers skip it. With Reduce Motion on, ShimmerWord holds still.
 */
export const ShimmerField = memo(function ShimmerField({
	words,
	flash
}: {
	words: readonly string[]
	flash: boolean
}) {
	const { colors: c } = useTheme()
	const source = words.length > 0 ? words : FALLBACK_WORDS
	const color = flash ? c.brandFill : c.heroText
	const solid = flash ? FLASH : RESTING

	return (
		<View
			style={s.field}
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			aria-hidden
		>
			<View style={s.tilted}>
				{Array.from({ length: ROWS }, (_, row) => (
					<View key={row} style={s.row}>
						{Array.from({ length: WORDS_PER_ROW }, (_, column) => {
							const at = row * WORDS_PER_ROW + column
							return (
								<ShimmerWord
									key={column}
									text={source[(at + row) % source.length] as string}
									solid={solid}
									daysLeft={at % MOVING_EVERY === 0 ? CALM_DAYS : null}
									lift={LIFT}
									startDelayMs={(at % ROWS) * STAGGER_MS}
									textStyle={[s.word, { color }]}
								/>
							)
						})}
					</View>
				))}
			</View>
		</View>
	)
})

const s = StyleSheet.create({
	field: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
	tilted: {
		position: 'absolute',
		top: -40,
		left: -60,
		width: 1400,
		gap: 2,
		transform: [{ rotate: TILT }]
	},
	row: { flexDirection: 'row', gap: 18 },
	word: { fontSize: 42, lineHeight: 48 }
})
