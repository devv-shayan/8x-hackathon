import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSpring
} from 'react-native-reanimated'
import { Check, X } from 'lucide-react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { Button } from '@/components/ui/Button'
import { Highlight } from '@/components/ui/Highlight'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Springs, useReducedMotion } from '@/lib/motion'
import { ChalkDust } from './ChalkBurst'
import { StudentFace } from './ClassRow'

const COUNT_STEP_MS = 220
const CARD_STAGGER_MS = 90
const END_PORTRAIT = 72

/** One small card per question, popping in turn: lime for right, dark for wrong. */
function ResultCard({ isRight, index }: { isRight: boolean; index: number }) {
	const { colors: c, radii } = useTheme()
	const scale = useSharedValue(0)
	useEffect(() => {
		scale.value = withDelay(index * CARD_STAGGER_MS, withSpring(1, Springs.snappy))
	}, [scale, index])
	const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
	return (
		<Animated.View
			style={[
				s.result,
				{
					borderRadius: radii.md,
					backgroundColor: isRight ? c.brandFill : c.heroTextSecondary
				},
				motion
			]}
		>
			{isRight ? (
				<Check size={20} color={c.onBrand} strokeWidth={3} />
			) : (
				<X size={20} color={c.onBrand} strokeWidth={3} />
			)}
		</Animated.View>
	)
}

/** The score counts up, then a new best gets the dust and both students cheering. */
export function QuizEnd({
	score,
	total,
	results,
	headline,
	line,
	classWords,
	newBest,
	reminded,
	onRemind,
	onDone
}: {
	score: number
	total: number
	results: readonly boolean[]
	headline: string
	line: string
	classWords: string | null
	newBest: boolean
	reminded: boolean
	onRemind: () => void
	onDone: () => void
}) {
	const { colors: c } = useTheme()
	const reduced = useReducedMotion()
	const [shown, setShown] = useState(reduced ? score : 0)

	useEffect(() => {
		if (shown >= score) return
		const id = setTimeout(() => setShown((n) => n + 1), COUNT_STEP_MS)
		return () => clearTimeout(id)
	}, [shown, score])

	const landed = shown >= score
	const mood = landed && newBest ? 'cheering' : 'waiting'

	return (
		<View style={s.end}>
			<Text variant="eyebrow" style={{ color: c.heroText }}>
				{newBest ? 'Daily quiz · new best' : 'Daily quiz'}
			</Text>
			<View style={s.middle}>
				{landed && newBest ? <ChalkDust /> : null}
				<Text
					variant="displayHero"
					tabular
					accessibilityLabel={`${score} of ${total}`}
					style={s.score}
				>
					<Highlight>{` ${shown} of ${total} `}</Highlight>
				</Text>
				<Text variant="h1" accessibilityRole="header" style={[s.center, { color: c.heroText }]}>
					{headline}
				</Text>
				<Text variant="body" style={[s.center, { color: c.heroTextSecondary }]}>
					{line}
				</Text>
				{results.length > 0 ? (
					<View style={s.results}>
						{results.map((isRight, i) => (
							<ResultCard key={i} isRight={isRight} index={i} />
						))}
					</View>
				) : null}
				<View style={s.faces}>
					<StudentFace name="Maya" mood={mood} moodKey={shown} size={END_PORTRAIT} />
					<StudentFace name="Omar" mood={mood} moodKey={shown} size={END_PORTRAIT} />
				</View>
				{classWords ? (
					<Text variant="bodySm" style={[s.center, { color: c.heroText }]}>
						{classWords}
					</Text>
				) : null}
			</View>
			<Button
				label={reminded ? 'Calendar opened' : 'Remind me about tomorrow’s quiz'}
				variant="primary"
				size="lg"
				fullWidth
				onPress={onRemind}
			/>
			<PressableScale onPress={onDone} haptic={false} style={s.done}>
				<Text variant="label" style={{ color: c.heroText }}>
					Done
				</Text>
			</PressableScale>
		</View>
	)
}

const s = StyleSheet.create({
	end: { flex: 1, gap: 10 },
	middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
	score: { fontSize: 60, lineHeight: 70 },
	center: { textAlign: 'center' },
	results: { flexDirection: 'row', gap: 6, marginTop: 10 },
	result: { width: 38, height: 52, alignItems: 'center', justifyContent: 'center' },
	faces: { flexDirection: 'row', gap: 24, marginTop: 14 },
	done: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24 }
})
