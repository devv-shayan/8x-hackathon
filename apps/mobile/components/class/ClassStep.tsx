import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native'
import { Play } from 'lucide-react-native'
import { useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MAX_CLASS_QUESTIONS, type ClassSession, type ClassTurn } from '@app/contract'
import { SCENES, studentHeads, type Raised, type Stage, type StudentName } from '@app/pixel'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { StudentTargets } from '@/components/pixel/StudentTargets'
import { useSheetFloor } from '@/components/pixel/useSheetFloor'
import { QuestionVoice } from '@/components/voice/QuestionVoice'
import { VoiceAnswer, type AnswerMeta } from '@/components/voice/VoiceAnswer'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useKeyboardShown } from '@/hooks/useKeyboardShown'
import { useQuestionReveal } from '@/hooks/useQuestionReveal'
import { usePrefetchQuestionVoices, useQuestionVoice } from '@/hooks/useQuestionVoice'
import { track } from '@/lib/analytics'
import { KEYBOARD_LIFT } from '@/lib/keyboard'
import { HelpSheet } from './HelpSheet'
import { QuestionBubble } from './QuestionBubble'
import { studentName } from './shared'

/** Who each student is, in a line under their question. */
const WHO: Record<string, string> = {
	Maya: 'Never saw the video',
	Omar: 'Watched it twice'
}

/** How far the top buttons sit below the safe area, how tall they are, and the gap under them. */
const BAR_TOP = 8
const PILL_HEIGHT = 44
const BAR_GAP = 8
/** The most of the screen the question's bubble takes; a longer question scrolls inside it. */
const BUBBLE_SHARE = 0.36
/** The space kept between the bubble's tail and the students below it. */
const BUBBLE_CLEARANCE = 6

/** The pixel figure a student is drawn as: by name, or by seat for any other name. */
function figureFor(session: ClassSession, studentId: string): StudentName {
	const index = session.students.findIndex(({ id }) => id === studentId)
	const name = session.students[index]?.name
	if (name === 'Maya' || name === 'Omar') return name
	return index === 0 ? 'Maya' : 'Omar'
}

/**
 * The class: Maya and Omar on the Teach section's gold, each at a desk with a hand up for each
 * question waiting. Nobody asks until the person calls on them, by tapping the student or their
 * button. Then that student stands into the light and asks, their question appearing in a speech
 * bubble as they say it, while the sheet holds the answer; tapping another student with a hand
 * up answers theirs instead (docs/class-scene-requirements.md). "I’ll be back" opens private
 * help.
 */
export function ClassStep({
	session,
	hands,
	answeredCount,
	openTurn,
	answer,
	onAnswerChange,
	onPick,
	onAnswer,
	onSkip,
	onEnd,
	answering,
	ending,
	error,
	helpOpen,
	onHelp,
	onCloseHelp
}: {
	session: ClassSession
	hands: ClassTurn[]
	answeredCount: number
	openTurn: ClassTurn | undefined
	answer: string
	onAnswerChange: (text: string) => void
	onPick: (turn: ClassTurn) => void
	onAnswer: (text: string, meta: AnswerMeta) => void
	onSkip: () => void
	onEnd: () => void
	answering: boolean
	ending: boolean
	error: string | null
	helpOpen: boolean
	onHelp: () => void
	onCloseHelp: () => void
}) {
	const { colors: c, elevation } = useTheme()
	const insets = useSafeAreaInsets()
	const busy = answering || ending
	const keyboard = useKeyboardShown()
	const { floor, screenWidth, screenHeight, onScreenLayout, onSheetLayout } = useSheetFloor({
		hold: keyboard
	})
	const [bubbleBottom, setBubbleBottom] = useState(0)
	const raised: Raised = {}
	for (const turn of hands) raised[figureFor(session, turn.student_id)] = 1
	const name = openTurn ? studentName(session, openTurn) : null
	const others = hands.filter((turn) => turn.id !== openTurn?.id)
	// Every raised hand's voice is made ahead, so the one picked is usually ready to speak.
	usePrefetchQuestionVoices(hands.map((turn) => ({ class_id: session.id, turn_id: turn.id })))
	const voice = useQuestionVoice({
		surface: 'class',
		source: openTurn ? { class_id: session.id, turn_id: openTurn.id } : null,
		text: openTurn?.question ?? null,
		student: name
	})
	const reveal = useQuestionReveal({ text: openTurn?.question ?? null, voice })
	const asking = openTurn ? figureFor(session, openTurn.student_id) : null
	// The bubble starts under the top buttons and takes the room its question needs; the
	// students stand below it, smaller if they must, so it never covers them.
	const bubbleTop = insets.top + BAR_TOP + PILL_HEIGHT + BAR_GAP
	const bubbleMax = screenHeight ? screenHeight * BUBBLE_SHARE : undefined
	const ceiling =
		openTurn && bubbleBottom && screenHeight
			? (bubbleBottom + BUBBLE_CLEARANCE) / screenHeight
			: null
	const stage: Stage = { asking, talking: voice.state === 'speaking', ceiling }
	const heads =
		screenWidth && screenHeight
			? studentHeads(SCENES.classroom, screenWidth, screenHeight, floor, stage)
			: []
	const tailX = heads.find((h) => h.name === asking)?.x ?? null
	// The sheet never rises past the bubble (or, with no question, the top buttons), however
	// tall the keyboard: what's in it scrolls instead, and the answer stays above the keyboard.
	const sheetTop = openTurn && bubbleBottom ? bubbleBottom + BAR_GAP : bubbleTop
	const sheetMax = screenHeight ? screenHeight - sheetTop : undefined

	const progress = (
		<MonoLabel
			right={
				<View style={s.pips} accessibilityElementsHidden>
					{Array.from({ length: MAX_CLASS_QUESTIONS }, (_, i) => (
						<View
							key={i}
							style={[s.pip, { backgroundColor: i <= answeredCount ? c.textPrimary : c.surface3 }]}
						/>
					))}
				</View>
			}
		>
			{`Question ${answeredCount + 1} of ${MAX_CLASS_QUESTIONS}`}
		</MonoLabel>
	)

	function pick(figure: StudentName) {
		const turn = hands.find((t) => figureFor(session, t.student_id) === figure)
		if (turn && turn.id !== openTurn?.id) onPick(turn)
	}

	return (
		<View style={s.fill} onLayout={onScreenLayout}>
			<PixelBackdrop scene="classroom" raised={raised} floor={floor} stage={stage} />
			<StudentTargets scene="classroom" raised={raised} floor={floor} stage={stage} onPick={pick} />
			<View style={[s.bar, { top: insets.top + BAR_TOP }]} pointerEvents="box-none">
				<PressableScale
					onPress={onEnd}
					disabled={busy}
					accessibilityRole="button"
					accessibilityLabel={ending ? 'Ending the class' : 'End class'}
					style={[s.pill, { backgroundColor: c.surface }, elevation.soft]}
				>
					<Text variant="label" style={s.pillText}>
						{ending ? 'Ending…' : 'End class'}
					</Text>
				</PressableScale>
				{openTurn ? (
					<PressableScale
						onPress={onHelp}
						disabled={busy}
						accessibilityRole="button"
						accessibilityLabel="I’ll be back: check the video"
						style={[s.pill, { backgroundColor: c.surface }, elevation.soft]}
					>
						<Play size={14} color={c.textPrimary} fill={c.textPrimary} />
						<Text variant="label" style={s.pillText}>
							I’ll be back
						</Text>
					</PressableScale>
				) : null}
			</View>
			{openTurn && name ? (
				<QuestionBubble
					question={openTurn.question}
					student={name}
					reveal={reveal}
					top={bubbleTop}
					maxHeight={bubbleMax}
					tailX={tailX}
					showName={keyboard}
					onShowAll={() => {
						if (reveal.showAll()) track('class_question_shown_all', { student: name })
					}}
					onLayout={(e) => setBubbleBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
				/>
			) : null}
			<View style={s.fill} pointerEvents="none" />
			<KeyboardAvoidingView
				behavior={KEYBOARD_LIFT}
				onLayout={onSheetLayout}
				style={{ maxHeight: sheetMax }}
			>
				<SheetCard style={s.shrink}>
					{openTurn && name ? (
						<>
							<ScrollView
								style={s.shrink}
								bounces={false}
								keyboardShouldPersistTaps="handled"
								showsVerticalScrollIndicator={false}
							>
								{progress}
								<MonoLabel
									style={s.who}
									right={
										<QuestionVoice state={voice.state} student={name} onReplay={voice.replay} />
									}
								>
									{`${name} · ${WHO[name] ?? 'In your class'}`}
								</MonoLabel>
								{others.length > 0 ? (
									<Text variant="caption" tone="secondary" style={s.others}>
										{`${others.map((t) => studentName(session, t)).join(' and ')} has a hand up too. Tap ${others.length === 1 ? studentName(session, others[0]!) : 'a student'} to take that question instead.`}
									</Text>
								) : null}
							</ScrollView>
							<VoiceAnswer
								key={openTurn.id}
								surface="class"
								student={name}
								question={openTurn.question}
								typed={answer}
								onTypedChange={onAnswerChange}
								onSend={onAnswer}
								sending={answering}
								error={error}
								secondary={{ label: 'Skip this one', onPress: onSkip, disabled: busy }}
							/>
							<HelpSheet session={session} turn={openTurn} open={helpOpen} onClose={onCloseHelp} />
						</>
					) : hands.length > 0 ? (
						<>
							{progress}
							<Text variant="question" style={s.question} accessibilityRole="header">
								{hands.length === 1
									? `${studentName(session, hands[0]!)} has a hand up.`
									: 'Hands are up.'}
							</Text>
							<Text variant="lead" tone="secondary" style={s.others}>
								Tap a student to let them ask.
							</Text>
							{hands.map((turn, i) => (
								<Button
									key={turn.id}
									label={`Let ${studentName(session, turn)} ask`}
									variant={i === 0 ? 'ink' : 'secondary'}
									size="lg"
									fullWidth
									disabled={busy}
									onPress={() => onPick(turn)}
									style={s.cta}
								/>
							))}
						</>
					) : (
						<>
							<MonoLabel>Class</MonoLabel>
							<Text variant="question" style={s.question}>
								No hands up right now.
							</Text>
							<Text variant="lead" tone="secondary" style={s.others}>
								End the class to see what stuck.
							</Text>
							<Button
								label={ending ? 'Ending the class…' : 'End class'}
								variant="ink"
								size="lg"
								fullWidth
								loading={ending}
								onPress={onEnd}
								style={s.cta}
							/>
						</>
					)}
				</SheetCard>
			</KeyboardAvoidingView>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	shrink: { flexShrink: 1 },
	bar: {
		position: 'absolute',
		left: 16,
		right: 16,
		zIndex: 2,
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	pill: {
		height: PILL_HEIGHT,
		paddingHorizontal: 16,
		borderRadius: 22,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6
	},
	pillText: { fontSize: 15 },
	pips: { flexDirection: 'row', gap: 4 },
	pip: { width: 18, height: 4 },
	question: { marginTop: 14 },
	who: { marginTop: 14 },
	others: { marginTop: 8 },
	cta: { marginTop: 14 }
})
