import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { Play } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MAX_CLASS_QUESTIONS, type ClassSession, type ClassTurn } from '@app/contract'
import type { Raised, StudentName } from '@app/pixel'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { StudentTargets } from '@/components/pixel/StudentTargets'
import { useSheetFloor } from '@/components/pixel/useSheetFloor'
import { QuestionVoice } from '@/components/voice/QuestionVoice'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useTheme } from '@/contexts/ThemeContext'
import { usePrefetchQuestionVoices, useQuestionVoice } from '@/hooks/useQuestionVoice'
import { HelpSheet } from './HelpSheet'
import { studentName } from './shared'

/** Who each student is, in a line under their question. */
const WHO: Record<string, string> = {
	Maya: 'Never saw the video',
	Omar: 'Watched it twice'
}

/** The pixel figure a student is drawn as: by name, or by seat for any other name. */
function figureFor(session: ClassSession, studentId: string): StudentName {
	const index = session.students.findIndex(({ id }) => id === studentId)
	const name = session.students[index]?.name
	if (name === 'Maya' || name === 'Omar') return name
	return index === 0 ? 'Maya' : 'Omar'
}

/**
 * The class: Maya and Omar on the Teach section's gold, with a hand up for each question
 * waiting. The sheet holds one question at a time; tapping another student with a hand up
 * answers theirs instead. "I’ll be back" opens private help.
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
	onAnswer: () => void
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
	const { floor, onScreenLayout, onSheetLayout } = useSheetFloor()
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

	function pick(figure: StudentName) {
		const turn = hands.find((t) => figureFor(session, t.student_id) === figure)
		if (turn && turn.id !== openTurn?.id) onPick(turn)
	}

	return (
		<View style={s.fill} onLayout={onScreenLayout}>
			<PixelBackdrop scene="classroom" raised={raised} floor={floor} />
			<StudentTargets scene="classroom" raised={raised} floor={floor} onPick={pick} />
			<View style={[s.bar, { top: insets.top + 8 }]} pointerEvents="box-none">
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
			<View style={s.fill} pointerEvents="none" />
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				onLayout={onSheetLayout}
			>
				<SheetCard>
					{openTurn && name ? (
						<>
							<MonoLabel
								right={
									<View style={s.pips} accessibilityElementsHidden>
										{Array.from({ length: MAX_CLASS_QUESTIONS }, (_, i) => (
											<View
												key={i}
												style={[
													s.pip,
													{ backgroundColor: i <= answeredCount ? c.textPrimary : c.surface3 }
												]}
											/>
										))}
									</View>
								}
							>
								{`Question ${answeredCount + 1} of ${MAX_CLASS_QUESTIONS}`}
							</MonoLabel>
							<Text variant="question" style={s.question} accessibilityRole="header">
								{openTurn.question}
							</Text>
							<MonoLabel
								style={s.who}
								right={<QuestionVoice state={voice.state} student={name} onReplay={voice.replay} />}
							>
								{`${name} · ${WHO[name] ?? 'In your class'}`}
							</MonoLabel>
							{others.length > 0 ? (
								<Text variant="caption" tone="secondary" style={s.others}>
									{`${others.map((t) => studentName(session, t)).join(' and ')} has a hand up too. Tap ${others.length === 1 ? studentName(session, others[0]!) : 'a student'} to take that question instead.`}
								</Text>
							) : null}
							<View style={s.input}>
								<TextInputField
									accessibilityLabel={`Answer ${name}`}
									placeholder={`Answer ${name} in your own words`}
									multiline
									value={answer}
									onChangeText={onAnswerChange}
									error={error}
								/>
							</View>
							<Button
								label={answering ? 'Waiting for the class…' : 'Answer'}
								variant="ink"
								size="lg"
								fullWidth
								loading={answering}
								disabled={!answer.trim() || busy}
								onPress={onAnswer}
								style={s.cta}
							/>
							<Button
								label="Skip this one"
								variant="ghost"
								fullWidth
								disabled={busy}
								onPress={onSkip}
							/>
							<HelpSheet session={session} turn={openTurn} open={helpOpen} onClose={onCloseHelp} />
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
	bar: {
		position: 'absolute',
		left: 16,
		right: 16,
		zIndex: 2,
		flexDirection: 'row',
		justifyContent: 'space-between'
	},
	pill: {
		height: 44,
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
	input: { marginTop: 14 },
	cta: { marginTop: 14 }
})
