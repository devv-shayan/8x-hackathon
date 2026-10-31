import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
	MAX_CLASS_QUESTIONS,
	type ClassSession,
	type ClassTurn,
	type TurnOutcome
} from '@app/contract'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Sheet } from '@/components/ui/Sheet'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useColors } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api, errorMessage } from '@/lib/api'
import { formatTimestamp } from '@/lib/formatTimestamp'
import { haptic } from '@/lib/haptics'

// A student's next question is an AI call, so it takes longer than the API default.
const CLASS_TIMEOUT_MS = 60 * 1000

function studentName(session: ClassSession, turn: ClassTurn) {
	return session.students.find(({ id }) => id === turn.student_id)?.name ?? 'A student'
}

function TurnCard({ session, turn }: { session: ClassSession; turn: ClassTurn }) {
	return (
		<View style={s.turn}>
			<Card>
				<View style={s.bubble}>
					<Eyebrow tone="muted">{studentName(session, turn)}</Eyebrow>
					<Text variant="body">{turn.question}</Text>
				</View>
			</Card>
			{turn.answer ? (
				<Text variant="bodySm" tone="secondary" style={s.answer}>
					{turn.answer}
				</Text>
			) : null}
			{turn.outcome === 'skipped' ? (
				<Text variant="caption" tone="secondary" style={s.answer}>
					Skipped
				</Text>
			) : null}
		</View>
	)
}

function finishedMessage(turns: ClassTurn[]) {
	const count = turns.filter(({ outcome }) => outcome !== 'skipped').length
	if (count === 0) return 'Class ended. You didn’t answer any questions.'
	return `Class finished. You answered ${count} ${count === 1 ? 'question' : 'questions'}.`
}

function RaisedHands({
	session,
	hands,
	picked,
	onPick
}: {
	session: ClassSession
	hands: ClassTurn[]
	picked: ClassTurn
	onPick: (turn: ClassTurn) => void
}) {
	return (
		<View style={s.hands}>
			<Eyebrow tone="muted">Hands up: pick who to answer</Eyebrow>
			<View style={s.handRow}>
				{hands.map((turn) => (
					<View key={turn.id} style={s.hand}>
						<Button
							label={studentName(session, turn)}
							variant={turn.id === picked.id ? 'primary' : 'secondary'}
							fullWidth
							onPress={() => onPick(turn)}
						/>
					</View>
				))}
			</View>
		</View>
	)
}

function HelpSheet({
	session,
	turn,
	open,
	onClose
}: {
	session: ClassSession
	turn: ClassTurn
	open: boolean
	onClose: () => void
}) {
	const c = useColors()
	const queryClient = useQueryClient()
	const queryKey = ['class-help', turn.id]
	const help = useQuery({
		queryKey,
		queryFn: ({ signal }) =>
			api('getClassHelp', {
				signal,
				params: { id: session.id, turn: turn.id },
				body: {},
				timeoutMs: CLASS_TIMEOUT_MS
			}).then((r) => r.help),
		enabled: open,
		staleTime: Infinity,
		retry: false
	})
	const start = help.data?.start_seconds

	// Cancelling tells the server the person didn't stay for the help, so it isn't counted.
	function close() {
		void queryClient.cancelQueries({ queryKey })
		onClose()
	}

	return (
		<Sheet open={open} onClose={close} title="I’ll be back">
			<View style={s.help}>
				<Eyebrow tone="muted">From the video, just for you</Eyebrow>
				<View style={s.helpMeta}>
					{start != null ? (
						<View style={[s.chip, { borderColor: c.textSecondary }]}>
							<Text variant="caption" tone="secondary">
								{formatTimestamp(start)}
							</Text>
						</View>
					) : null}
					<Text variant="caption" tone="secondary">
						{`${studentName(session, turn)} is still waiting`}
					</Text>
				</View>
				{help.isPending ? (
					<Text variant="body" tone="secondary">
						Looking in the video…
					</Text>
				) : help.isError ? (
					<>
						<Text variant="body">{errorMessage(help.error)}</Text>
						<Button
							label="Try again"
							variant="secondary"
							fullWidth
							onPress={() => help.refetch()}
						/>
					</>
				) : (
					<Text variant="body">{help.data.explanation}</Text>
				)}
				<Button label="Back to answer" fullWidth onPress={close} />
			</View>
		</Sheet>
	)
}

function ExplainStep({
	onStart,
	pending,
	error
}: {
	onStart: (explanation: string) => void
	pending: boolean
	error: string | null
}) {
	const [explanation, setExplanation] = useState('')
	return (
		<>
			<Text variant="lead" tone="secondary">
				Explain the video in your own words. Your students will ask about it next.
			</Text>
			<TextInputField
				label="Your explanation"
				multiline
				numberOfLines={8}
				value={explanation}
				onChangeText={setExplanation}
				error={error}
			/>
			<Button
				label={pending ? 'Students are thinking…' : 'Start the class'}
				loading={pending}
				disabled={!explanation.trim() || pending}
				fullWidth
				onPress={() => onStart(explanation)}
			/>
		</>
	)
}

export default function ClassScreen() {
	const { topicId } = useLocalSearchParams<{ topicId: string }>()
	const [current, setSession] = useState<ClassSession | null>(null)
	const [answer, setAnswer] = useState('')
	const [pickedId, setPickedId] = useState<string | null>(null)
	const [helpOpen, setHelpOpen] = useState(false)

	// Leaving mid-class doesn't lose it: the same hands are up when the person comes back.
	const open = useQuery({
		queryKey: ['open-class', topicId],
		queryFn: () => api('openClass', { query: { topic_id: topicId } }),
		gcTime: 0
	})
	const session = current ?? open.data?.class ?? null
	const resumedId = open.data?.class?.id

	useEffect(() => {
		if (resumedId) track('class_resumed')
	}, [resumedId])

	const start = useMutation({
		mutationFn: (explanation: string) =>
			api('startClass', {
				body: { topic_id: topicId, explanation },
				timeoutMs: CLASS_TIMEOUT_MS
			}),
		onSuccess: ({ class: started }) => {
			haptic.success()
			track('class_started')
			setSession(started)
		},
		onError: () => haptic.error()
	})

	const hands = session?.turns.filter(({ outcome }) => outcome === null) ?? []
	const answered = session?.turns.filter(({ outcome }) => outcome !== null) ?? []
	const openTurn = hands.find(({ id }) => id === pickedId) ?? hands[0]

	function finishClass(finished: ClassSession, endedEarly: boolean) {
		track('class_finished', { question_count: finished.turns.length, ended_early: endedEarly })
		setSession(finished)
	}
	const reply = useMutation({
		mutationFn: ({ turn, outcome }: { turn: ClassTurn; outcome: TurnOutcome }) =>
			api('answerTurn', {
				params: { id: session?.id ?? '', turn: turn.id },
				body: outcome === 'skipped' ? { outcome } : { outcome, answer },
				timeoutMs: CLASS_TIMEOUT_MS
			}),
		onSuccess: ({ class: updated }, { turn }) => {
			// The server decides needed_help, from whether help was given on this question.
			const saved = updated.turns.find(({ id }) => id === turn.id)
			track('class_answered', { outcome: saved?.outcome ?? 'answered' })
			if (updated.finished) finishClass(updated, false)
			else setSession(updated)
			setAnswer('')
		},
		onError: () => haptic.error()
	})

	const end = useMutation({
		mutationFn: () => api('endClass', { params: { id: session?.id ?? '' }, body: {} }),
		onSuccess: ({ class: ended }) => finishClass(ended, true),
		onError: () => haptic.error()
	})

	const busy = reply.isPending || end.isPending
	return (
		<Screen header={<PageHeader title="Class" onBack={() => router.back()} />} gap={14}>
			{open.isPending ? (
				<Text variant="body" tone="secondary">
					Checking for your class…
				</Text>
			) : open.isError ? (
				<>
					<Text variant="body">{errorMessage(open.error)}</Text>
					<Button label="Try again" fullWidth onPress={() => open.refetch()} />
				</>
			) : !session ? (
				<ExplainStep
					onStart={(explanation) => start.mutate(explanation)}
					pending={start.isPending}
					error={start.isError ? errorMessage(start.error) : null}
				/>
			) : (
				<>
					{openTurn ? (
						<>
							<Text variant="caption" tone="secondary">
								{`Question ${answered.length + 1} of ${MAX_CLASS_QUESTIONS}`}
							</Text>
							<RaisedHands
								session={session}
								hands={hands}
								picked={openTurn}
								onPick={(turn) => {
									track('class_hand_picked', { student: studentName(session, turn) })
									setPickedId(turn.id)
								}}
							/>
						</>
					) : null}

					{answered.map((turn) => (
						<TurnCard key={turn.id} session={session} turn={turn} />
					))}

					{openTurn ? (
						<View style={s.composer}>
							<TurnCard session={session} turn={openTurn} />
							<TextInputField
								label={`Answer ${studentName(session, openTurn)}`}
								multiline
								value={answer}
								onChangeText={setAnswer}
								error={reply.isError || end.isError ? errorMessage(reply.error ?? end.error) : null}
							/>
							<Button
								label={reply.isPending ? 'Waiting for the class…' : 'Answer'}
								loading={reply.isPending}
								disabled={!answer.trim() || busy}
								fullWidth
								onPress={() => reply.mutate({ turn: openTurn, outcome: 'answered' })}
							/>
							<Button
								label="I’ll be back: check the video"
								variant="secondary"
								disabled={busy}
								fullWidth
								onPress={() => {
									track('class_help_opened', { student: studentName(session, openTurn) })
									setHelpOpen(true)
								}}
							/>
							<Button
								label="Skip this one"
								variant="ghost"
								disabled={busy}
								fullWidth
								onPress={() => reply.mutate({ turn: openTurn, outcome: 'skipped' })}
							/>
							<Button
								label={end.isPending ? 'Ending the class…' : 'End class'}
								variant="secondary"
								loading={end.isPending}
								disabled={busy}
								fullWidth
								onPress={() => end.mutate()}
							/>
						</View>
					) : (
						<View style={s.composer}>
							<Text variant="body">{finishedMessage(answered)}</Text>
							<Button label="Back to home" fullWidth onPress={() => router.back()} />
						</View>
					)}

					{openTurn ? (
						<HelpSheet
							session={session}
							turn={openTurn}
							open={helpOpen}
							onClose={() => setHelpOpen(false)}
						/>
					) : null}
				</>
			)}
		</Screen>
	)
}

const s = StyleSheet.create({
	turn: { gap: 8 },
	hands: { gap: 8 },
	handRow: { flexDirection: 'row', gap: 8 },
	hand: { flex: 1 },
	bubble: { gap: 6 },
	answer: { paddingHorizontal: 12 },
	composer: { gap: 10, paddingTop: 8 },
	help: { gap: 12 },
	helpMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }
})
