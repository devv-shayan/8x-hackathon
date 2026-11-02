import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import type { TopicGap } from '@app/contract'
import { QueryErrorState } from '@/components/QueryError'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'

function dueLabel(gap: TopicGap): string {
	if (gap.closed_at) return 'Closed'
	const when = new Date(gap.next_due_at).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric'
	})
	return `Due ${when}`
}

function warmUpLine(isRight: boolean | null): string {
	if (isRight === true) return 'Right'
	if (isRight === false) return 'Wrong'
	return 'Not answered yet'
}

function GapCard({ gap }: { gap: TopicGap }) {
	const closed = gap.closed_at !== null
	return (
		<Card>
			<View style={s.copy}>
				<Eyebrow tone={closed ? 'muted' : 'brand'}>{dueLabel(gap)}</Eyebrow>
				<Text variant="h3">{gap.concept_title}</Text>
				<Text variant="bodySm" tone="secondary">
					{`“${gap.quote}”`}
				</Text>
				{gap.warm_ups.map((warmUp) => (
					<View key={warmUp.id} style={s.warmUp}>
						<Text variant="caption" tone="secondary">
							{`${warmUp.student_name} · ${warmUpLine(warmUp.is_right)}`}
						</Text>
						<Text variant="bodySm">{warmUp.question}</Text>
					</View>
				))}
			</View>
		</Card>
	)
}

export default function TopicGapsScreen() {
	const { topicId } = useLocalSearchParams<{ topicId: string }>()
	const id = typeof topicId === 'string' ? topicId : ''
	const viewed = useRef(false)
	const gaps = useQuery({
		queryKey: ['topic-gaps', id],
		enabled: id.length > 0,
		queryFn: () => api('listTopicGaps', { params: { id } })
	})

	useEffect(() => {
		if (!gaps.isSuccess || viewed.current) return
		viewed.current = true
		track('topic_gaps_viewed', {
			topic_id: id,
			open_count: gaps.data.open_count,
			closed_count: gaps.data.closed_count
		})
	}, [gaps.isSuccess, gaps.data, id])

	return (
		<Screen header={<PageHeader title="Gaps" />} gap={14}>
			{gaps.isPending ? <CardSkeleton height={120} /> : null}
			{gaps.isError ? (
				<QueryErrorState
					error={gaps.error}
					title="Couldn't load gaps"
					onRetry={() => {
						void gaps.refetch()
					}}
				/>
			) : null}
			{gaps.isSuccess ? (
				<>
					<Text variant="h1" accessibilityRole="header">
						{gaps.data.title}
					</Text>
					<Text variant="bodySm" tone="secondary">
						{`${gaps.data.open_count} open · ${gaps.data.closed_count} closed`}
					</Text>
					{gaps.data.gaps.length === 0 ? (
						<Card>
							<View style={s.copy}>
								<Eyebrow tone="muted">No gaps yet</Eyebrow>
								<Text variant="bodySm" tone="secondary">
									Miss something in class and it shows up here, then closes after two right
									warm-ups.
								</Text>
							</View>
						</Card>
					) : (
						gaps.data.gaps.map((gap) => <GapCard key={gap.id} gap={gap} />)
					)}
				</>
			) : null}
		</Screen>
	)
}

const s = StyleSheet.create({
	copy: { gap: 8 },
	warmUp: { gap: 2, paddingTop: 4 }
})
