import { useCallback, useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ClassMemory } from '@/components/memory/ClassMemory'
import { NextReminder } from '@/components/memory/NextReminder'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { QueryErrorState } from '@/components/QueryError'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { SheetCard } from '@/components/ui/SheetCard'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'
import { nextReminder } from '@/lib/chalk'
import { useMemoryPush } from '@/lib/memory-push'

function leave() {
	if (router.canGoBack()) router.back()
	else router.replace('/(tabs)')
}

/**
 * What your class might forget: the ideas your explanations missed, with the student who is
 * forgetting one today asking for it, and what comes up next. The next reminder shows at the
 * end when this phone gets them.
 */
export default function MemoryScreen() {
	const { colors: c, elevation } = useTheme()
	const insets = useSafeAreaInsets()
	const remindersOn = useMemoryPush()
	const board = useQuery({
		queryKey: ['memory'],
		queryFn: () => api('listMemory')
	})
	// The board's clock is the moment its ideas arrived, so every refetch (each time the
	// screen comes back into view) counts the days again.
	const fetchedAt = board.dataUpdatedAt
	const now = useMemo(() => (fetchedAt ? new Date(fetchedAt) : new Date()), [fetchedAt])

	const loaded = board.isSuccess
	const refetch = board.refetch
	useFocusEffect(
		useCallback(() => {
			if (loaded) void refetch()
		}, [loaded, refetch])
	)

	const ideas = board.data?.ideas ?? []
	const reminder = remindersOn ? nextReminder(ideas, now) : null

	useEffect(() => {
		if (!loaded) return
		const dueCount = ideas.filter(
			(idea) =>
				!idea.closed &&
				idea.next_due_at != null &&
				new Date(idea.next_due_at).getTime() <= now.getTime()
		).length
		track('memory_viewed', { idea_count: ideas.length, due_count: dueCount })
		// Once per successful load.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loaded])

	return (
		<View style={s.fill}>
			{loaded ? (
				<ClassMemory
					ideas={ideas}
					now={now}
					reminder={
						reminder ? (
							<NextReminder title={reminder.idea.concept_title} at={reminder.at} now={now} />
						) : null
					}
					onAnswer={(idea, student) => {
						track('memory_idea_tapped', { gap_id: idea.gap_id, student })
						router.push(`/warm-up/${idea.gap_id}`)
					}}
					onOpenTopic={(topicId) => {
						track('memory_topic_opened', { topic_id: topicId })
						router.push(`/topic/${topicId}`)
					}}
					onTeach={() => {
						track('memory_teach_tapped')
						router.replace('/(tabs)')
					}}
					onExpand={(ideaCount) => track('memory_list_expanded', { idea_count: ideaCount })}
				/>
			) : (
				<>
					<PixelBackdrop scene="classroom" />
					<View style={s.fill} />
					<SheetCard>
						{board.isError ? (
							<QueryErrorState
								error={board.error}
								title="Couldn't load what your class might forget"
								onRetry={() => {
									void board.refetch()
								}}
							/>
						) : (
							<CardSkeleton height={160} />
						)}
					</SheetCard>
				</>
			)}
			<View style={[s.top, { top: insets.top + 8 }]} pointerEvents="box-none">
				<PressableScale
					onPress={leave}
					accessibilityRole="button"
					accessibilityLabel="Back"
					style={[s.back, { backgroundColor: c.surface }, elevation.soft]}
				>
					<ChevronLeft size={22} color={c.textPrimary} strokeWidth={2.2} />
				</PressableScale>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	top: { position: 'absolute', left: 16, zIndex: 3 },
	back: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: 'center',
		justifyContent: 'center'
	}
})
