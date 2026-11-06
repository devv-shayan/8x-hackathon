import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring
} from 'react-native-reanimated'
import { Check, X } from 'lucide-react-native'
import type { QuizQuestion } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { shake, Springs } from '@/lib/motion'

const POP = 1.05
const DIMMED = 0.28
const WRONG_DIMMED = 0.6
const LONG_OPTION = 30

type TileState = 'open' | 'right' | 'wrong' | 'other'

type AnswerProps = {
	question: QuizQuestion
	picked: number | null
	onPick: (index: number) => void
}

function stateOf(index: number, { question, picked }: AnswerProps): TileState {
	if (picked === null) return 'open'
	if (index === question.right_index) return 'right'
	return index === picked ? 'wrong' : 'other'
}

function tileLabel(option: string, state: TileState): string {
	if (state === 'right') return `${option}, the right answer`
	if (state === 'wrong') return `${option}, not right`
	return option
}

/** One answer. The right one pops and goes lime; a wrong pick wobbles and fades back. */
function AnswerTile({
	option,
	state,
	onPress,
	round = false,
	halfWidth = false,
	icon
}: {
	option: string
	state: TileState
	onPress: () => void
	round?: boolean
	halfWidth?: boolean
	icon?: (color: string) => ReactNode
}) {
	const { colors: c, radii } = useTheme()
	const x = useSharedValue(0)
	const scale = useSharedValue(1)

	useEffect(() => {
		if (state === 'wrong') x.value = shake()
		if (state === 'right') {
			scale.value = withSequence(withSpring(POP, Springs.snappy), withSpring(1, Springs.settle))
		}
	}, [state, x, scale])

	const motion = useAnimatedStyle(() => ({
		transform: [{ translateX: x.value }, { scale: scale.value }]
	}))
	const ink = state === 'right' ? c.onBrand : c.textPrimary

	return (
		<Animated.View
			style={[
				round ? s.roundSlot : halfWidth ? s.halfSlot : null,
				motion,
				state === 'other' && { opacity: DIMMED },
				state === 'wrong' && { opacity: WRONG_DIMMED }
			]}
		>
			<PressableScale
				onPress={onPress}
				disabled={state !== 'open'}
				haptic={false}
				scaleTo="button"
				accessibilityLabel={tileLabel(option, state)}
				style={[
					round ? s.round : s.tile,
					{
						backgroundColor: state === 'right' ? c.brandFill : c.surface,
						borderRadius: round ? radii.pill : radii.xl
					}
				]}
			>
				{icon?.(ink)}
				<Text
					variant={option.length > LONG_OPTION ? 'bodySm' : 'h3'}
					style={[
						s.optionText,
						{ color: ink },
						state === 'wrong' && { textDecorationLine: 'line-through' }
					]}
				>
					{option}
				</Text>
			</PressableScale>
		</Animated.View>
	)
}

/** Four suggested words, two by two. */
export function FillBlankQuestion(props: AnswerProps) {
	return (
		<View style={s.grid}>
			{props.question.options.map((option, i) => (
				<AnswerTile
					key={option}
					halfWidth
					option={option}
					state={stateOf(i, props)}
					onPress={() => props.onPick(i)}
				/>
			))}
		</View>
	)
}

/** Full-width answer cards, one under another. */
export function MultipleChoiceQuestion(props: AnswerProps) {
	return (
		<View style={s.stack}>
			{props.question.options.map((option, i) => (
				<AnswerTile
					key={option}
					option={option}
					state={stateOf(i, props)}
					onPress={() => props.onPick(i)}
				/>
			))}
		</View>
	)
}

/** Two big round buttons. */
export function TrueFalseQuestion(props: AnswerProps) {
	return (
		<View style={s.rounds}>
			{props.question.options.map((option, i) => (
				<AnswerTile
					key={option}
					round
					option={option}
					state={stateOf(i, props)}
					onPress={() => props.onPick(i)}
					icon={(color) =>
						i === 0 ? (
							<Check size={30} color={color} strokeWidth={3} />
						) : (
							<X size={30} color={color} strokeWidth={3} />
						)
					}
				/>
			))}
		</View>
	)
}

export function QuestionAnswers(props: AnswerProps) {
	if (props.question.type === 'fill_blank') return <FillBlankQuestion {...props} />
	if (props.question.type === 'multiple_choice') return <MultipleChoiceQuestion {...props} />
	return <TrueFalseQuestion {...props} />
}

const s = StyleSheet.create({
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	stack: { gap: 8 },
	rounds: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
	halfSlot: { flexGrow: 1, flexBasis: '46%' },
	roundSlot: { width: 112, height: 112 },
	tile: {
		minHeight: 48,
		paddingHorizontal: 12,
		paddingVertical: 8,
		alignItems: 'center',
		justifyContent: 'center'
	},
	round: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
	optionText: { textAlign: 'center' }
})
