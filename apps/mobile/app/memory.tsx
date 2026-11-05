import { useCallback, useEffect, useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MemoryBoard } from '@/components/memory/MemoryBoard'
import { NextReminder } from '@/components/memory/NextReminder'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { QueryErrorState } from '@/components/QueryError'
import { CardSkeleton } from '@/components/ui/Skeleton'
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
 * Maya's board: her gaps on a white sheet, shimmering as they fade until the one that is due,
 * under her next reminder when this phone gets them.
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
			<PixelBackdrop scene="welcome" />
			<ScrollView
				style={s.fill}
				contentContainerStyle={{
					paddingTop: insets.top + 64,
					paddingBottom: insets.bottom + 24,
					paddingHorizontal: 16,
					gap: 16
				}}
				showsVerticalScrollIndicator={false}
			>
				<View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
					<PressableScale
						onPress={leave}
						accessibilityRole="button"
						accessibilityLabel="Back"
						style={[s.back, { backgroundColor: c.surface }, elevation.soft]}
					>
						<ChevronLeft size={22} color={c.textPrimary} strokeWidth={2.2} />
					</PressableScale>
				</View>
				{board.isPending ? <CardSkeleton height={120} /> : null}
				{reminder ? (
					<NextReminder title={reminder.idea.concept_title} at={reminder.at} now={now} />
				) : null}
				{board.isPending ? null : (
					<MemoryBoard
						ideas={ideas}
						now={now}
						showEmpty={loaded && ideas.length === 0}
						onPractice={(gapId) => {
							track('memory_idea_tapped', { gap_id: gapId })
							router.push(`/warm-up/${gapId}`)
						}}
						onOpenTopic={(topicId) => {
							track('memory_topic_opened', { topic_id: topicId })
							router.push(`/topic/${topicId}`)
						}}
					/>
				)}
				{board.isError ? (
					<QueryErrorState
						error={board.error}
						title="Couldn't load Maya's memory"
						onRetry={() => {
							void board.refetch()
						}}
					/>
				) : null}
			</ScrollView>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	top: { position: 'absolute', left: 16, zIndex: 2 },
	back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }
})
