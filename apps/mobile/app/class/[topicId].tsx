import { useEffect, useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
	MAX_CLASS_QUESTIONS,
	MIN_EXPLANATION_LENGTH,
	type ClassSession,
	type ClassTurn,
	type ConceptResult,
	type TurnOutcome,
	type Video
} from '@app/contract'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useColors } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api, errorMessage } from '@/lib/api'
import { finalResult, summarizeResults } from '@/lib/assessment'
import { formatTimestamp } from '@/lib/formatTimestamp'
import { haptic } from '@/lib/haptics'
import { topicQueryKey } from '@/lib/topicQuery'
import { youtubeWatchUrl } from '@/lib/youtubeWatch'

// A student's next question is an AI call, so it takes longer than the API default.
const CLASS_TIMEOUT_MS = 60 * 1000

type SessionTab = 'explain' | 'teach' | 'gaps'

const SESSION_TABS: { value: SessionTab; label: string }[] = [
	{ value: 'explain', label: 'Explain' },
	{ value: 'teach', label: 'Teach' },
	{ value: 'gaps', label: 'Gaps' }
]

function tabTitle(tab: SessionTab) {
	if (tab === 'explain') return 'Explain'
	if (tab === 'teach') return 'Teach'
	return 'Gaps'
}

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

// A class opened from a link or a reload has nothing behind it to go back to.
function leaveClass() {
	if (router.canGoBack()) router.back()
	else router.replace('/(tabs)')
}

function resultLabel(result: ConceptResult['result']) {
	if (result === 'correct') return 'Correct'
	if (result === 'missed') return 'Missed'
	return 'Wrong'
}

function outcomeLabel(outcome: TurnOutcome) {
	if (outcome === 'answered') return 'Answered'
	if (outcome === 'needed_help') return 'Needed help'
	return 'Skipped'
}

function ConceptCard({
	item,
	label,
	youtubeId
}: {
	item: ConceptResult
	label: string
	youtubeId: string | null
}) {
	const canOpen = Boolean(youtubeId)

	function openClip() {
		if (!youtubeId) return
		track('assessment_clip_opened', { concept: item.concept })
		void Linking.openURL(youtubeWatchUrl(youtubeId, item.start_seconds))
	}

	return (
		<Card
			onPress={canOpen ? openClip : undefined}
			accessibilityLabel={
				canOpen
					? `Open video for ${item.concept}${item.start_seconds != null ? ` at ${formatTimestamp(item.start_seconds)}` : ''}`
					: undefined
			}
		>
			<View style={s.conceptRow}>
				<Eyebrow tone="muted">
					{item.start_seconds != null ? formatTimestamp(item.start_seconds) : label}
				</Eyebrow>
				<Text variant="body" style={{ fontWeight: '600' }}>
					{item.concept}
				</Text>
				{item.quote ? (
					<Text variant="bodySm" tone="secondary">
						{`“${item.quote}”`}
					</Text>
				) : null}
				<Text variant="caption" tone="secondary">
					{canOpen ? `${label} · Open in YouTube` : label}
				</Text>
			</View>
		</Card>
	)
}

function ScoreCard({ score, label }: { score: string; label: string }) {
	return (
		<View style={s.scoreCard}>
			<Card>
				<View style={s.conceptRow}>
					<Text variant="h1">{score}</Text>
					<Text variant="caption" tone="secondary">
						{label}
					</Text>
				</View>
			</Card>
		</View>
	)
}

function Assessment({ session }: { session: ClassSession }) {
	const results = session.concept_results ?? []
	const reactions = session.reactions ?? []
	const { correct, finalCorrect, scoredAfterClass, fixed, gaps } = summarizeResults(results)
	const answered = session.turns.filter(({ outcome }) => outcome !== null)
	const youtubeId = session.youtube_id

	useEffect(() => {
		if (results.length === 0) return
		track('assessment_viewed', {
			correct_count: correct,
			final_correct_count: finalCorrect,
			fixed_count: fixed.length,
			concept_count: results.length
		})
	}, [correct, finalCorrect, fixed.length, results.length])

	return (
		<View style={s.assessment}>
			{scoredAfterClass ? (
				<View style={s.scores} accessibilityRole="header">
					<ScoreCard score={`${correct} of ${results.length}`} label="In your first explanation" />
					<ScoreCard score={`${finalCorrect} of ${results.length}`} label="By the end of class" />
				</View>
			) : (
				<>
					<Text variant="h1" accessibilityRole="header">
						{results.length > 0 ? `${correct} of ${results.length}` : 'Class finished'}
					</Text>
					<Text variant="lead" tone="secondary">
						{results.length > 0
							? 'How your explanation scored, and how the class went.'
							: 'Your explanation score isn’t available for this class.'}
					</Text>
				</>
			)}

			{fixed.length > 0 ? (
				<View style={s.section}>
					<Eyebrow tone="muted">Fixed in class</Eyebrow>
					<Text variant="bodySm" tone="secondary">
						You got these while teaching. They’ll come back in a warm-up to check they stuck.
					</Text>
					{fixed.map((item) => (
						<ConceptCard
							key={item.concept}
							item={item}
							label={`${resultLabel(item.result)} at first`}
							youtubeId={youtubeId}
						/>
					))}
				</View>
			) : null}

			{gaps.length > 0 ? (
				<View style={s.section}>
					<Eyebrow tone="muted">
						{scoredAfterClass ? 'Still missed or wrong' : 'Missed or wrong'}
					</Eyebrow>
					{gaps.map((item) => (
						<ConceptCard
							key={item.concept}
							item={item}
							label={resultLabel(finalResult(item))}
							youtubeId={youtubeId}
						/>
					))}
				</View>
			) : null}

			{answered.length > 0 ? (
				<View style={s.section}>
					<Eyebrow tone="muted">How each question went</Eyebrow>
					{answered.map((turn) => (
						<Card key={turn.id}>
							<View style={s.conceptRow}>
								<Eyebrow tone="muted">
									{`${studentName(session, turn)} · ${outcomeLabel(turn.outcome!)}`}
								</Eyebrow>
								<Text variant="body">{turn.question}</Text>
							</View>
						</Card>
					))}
				</View>
			) : (
				<Text variant="body" tone="secondary">
					You didn’t answer any questions this time.
				</Text>
			)}

			{reactions.length > 0 ? (
				<View style={s.section}>
					<Eyebrow tone="muted">From the class</Eyebrow>
					{reactions.map((reaction) => {
						const who =
							session.students.find(({ id }) => id === reaction.student_id)?.name ?? 'A student'
						return (
							<Card key={reaction.student_id}>
								<View style={s.conceptRow}>
									<Eyebrow tone="muted">{who}</Eyebrow>
									<Text variant="body">{reaction.text}</Text>
								</View>
							</Card>
						)
					})}
				</View>
			) : null}

			<Button label="Back to home" fullWidth onPress={leaveClass} />
		</View>
	)
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
	topicId,
	title,
	onStart,
	pending,
	error
}: {
	topicId: string
	title: string | null
	onStart: (explanation: string) => void
	pending: boolean
	error: string | null
}) {
	const [explanation, setExplanation] = useState('')
	const ready = explanation.trim().length >= MIN_EXPLANATION_LENGTH

	useEffect(() => {
		track('explain_viewed', { topic_id: topicId })
	}, [topicId])

	return (
		<View style={s.explain}>
			{title ? (
				<Text variant="h1" accessibilityRole="header">
					{title}
				</Text>
			) : null}
			<Text variant="lead" tone="secondary">
				The source stays hidden. Your score stays hidden until the class ends.
			</Text>
			<TextInputField
				label="Your explanation"
				placeholder="What’s the main idea, and how does it work?"
				multiline
				numberOfLines={8}
				value={explanation}
				onChangeText={setExplanation}
				error={error}
				hint={
					!ready && explanation.trim().length > 0
						? `A few more words — at least ${MIN_EXPLANATION_LENGTH} characters.`
						: undefined
				}
			/>
			<Button
				label={pending ? 'Students are thinking…' : 'I’m done'}
				loading={pending}
				disabled={!ready || pending}
				fullWidth
				onPress={() => onStart(explanation)}
			/>
		</View>
	)
}

export default function ClassScreen() {
	const { topicId } = useLocalSearchParams<{ topicId: string }>()
	const [current, setSession] = useState<ClassSession | null>(null)
	const [answer, setAnswer] = useState('')
	const [pickedId, setPickedId] = useState<string | null>(null)
	const [helpOpen, setHelpOpen] = useState(false)
	const [tab, setTab] = useState<SessionTab>('explain')

	// Leaving mid-class doesn't lose it: the same hands are up when the person comes back.
	const open = useQuery({
		queryKey: ['open-class', topicId],
		queryFn: () => api('openClass', { query: { topic_id: topicId } }),
		gcTime: 0
	})
	const cachedTopic = useQuery({
		queryKey: topicQueryKey(topicId),
		queryFn: async ({ client }) => client.getQueryData<Video>(topicQueryKey(topicId)) ?? null,
		staleTime: Infinity
	})
	const topic = useQuery({
		queryKey: ['topic-summary', topicId],
		queryFn: () => api('getTopic', { params: { id: topicId } }).then((r) => r.topic),
		enabled: Boolean(topicId) && !cachedTopic.data?.title,
		staleTime: Infinity
	})
	const videoTitle = cachedTopic.data?.title ?? topic.data?.title ?? null
	const session = current ?? open.data?.class ?? null
	const resumedId = open.data?.class?.id
	const canTeach = Boolean(session)
	const canSeeGaps = Boolean(session?.finished)

	useEffect(() => {
		if (resumedId) track('class_resumed')
	}, [resumedId])

	const sessionId = session?.id
	const classFinished = Boolean(session?.finished)
	// Keep the active tab on the stage that just unlocked.
	useEffect(() => {
		if (classFinished) setTab('gaps')
		else if (sessionId) setTab('teach')
		else setTab('explain')
	}, [sessionId, classFinished])

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
			setTab('teach')
		},
		onError: () => haptic.error()
	})

	const hands = session?.turns.filter(({ outcome }) => outcome === null) ?? []
	const answered = session?.turns.filter(({ outcome }) => outcome !== null) ?? []
	const openTurn = hands.find(({ id }) => id === pickedId) ?? hands[0]

	function finishClass(finished: ClassSession, endedEarly: boolean) {
		track('class_finished', { question_count: finished.turns.length, ended_early: endedEarly })
		setSession(finished)
		setTab('gaps')
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
	const showTabs = !open.isPending && !open.isError

	return (
		<Screen header={<PageHeader title={tabTitle(tab)} onBack={leaveClass} />} gap={14}>
			{open.isPending ? (
				<Text variant="body" tone="secondary">
					Checking for your class…
				</Text>
			) : open.isError ? (
				<>
					<Text variant="body">{errorMessage(open.error)}</Text>
					<Button label="Try again" fullWidth onPress={() => open.refetch()} />
				</>
			) : (
				<>
					{showTabs ? (
						<SegmentedControl<SessionTab>
							accessibilityLabel="Session stage"
							value={tab}
							onChange={setTab}
							segments={SESSION_TABS.map((item) => ({
								...item,
								disabled:
									(item.value === 'teach' && !canTeach) || (item.value === 'gaps' && !canSeeGaps)
							}))}
						/>
					) : null}

					{tab === 'explain' ? (
						session ? (
							<View style={s.explain}>
								{videoTitle ? (
									<Text variant="h1" accessibilityRole="header">
										{videoTitle}
									</Text>
								) : null}
								<Text variant="lead" tone="secondary">
									You already explained this. Switch to Teach for the class, or Gaps when it ends.
								</Text>
								{canTeach ? (
									<Button label="Back to Teach" fullWidth onPress={() => setTab('teach')} />
								) : null}
							</View>
						) : (
							<ExplainStep
								topicId={topicId}
								title={videoTitle}
								onStart={(explanation) => start.mutate(explanation)}
								pending={start.isPending}
								error={start.isError ? errorMessage(start.error) : null}
							/>
						)
					) : null}

					{tab === 'teach' && session && !session.finished ? (
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
											track('class_hand_picked', {
												student: studentName(session, turn)
											})
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
										error={
											reply.isError || end.isError ? errorMessage(reply.error ?? end.error) : null
										}
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
											track('class_help_opened', {
												student: studentName(session, openTurn)
											})
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
							) : null}

							{openTurn ? (
								<HelpSheet
									session={session}
									turn={openTurn}
									open={helpOpen}
									onClose={() => setHelpOpen(false)}
								/>
							) : null}
						</>
					) : null}

					{tab === 'gaps' && session?.finished ? <Assessment session={session} /> : null}
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
	chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
	assessment: { gap: 14, paddingTop: 4 },
	scores: { flexDirection: 'row', gap: 10 },
	scoreCard: { flex: 1 },
	section: { gap: 10 },
	conceptRow: { gap: 6 },
	explain: { gap: 14 }
})
