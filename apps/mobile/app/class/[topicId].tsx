import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import type { ClassSession, ClassTurn, TurnOutcome } from '@app/contract'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { track } from '@/lib/analytics'
import { api, errorMessage } from '@/lib/api'
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
	const [session, setSession] = useState<ClassSession | null>(null)
	const [answer, setAnswer] = useState('')

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

	const openTurn = session?.turns.find(({ outcome }) => outcome === null)

	const reply = useMutation({
		mutationFn: ({ turn, outcome }: { turn: ClassTurn; outcome: TurnOutcome }) =>
			api('answerTurn', {
				params: { id: session?.id ?? '', turn: turn.id },
				body: outcome === 'skipped' ? { outcome } : { outcome, answer },
				timeoutMs: CLASS_TIMEOUT_MS
			}),
		onSuccess: ({ class: updated }, { outcome }) => {
			track('class_answered', { outcome })
			if (updated.finished) {
				track('class_finished', { question_count: updated.turns.length })
			}
			setSession(updated)
			setAnswer('')
		},
		onError: () => haptic.error()
	})

	return (
		<Screen header={<PageHeader title="Class" onBack={() => router.back()} />} gap={14}>
			{!session ? (
				<ExplainStep
					onStart={(explanation) => start.mutate(explanation)}
					pending={start.isPending}
					error={start.isError ? errorMessage(start.error) : null}
				/>
			) : (
				<>
					{session.turns.map((turn) => (
						<TurnCard key={turn.id} session={session} turn={turn} />
					))}

					{openTurn ? (
						<View style={s.composer}>
							<TextInputField
								label="Your answer"
								multiline
								value={answer}
								onChangeText={setAnswer}
								error={reply.isError ? errorMessage(reply.error) : null}
							/>
							<Button
								label={reply.isPending ? 'Waiting for the class…' : 'Answer'}
								loading={reply.isPending}
								disabled={!answer.trim() || reply.isPending}
								fullWidth
								onPress={() => reply.mutate({ turn: openTurn, outcome: 'answered' })}
							/>
							<Button
								label="Skip this one"
								variant="ghost"
								disabled={reply.isPending}
								fullWidth
								onPress={() => reply.mutate({ turn: openTurn, outcome: 'skipped' })}
							/>
						</View>
					) : (
						<View style={s.composer}>
							<Text variant="body">Class finished. Nice teaching.</Text>
							<Button label="Back to home" fullWidth onPress={() => router.back()} />
						</View>
					)}
				</>
			)}
		</Screen>
	)
}

const s = StyleSheet.create({
	turn: { gap: 8 },
	bubble: { gap: 6 },
	answer: { paddingHorizontal: 12 },
	composer: { gap: 10, paddingTop: 8 }
})
