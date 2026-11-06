import { useEffect, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClassSession, ClassTurn, TurnOutcome, Video } from '@app/contract'
import { topicsQueryKey } from '@/components/RecentTopics'
import { ClassStep } from '@/components/class/ClassStep'
import { ExplainStep } from '@/components/class/ExplainStep'
import { ResultsStep } from '@/components/class/ResultsStep'
import { LoadingScreen } from '@/components/pixel/LoadingScreen'
import {
	answerOrCatchUp,
	CLASS_TIMEOUT_MS,
	leaveClass,
	studentName
} from '@/components/class/shared'
import { Button } from '@/components/ui/Button'
import type { AnswerMeta } from '@/components/voice/VoiceAnswer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import { track } from '@/lib/analytics'
import { api, errorMessage } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { topicQueryKey } from '@/lib/topicQuery'

/**
 * One video's class, in three steps that follow the session: explain it (no class yet), teach
 * the class (an open class), then the results (a finished class). This route owns the session
 * and every call; each step only draws it.
 */
/** An answer or a skip, and for an answer how it was given (voice or typed). */
type Reply = { turn: ClassTurn; outcome: TurnOutcome; text?: string; meta?: AnswerMeta }

export default function ClassScreen() {
	const { topicId } = useLocalSearchParams<{ topicId: string }>()
	const queryClient = useQueryClient()
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
	const youtubeId = cachedTopic.data?.youtube_id ?? topic.data?.youtube_id ?? null
	const session = current ?? open.data?.class ?? null
	const resumedId = open.data?.class?.id

	useEffect(() => {
		if (resumedId) track('class_resumed')
	}, [resumedId])

	const start = useMutation({
		mutationFn: ({ explanation }: { explanation: string; meta: AnswerMeta }) =>
			api('startClass', {
				body: { topic_id: topicId, explanation },
				timeoutMs: CLASS_TIMEOUT_MS
			}),
		onSuccess: ({ class: started }, { meta }) => {
			haptic.success()
			track('class_started', meta)
			setSession(started)
		},
		onError: () => haptic.error()
	})

	const hands = session?.turns.filter(({ outcome }) => outcome === null) ?? []
	const answered = session?.turns.filter(({ outcome }) => outcome !== null) ?? []
	// Nobody asks until the person calls on them: a hand up is only a hand up.
	const openTurn = hands.find(({ id }) => id === pickedId)

	function finishClass(finished: ClassSession, endedEarly: boolean) {
		track('class_finished', { question_count: finished.turns.length, ended_early: endedEarly })
		setSession(finished)
	}
	const reply = useMutation({
		mutationFn: ({ turn, outcome, text }: Reply) =>
			answerOrCatchUp(
				session?.id ?? '',
				turn.id,
				outcome === 'skipped' ? { outcome } : { outcome, answer: text }
			),
		onSuccess: ({ class: updated }, { turn, meta }) => {
			// The server decides needed_help, from whether help was given on this question.
			const saved = updated.turns.find(({ id }) => id === turn.id)
			track('class_answered', { outcome: saved?.outcome ?? 'answered', ...meta })
			if (updated.finished) finishClass(updated, false)
			else setSession(updated)
			setAnswer('')
		},
		onError: () => haptic.error()
	})

	const end = useMutation({
		// Ending scores what was said in class and writes the students' reactions: AI calls.
		mutationFn: () =>
			api('endClass', {
				params: { id: session?.id ?? '' },
				body: {},
				timeoutMs: CLASS_TIMEOUT_MS
			}),
		onSuccess: ({ class: ended }) => finishClass(ended, true),
		onError: () => haptic.error()
	})

	const flag = useMutation({
		mutationFn: (concept: string) =>
			api('flagNotInVideo', {
				params: { id: session?.id ?? '' },
				body: { concept }
			}),
		onSuccess: ({ class: updated }, concept) => {
			track('concept_not_in_video', { concept })
			setSession(updated)
			void queryClient.invalidateQueries({ queryKey: topicsQueryKey })
			void queryClient.invalidateQueries({ queryKey: ['topic-gaps', topicId] })
			haptic.success()
		},
		onError: () => haptic.error()
	})

	if (session && !session.finished) {
		return (
			<ClassStep
				session={session}
				hands={hands}
				answeredCount={answered.length}
				openTurn={openTurn}
				answer={answer}
				onAnswerChange={setAnswer}
				onPick={(turn) => {
					track('class_hand_picked', { student: studentName(session, turn) })
					setPickedId(turn.id)
				}}
				onAnswer={(text, meta) =>
					openTurn && reply.mutate({ turn: openTurn, outcome: 'answered', text, meta })
				}
				onSkip={() => openTurn && reply.mutate({ turn: openTurn, outcome: 'skipped' })}
				onEnd={() => end.mutate()}
				answering={reply.isPending}
				ending={end.isPending}
				error={reply.isError || end.isError ? errorMessage(reply.error ?? end.error) : null}
				helpOpen={helpOpen}
				onHelp={() => {
					if (!openTurn) return
					track('class_help_opened', { student: studentName(session, openTurn) })
					setHelpOpen(true)
				}}
				onCloseHelp={() => setHelpOpen(false)}
			/>
		)
	}

	if (session) {
		return (
			<ResultsStep
				session={session}
				title={videoTitle}
				onNotInVideo={(concept) => flag.mutate(concept)}
				flaggingConcept={flag.isPending ? flag.variables : null}
			/>
		)
	}

	if (!open.isPending && !open.isError) {
		return (
			<ExplainStep
				topicId={topicId}
				title={videoTitle}
				youtubeId={youtubeId}
				ideaCount={cachedTopic.data?.concepts.length ?? null}
				onStart={(explanation, meta) => start.mutate({ explanation, meta })}
				pending={start.isPending}
				error={start.isError ? errorMessage(start.error) : null}
			/>
		)
	}

	if (open.isPending) {
		return <LoadingScreen label="Checking for your class" onBack={leaveClass} />
	}

	return (
		<Screen header={<PageHeader title="Explain" onBack={leaveClass} />} gap={14}>
			{open.isError ? (
				<>
					<Text variant="body">{errorMessage(open.error)}</Text>
					<Button label="Try again" fullWidth onPress={() => open.refetch()} />
				</>
			) : null}
		</Screen>
	)
}
