import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import { theme } from '@app/brand'
import type { QuizQuestion, QuizQuestionType } from '@app/contract'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { formatTimestamp } from '@/lib/formatTimestamp'
import { Springs, Timings } from '@/lib/motion'

const CARD_TILT = '-1.5deg'
const FLIP_HALF_MS = 170
const ARRIVE_FROM = 36
const WORD_LANDS_MS = 260
const WORD_RISES_FROM = 240
/** Over this many characters, a card's text steps down a size so it still fits. */
const LONG_TEXT = 110
const BLANK = '________'

const TYPE_LABEL: Record<QuizQuestionType, string> = {
	fill_blank: 'Fill the blank',
	multiple_choice: 'Multiple choice',
	true_false: 'True or false'
}

function questionText(question: QuizQuestion): string {
	if (question.type === 'fill_blank') return `${question.before}${BLANK}${question.after}`
	return question.type === 'multiple_choice' ? question.question : question.statement
}

function Front({ question, filled }: { question: QuizQuestion; filled: boolean }) {
	const { colors: c } = useTheme()
	const long = questionText(question).length > LONG_TEXT
	return (
		<>
			<MonoLabel>{TYPE_LABEL[question.type]}</MonoLabel>
			<Text
				variant={long ? 'title' : 'h2'}
				accessibilityRole="header"
				accessibilityLabel={questionText(question).replace(BLANK, 'blank')}
				numberOfLines={9}
			>
				{question.type === 'fill_blank' ? (
					<>
						{question.before}
						<Text
							variant={long ? 'title' : 'h2'}
							style={filled ? { backgroundColor: c.brandFill, color: c.onBrand } : undefined}
						>
							{filled ? ` ${question.options[question.right_index]} ` : BLANK}
						</Text>
						{question.after}
					</>
				) : (
					questionText(question)
				)}
			</Text>
			<Text variant="caption" tone="secondary" style={s.source} numberOfLines={1}>
				{question.topic_title}
			</Text>
		</>
	)
}

function Back({ question, reaction }: { question: QuizQuestion; reaction: string }) {
	const long = question.quote.length > LONG_TEXT
	return (
		<>
			<MonoLabel>
				{question.start_seconds == null
					? 'What you pasted says'
					: `The video says, ${formatTimestamp(question.start_seconds)}`}
			</MonoLabel>
			<Text variant={long ? 'bodySm' : 'title'} numberOfLines={8} accessibilityLiveRegion="polite">
				{`“${question.quote}”`}
			</Text>
			<Text variant="label" style={s.source}>
				{reaction}
			</Text>
		</>
	)
}

/** The word you tapped rises from the tiles and lands on the card. */
function RisingWord({ word }: { word: string }) {
	const { colors: c, radii } = useTheme()
	const rise = useSharedValue(WORD_RISES_FROM)
	const opacity = useSharedValue(1)
	useEffect(() => {
		rise.value = withTiming(0, { duration: WORD_LANDS_MS })
		opacity.value = withSequence(
			withTiming(1, { duration: WORD_LANDS_MS }),
			withTiming(0, Timings.fast)
		)
	}, [rise, opacity])
	const style = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ translateY: rise.value }]
	}))
	return (
		<Animated.View
			pointerEvents="none"
			style={[s.rising, { backgroundColor: c.brandFill, borderRadius: radii.md }, style]}
		>
			<Text variant="h3" style={{ color: c.onBrand }}>
				{word}
			</Text>
		</Animated.View>
	)
}

/**
 * The top card of the deck. Give it a `key` per question: a new one slides in. `revealed` flips
 * it over to what the video really says, and a right word first lands in the blank.
 */
export function QuestionCard({
	question,
	answered,
	isRight,
	revealed,
	reaction
}: {
	question: QuizQuestion
	answered: boolean
	/** A right word rises into the blank; after a wrong pick it just writes itself in. */
	isRight: boolean
	revealed: boolean
	reaction: string
}) {
	const { colors: c, radii } = useTheme()
	const [showBack, setShowBack] = useState(false)
	const [filled, setFilled] = useState(false)
	const arrive = useSharedValue(ARRIVE_FROM)
	const turn = useSharedValue(0)

	useEffect(() => {
		arrive.value = withSpring(0, Springs.snappy)
	}, [arrive])

	useEffect(() => {
		if (!answered) return
		const id = setTimeout(() => setFilled(true), WORD_LANDS_MS)
		return () => clearTimeout(id)
	}, [answered])

	useEffect(() => {
		if (!revealed) return
		turn.value = withSequence(
			withTiming(90, { duration: FLIP_HALF_MS }),
			withTiming(0, { duration: FLIP_HALF_MS })
		)
		const id = setTimeout(() => setShowBack(true), FLIP_HALF_MS)
		return () => clearTimeout(id)
	}, [revealed, turn])

	const motion = useAnimatedStyle(() => ({
		transform: [
			{ perspective: 800 },
			{ translateX: arrive.value },
			{ rotate: CARD_TILT },
			{ rotateY: `${turn.value}deg` }
		]
	}))

	return (
		<>
			<Animated.View
				style={[s.card, { backgroundColor: c.surface, borderRadius: radii['3xl'] }, motion]}
			>
				{showBack ? (
					<Back question={question} reaction={reaction} />
				) : (
					<Front question={question} filled={filled} />
				)}
			</Animated.View>
			{isRight && question.type === 'fill_blank' && !showBack ? (
				<RisingWord word={question.options[question.right_index] as string} />
			) : null}
		</>
	)
}

/** The two cards behind the top one. */
export function DeckBacking() {
	const { colors: c, radii } = useTheme()
	return (
		<>
			<View
				style={[
					s.backing,
					s.backingFar,
					{ backgroundColor: theme.palettes.dark.surface3, borderRadius: radii['3xl'] }
				]}
			/>
			<View
				style={[
					s.backing,
					s.backingNear,
					{ backgroundColor: c.heroTextSecondary, borderRadius: radii['3xl'] }
				]}
			/>
		</>
	)
}

const s = StyleSheet.create({
	card: { ...StyleSheet.absoluteFillObject, padding: 18, gap: 10 },
	source: { marginTop: 'auto' },
	backing: { ...StyleSheet.absoluteFillObject },
	backingFar: { transform: [{ rotate: '4deg' }, { translateY: 7 }] },
	backingNear: { transform: [{ rotate: '2deg' }, { translateY: 3 }] },
	rising: {
		position: 'absolute',
		alignSelf: 'center',
		top: '42%',
		zIndex: 7,
		paddingHorizontal: 14,
		paddingVertical: 6
	}
})
