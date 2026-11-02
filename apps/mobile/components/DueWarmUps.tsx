import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { MAX_WARM_UP_ANSWER_CHARS, type AnswerWarmUpResult, type DueWarmUp } from '@app/contract'
import { QueryErrorState } from '@/components/QueryError'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useAnswerWarmUp, useDueWarmUps, useStartWarmUp } from '@/hooks/useWarmUps'
import { track } from '@/lib/analytics'
import { errorMessage } from '@/lib/api'
import { formatTimestamp } from '@/lib/formatTimestamp'
import { haptic } from '@/lib/haptics'

type Finished = {
	gapId: string
	conceptTitle: string
	result: AnswerWarmUpResult
}

function topicLine(gap: DueWarmUp): string {
	if (gap.has_timestamp === false) return gap.topic_title
	return `${gap.topic_title} · ${formatTimestamp(gap.start_seconds)}`
}

function dueLine(result: AnswerWarmUpResult): string {
	if (result.closed) return 'Two right in a row. This gap is closed.'
	const when = result.next_due_at
		? new Date(result.next_due_at).toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric'
			})
		: null
	if (result.is_right) return when ? `That's right. Due again ${when}.` : "That's right."
	return when
		? `Not quite. Due again ${when}.`
		: 'Not quite. It will come back in a couple of days.'
}

function FinishedWarmUp({ item }: { item: Finished }) {
	return (
		<Card>
			<View style={s.copy}>
				<Eyebrow tone={item.result.is_right ? 'brand' : 'muted'}>
					{item.result.is_right ? 'Right' : 'Not quite'}
				</Eyebrow>
				<Text variant="h3">{item.conceptTitle}</Text>
				<Text variant="bodySm" tone="secondary" accessibilityLiveRegion="polite">
					{dueLine(item.result)}
				</Text>
			</View>
		</Card>
	)
}

function WarmUpSession({
	gap,
	onFinished
}: {
	gap: DueWarmUp
	onFinished: (item: Finished) => void
}) {
	const start = useStartWarmUp()
	const answer = useAnswerWarmUp()
	const [text, setText] = useState('')
	const startedRef = useRef(false)
	const { mutate } = start
	const openId = gap.open_warm_up?.id
	const question = start.data?.question ?? gap.open_warm_up?.question ?? null
	const warmUpId = start.data?.id ?? openId ?? null
	const studentName = start.data?.student_name ?? gap.open_warm_up?.student_name ?? null

	useEffect(() => {
		if (openId || startedRef.current) return
		startedRef.current = true
		mutate(gap.gap_id)
	}, [openId, gap.gap_id, mutate])

	useEffect(() => {
		if (!question) return
		track('warm_up_started', { gap_id: gap.gap_id })
	}, [question, gap.gap_id])

	function send() {
		const words = text.trim()
		if (!warmUpId || words.length === 0 || answer.isPending) return
		answer.mutate(
			{ id: warmUpId, answer: words },
			{
				onSuccess: (result) => {
					track('warm_up_answered', { gap_id: gap.gap_id, is_right: result.is_right })
					haptic.success()
					onFinished({ gapId: gap.gap_id, conceptTitle: gap.concept_title, result })
				},
				onError: () => haptic.error()
			}
		)
	}

	return (
		<Card>
			<View style={s.copy}>
				<Eyebrow tone="muted">{studentName ?? 'Warm-up'}</Eyebrow>
				<Text variant="h3">{gap.concept_title}</Text>
				<Text variant="caption" tone="secondary">
					{topicLine(gap)}
				</Text>
				{question ? (
					<Text
						variant="body"
						accessibilityLabel={studentName ? `${studentName} asks: ${question}` : question}
					>
						{question}
					</Text>
				) : start.isError ? (
					<>
						<Text variant="bodySm" tone="error">
							{errorMessage(start.error)}
						</Text>
						<Button
							label="Try again"
							variant="secondary"
							onPress={() => start.mutate(gap.gap_id)}
						/>
					</>
				) : (
					<Text variant="bodySm" tone="secondary">
						Thinking of a question…
					</Text>
				)}
				{question && warmUpId ? (
					<>
						<TextInputField
							label="Your answer"
							value={text}
							onChangeText={setText}
							multiline
							numberOfLines={4}
							maxLength={MAX_WARM_UP_ANSWER_CHARS}
							textAlignVertical="top"
							error={answer.isError ? errorMessage(answer.error) : null}
						/>
						<Button
							label="Send answer"
							fullWidth
							loading={answer.isPending}
							disabled={text.trim().length === 0}
							onPress={send}
						/>
					</>
				) : null}
			</View>
		</Card>
	)
}

function WarmUpCard({
	gap,
	expanded,
	onOpen,
	onFinished
}: {
	gap: DueWarmUp
	expanded: boolean
	onOpen: () => void
	onFinished: (item: Finished) => void
}) {
	useEffect(() => {
		track('warm_up_offered', { gap_id: gap.gap_id })
	}, [gap.gap_id])

	if (expanded) return <WarmUpSession gap={gap} onFinished={onFinished} />

	const open = gap.open_warm_up
	return (
		<Card>
			<View style={s.copy}>
				<Text variant="caption" tone="secondary">
					{topicLine(gap)}
				</Text>
				<Text variant="body" style={s.concept}>
					{gap.concept_title}
				</Text>
				{open ? (
					<Text variant="bodySm" tone="secondary" numberOfLines={3}>
						{`${open.student_name}: ${open.question}`}
					</Text>
				) : (
					<Text variant="bodySm" tone="secondary">
						A student from class has a question about this.
					</Text>
				)}
				<Button
					label={open ? 'Continue' : 'Answer'}
					variant="secondary"
					onPress={onOpen}
					accessibilityLabel={
						open
							? `Continue ${open.student_name}'s question about ${gap.concept_title}`
							: `Answer a question about ${gap.concept_title}`
					}
				/>
			</View>
		</Card>
	)
}

/** Due warm-ups on Home, and one of them while a video is being read. */
export function DueWarmUps({ fillingWait }: { fillingWait: boolean }) {
	const due = useDueWarmUps()
	const [openGapId, setOpenGapId] = useState<string | null>(null)
	const [finished, setFinished] = useState<Finished[]>([])
	const firstDueId = fillingWait ? (due.data?.[0]?.gap_id ?? null) : null

	useEffect(() => {
		if (firstDueId) setOpenGapId(firstDueId)
	}, [firstDueId])

	if (due.isPending) return <CardSkeleton height={96} />
	if (due.isError) {
		return (
			<QueryErrorState
				error={due.error}
				title="Couldn't load warm-ups"
				onRetry={() => {
					void due.refetch()
				}}
			/>
		)
	}

	const finishedIds = new Set(finished.map((item) => item.gapId))
	const remaining = (due.data ?? []).filter((gap) => !finishedIds.has(gap.gap_id))
	// One question fills the wait. A second gap waits until the video read is done.
	const duringWait = fillingWait && finished.length === 0 ? remaining[0] : undefined
	const showEmpty = !fillingWait && remaining.length === 0 && finished.length === 0
	const showList = !fillingWait && remaining.length > 0
	if (finished.length === 0 && !showEmpty && !showList && !duringWait) return null

	function keep(item: Finished) {
		setFinished((prev) => [...prev, item])
	}

	return (
		<View style={s.section}>
			{finished.map((item) => (
				<FinishedWarmUp key={item.gapId} item={item} />
			))}
			{duringWait ? (
				<WarmUpCard
					key={duringWait.gap_id}
					gap={duringWait}
					expanded
					onOpen={() => setOpenGapId(duringWait.gap_id)}
					onFinished={keep}
				/>
			) : null}
			{showEmpty ? (
				<Card>
					<View style={s.copy}>
						<Eyebrow tone="muted">Warm-ups</Eyebrow>
						<Text variant="h3" accessibilityRole="header">
							Nothing due
						</Text>
						<Text variant="bodySm" tone="secondary">
							A warm-up shows up a couple of days after you miss something in class.
						</Text>
					</View>
				</Card>
			) : null}
			{showList ? (
				<View style={s.section}>
					<View style={s.copy}>
						<Eyebrow tone="muted">Warm-ups</Eyebrow>
						<Text variant="h3" accessibilityRole="header">
							Due now
						</Text>
					</View>
					{remaining.map((gap) => (
						<WarmUpCard
							key={gap.gap_id}
							gap={gap}
							expanded={openGapId === gap.gap_id}
							onOpen={() => setOpenGapId(gap.gap_id)}
							onFinished={keep}
						/>
					))}
				</View>
			) : null}
		</View>
	)
}

const s = StyleSheet.create({
	section: { gap: 12 },
	copy: { gap: 8 },
	concept: { fontWeight: '600' }
})
