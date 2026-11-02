import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useIsMutating, useMutationState } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	MAX_WARM_UP_ANSWER_CHARS,
	type AnswerWarmUpResult,
	type DueWarmUp,
	type Video
} from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { useSheetFloor } from '@/components/pixel/useSheetFloor'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { QuestionVoice } from '@/components/voice/QuestionVoice'
import { VoiceAnswer, type AnswerMeta } from '@/components/voice/VoiceAnswer'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useQuestionVoice } from '@/hooks/useQuestionVoice'
import { useAnswerWarmUp, useDueWarmUps, useStartWarmUp } from '@/hooks/useWarmUps'
import { track } from '@/lib/analytics'
import { errorMessage } from '@/lib/api'
import { formatTimestamp } from '@/lib/formatTimestamp'
import { haptic } from '@/lib/haptics'
import { READ_VIDEO_KEY } from '@/lib/topicQuery'

/** What an answer means for the gap: closed, or when it comes back. */
function dueLine(result: AnswerWarmUpResult): string {
	if (result.closed) return 'Two right in a row. This one is closed.'
	const when = result.next_due_at
		? new Date(result.next_due_at).toLocaleDateString(undefined, { weekday: 'long' })
		: null
	if (result.is_right) return when ? `That’s right. It comes back ${when}.` : 'That’s right.'
	return when
		? `Not quite. It comes back ${when}.`
		: 'Not quite. It comes back in a couple of days.'
}

function leave() {
	if (router.canGoBack()) router.back()
	else router.replace('/(tabs)')
}

/**
 * A warm-up: a student from a past class asks about an idea the person missed, alone on the
 * black band's tunnel. While a video is being read, home opens this to fill the wait, and the
 * top says when the video is ready.
 */
export default function WarmUpScreen() {
	const { gapId } = useLocalSearchParams<{ gapId: string }>()
	const { colors: c, elevation } = useTheme()
	const insets = useSafeAreaInsets()
	const due = useDueWarmUps()
	const start = useStartWarmUp()
	const answer = useAnswerWarmUp()
	const [text, setText] = useState('')
	const [answered, setAnswered] = useState<{ gap: DueWarmUp; result: AnswerWarmUpResult } | null>(
		null
	)
	const result = answered?.result ?? null
	const { floor, onScreenLayout, onSheetLayout } = useSheetFloor()
	const started = useRef(false)

	// The read home started, if there is one: still going, or the video it produced.
	const reading = useIsMutating({ mutationKey: READ_VIDEO_KEY }) > 0
	const wasReading = useRef(reading).current
	const read = useMutationState({
		filters: { mutationKey: READ_VIDEO_KEY, status: 'success' },
		select: (mutation) => mutation.state.data as Video | undefined
	}).at(-1)
	const ready = wasReading && !reading && read ? read : null

	// Answering refetches the due list, which no longer has this gap: keep the answered one.
	const gap = due.data?.find((item) => item.gap_id === gapId) ?? answered?.gap ?? null
	const openId = gap?.open_warm_up?.id
	const question = start.data?.question ?? gap?.open_warm_up?.question ?? null
	const warmUpId = start.data?.id ?? openId ?? null
	const student = start.data?.student_name ?? gap?.student_name ?? gap?.open_warm_up?.student_name
	const { mutate } = start
	const asking = question && warmUpId && !result ? warmUpId : null
	const voice = useQuestionVoice({
		surface: 'warm_up',
		source: asking ? { warm_up_id: asking } : null,
		text: question,
		student: student ?? null
	})

	useEffect(() => {
		if (!gap || openId || started.current) return
		started.current = true
		mutate(gap.gap_id)
	}, [gap, openId, mutate])

	useEffect(() => {
		if (question && gap) track('warm_up_started', { gap_id: gap.gap_id })
	}, [question, gap])

	function send(words: string, meta: AnswerMeta) {
		if (!warmUpId || !gap || answer.isPending) return
		answer.mutate(
			{ id: warmUpId, answer: words },
			{
				onSuccess: (judged) => {
					track('warm_up_answered', { gap_id: gap.gap_id, is_right: judged.is_right, ...meta })
					haptic.success()
					setAnswered({ gap, result: judged })
				},
				onError: () => haptic.error()
			}
		)
	}

	const scene = student === 'Omar' ? 'warmUpOmar' : 'warmUpMaya'
	const raised = result ? {} : { [student === 'Omar' ? 'Omar' : 'Maya']: 1 }

	return (
		<View style={[s.fill, { backgroundColor: c.hero }]} onLayout={onScreenLayout}>
			<StatusBar style="light" />
			<PixelBackdrop scene={scene} raised={raised} floor={floor} />
			<View style={[s.bar, { top: insets.top + 8 }]} pointerEvents="box-none">
				<PressableScale
					onPress={leave}
					accessibilityRole="button"
					style={[s.pill, { backgroundColor: c.surface }, elevation.soft]}
				>
					<Text variant="label" style={s.pillText}>
						{result ? 'Done' : 'Not now'}
					</Text>
				</PressableScale>
			</View>
			{wasReading ? (
				<View
					style={[s.reading, { top: insets.top + 64, backgroundColor: c.surface }, elevation.soft]}
					accessibilityLiveRegion="polite"
				>
					<MonoLabel>{ready ? 'Your video is ready' : 'Reading your video'}</MonoLabel>
					<View style={[s.track, { backgroundColor: c.surface3 }]}>
						<View
							style={[s.progress, { backgroundColor: c.brandFill, width: ready ? '100%' : '62%' }]}
						/>
					</View>
				</View>
			) : null}
			<View style={s.fill} pointerEvents="none" />
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				onLayout={onSheetLayout}
			>
				<SheetCard>
					<MonoLabel
						right={
							asking && student ? (
								<QuestionVoice state={voice.state} student={student} onReplay={voice.replay} />
							) : undefined
						}
					>
						{gap ? `Warm-up · ${student ?? 'A student'} · ${gap.topic_title}` : 'Warm-up'}
					</MonoLabel>
					{!gap ? (
						<>
							<Text variant="question" style={s.question}>
								{due.isPending ? 'Finding your warm-up…' : 'Nothing due right now.'}
							</Text>
							<Button
								label="Back"
								variant="ink"
								size="lg"
								fullWidth
								onPress={leave}
								style={s.cta}
							/>
						</>
					) : result ? (
						<>
							<Text variant="question" style={s.question} accessibilityLiveRegion="polite">
								{dueLine(result)}
							</Text>
							<Text variant="lead" tone="secondary" style={s.lede}>
								{gap.concept_title}
							</Text>
							{ready ? (
								<Button
									label="Explain your new video"
									variant="ink"
									size="lg"
									fullWidth
									onPress={() => router.replace(`/class/${ready.id}`)}
									style={s.cta}
								/>
							) : (
								<Button
									label="Done"
									variant="ink"
									size="lg"
									fullWidth
									onPress={leave}
									style={s.cta}
								/>
							)}
						</>
					) : question && warmUpId ? (
						<>
							<Text variant="question" style={s.question} accessibilityRole="header">
								{question}
							</Text>
							<Text variant="lead" tone="secondary" style={s.lede}>
								{gap.has_timestamp === false
									? `You missed this one: ${gap.concept_title}.`
									: `You missed this one at ${formatTimestamp(gap.start_seconds)}: ${gap.concept_title}.`}
							</Text>
							<VoiceAnswer
								key={warmUpId}
								surface="warm_up"
								student={student ?? 'the student'}
								question={question}
								typed={text}
								onTypedChange={setText}
								onSend={send}
								sending={answer.isPending}
								sendingLabel="Checking…"
								maxLength={MAX_WARM_UP_ANSWER_CHARS}
								error={answer.isError ? errorMessage(answer.error) : null}
								secondary={{
									label: 'I don’t remember',
									onPress: () => send('I don’t remember.', { method: 'typed' })
								}}
							/>
						</>
					) : start.isError ? (
						<>
							<Text variant="body" style={s.question}>
								{errorMessage(start.error)}
							</Text>
							<Button
								label="Try again"
								variant="ink"
								size="lg"
								fullWidth
								onPress={() => start.mutate(gap.gap_id)}
								style={s.cta}
							/>
						</>
					) : (
						<Text variant="question" style={s.question}>
							{`${student ?? 'A student'} is thinking of a question…`}
						</Text>
					)}
				</SheetCard>
			</KeyboardAvoidingView>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	bar: { position: 'absolute', left: 16, right: 16, zIndex: 2, flexDirection: 'row' },
	pill: { height: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center' },
	pillText: { fontSize: 15 },
	reading: {
		position: 'absolute',
		left: 16,
		right: 16,
		zIndex: 2,
		gap: 10,
		padding: 14,
		borderRadius: 18
	},
	track: { height: 4 },
	progress: { height: 4 },
	question: { marginTop: 14 },
	lede: { marginTop: 8 },
	cta: { marginTop: 16 }
})
