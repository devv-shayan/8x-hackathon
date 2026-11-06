import { useEffect, useMemo, useRef, useState } from 'react'
import { Linking, ScrollView, StyleSheet, View } from 'react-native'
import type { QuizQuestion } from '@app/contract'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { haptic } from '@/lib/haptics'
import {
	classGuesses,
	classLine,
	endWords,
	isNewBest,
	reactionLine,
	reminderUrl,
	rightInARow,
	type QuizRecord
} from '@/lib/quiz'
import { ChalkDust, Stamp } from './ChalkBurst'
import { ClassRow, type StudentMood } from './ClassRow'
import { DeckBacking, QuestionCard } from './QuestionCard'
import { QuestionAnswers } from './QuestionAnswers'
import { QuizEnd } from './QuizEnd'

/** Time to take in the stamp and the answer before the card flips. */
const FLIP_AFTER_MS = 650
const ON_A_ROLL = 2
const DECK_MIN_HEIGHT = 180

function moodFor(guessedRight: boolean): StudentMood {
	return guessedRight ? 'cheering' : 'slumped'
}

/** One progress piece per question: lime for right, grey for wrong, white for now. */
function ProgressBar({
	total,
	results,
	current
}: {
	total: number
	results: readonly boolean[]
	current: number
}) {
	const { colors: c, radii } = useTheme()
	return (
		<View style={s.progress} accessibilityLabel={`Question ${current + 1} of ${total}`}>
			{Array.from({ length: total }, (_, i) => {
				const result = results[i]
				const color =
					result === true
						? c.brandFill
						: result === false
							? c.heroTextSecondary
							: i === current
								? c.heroText
								: c.heroBorder
				return (
					<View key={i} style={[s.piece, { backgroundColor: color, borderRadius: radii.pill }]} />
				)
			})}
		</View>
	)
}

/**
 * A day's quiz, one card at a time: answer, see the stamp and how the class did, flip to what
 * the video really says, then move on when you tap. Holds no data of its own: the screen
 * passes in the questions and the score to beat, and saves what `onFinish` hands back.
 */
export function QuizPlayer({
	questions,
	previous,
	onFinish,
	onDone,
	onRightAnswer
}: {
	questions: readonly QuizQuestion[]
	previous: QuizRecord | null
	onFinish: (score: number, total: number) => void
	onDone: () => void
	onRightAnswer: () => void
}) {
	const { colors: c } = useTheme()
	const total = questions.length
	const guesses = useMemo(() => classGuesses(total, Math.random), [total])
	const [index, setIndex] = useState(0)
	const [picked, setPicked] = useState<number | null>(null)
	const [revealed, setRevealed] = useState(false)
	const [results, setResults] = useState<boolean[]>([])
	const [finished, setFinished] = useState(false)
	const [reminded, setReminded] = useState(false)
	const started = useRef(false)

	const question = questions[index]
	const guess = guesses[index]
	const answered = picked !== null
	const isRight = answered && picked === question?.right_index
	const you = results.filter(Boolean).length
	const counted = guesses.slice(0, results.length)
	const maya = counted.filter(({ maya: right }) => right).length
	const omar = counted.filter(({ omar: right }) => right).length

	useEffect(() => {
		if (started.current) return
		started.current = true
		track('quiz_started', { question_count: total })
	}, [total])

	useEffect(() => {
		if (!answered) return
		const id = setTimeout(() => setRevealed(true), FLIP_AFTER_MS)
		return () => clearTimeout(id)
	}, [answered])

	function pick(choice: number) {
		if (answered || !question) return
		const right = choice === question.right_index
		setPicked(choice)
		setResults((previousResults) => [...previousResults, right])
		track('quiz_answered', { question_type: question.type, is_right: right })
		if (right) {
			haptic.success()
			onRightAnswer()
		} else {
			haptic.warning()
		}
	}

	function next() {
		if (index + 1 < total) {
			setIndex(index + 1)
			setPicked(null)
			setRevealed(false)
			return
		}
		setFinished(true)
		onFinish(you, total)
		track('quiz_finished', { score: you, total, new_best: isNewBest(previous, you) })
		if (isNewBest(previous, you)) haptic.success()
	}

	function remind() {
		track('quiz_reminder_added')
		setReminded(true)
		void Linking.openURL(reminderUrl(new Date()))
	}

	if (finished || !question || !guess) {
		const words = endWords(previous, you)
		return (
			<QuizEnd
				score={you}
				total={total}
				results={results}
				headline={words.headline}
				line={words.line}
				classWords={classLine(you, maya, omar)}
				newBest={isNewBest(previous, you)}
				reminded={reminded}
				onRemind={remind}
				onDone={onDone}
			/>
		)
	}

	const onARoll = isRight && rightInARow(results) >= ON_A_ROLL
	return (
		// Scrolls only on a phone too small to fit four answers under the card.
		<ScrollView
			style={s.scroller}
			contentContainerStyle={s.player}
			showsVerticalScrollIndicator={false}
		>
			<ProgressBar total={total} results={results} current={index} />
			<ClassRow
				you={you}
				maya={maya}
				omar={omar}
				mayaMood={answered ? moodFor(guess.maya) : 'waiting'}
				omarMood={answered ? moodFor(guess.omar) : 'waiting'}
				moodKey={index}
			/>
			<View style={s.deck}>
				<DeckBacking />
				<QuestionCard
					key={question.id}
					question={question}
					answered={answered}
					isRight={isRight}
					revealed={revealed}
					reaction={reactionLine(isRight, guess)}
				/>
				{answered ? <Stamp key={`stamp-${question.id}`} isRight={isRight} /> : null}
				{isRight ? <ChalkDust key={`dust-${question.id}`} /> : null}
			</View>
			<Text
				variant="label"
				accessibilityLiveRegion="polite"
				style={[s.hint, { color: onARoll ? c.brandFill : c.heroText }]}
			>
				{onARoll
					? 'On a roll!'
					: !answered && question.type === 'fill_blank'
						? 'Tap the missing word'
						: ' '}
			</Text>
			<QuestionAnswers
				key={`answers-${question.id}`}
				question={question}
				picked={picked}
				onPick={pick}
			/>
			{/* Held in place before the flip, so the answers don't jump when it appears. */}
			<View style={revealed ? undefined : s.hidden} pointerEvents={revealed ? 'auto' : 'none'}>
				<Button
					label={index + 1 < total ? 'Next question' : 'See your score'}
					variant="primary"
					size="lg"
					fullWidth
					onPress={next}
					accessibilityElementsHidden={!revealed}
					importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
				/>
			</View>
		</ScrollView>
	)
}

const s = StyleSheet.create({
	scroller: { flex: 1 },
	player: { flexGrow: 1, gap: 12 },
	progress: { flexDirection: 'row', gap: 5 },
	piece: { flex: 1, height: 7 },
	deck: { flex: 1, minHeight: DECK_MIN_HEIGHT, marginHorizontal: 6, marginTop: 6 },
	hint: { textAlign: 'center', marginTop: 6 },
	hidden: { opacity: 0 }
})
