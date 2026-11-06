import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ProgressVideo } from '@app/contract'
import { Dashboard, DashboardEmpty, type QuizBest } from '@/components/dashboard/Dashboard'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { QueryErrorState } from '@/components/QueryError'
import { useTabBarClearance } from '@/components/TabBar'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { SheetCard } from '@/components/ui/SheetCard'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'
import { dashboardNumbers } from '@/lib/dashboard'
import { loadQuizRecord } from '@/lib/quiz'

/** The backdrop showing above the sheet. */
const BACKDROP_HEIGHT = 64

export default function DashboardScreen() {
	const insets = useSafeAreaInsets()
	const clearance = useTabBarClearance()
	const progress = useQuery({
		queryKey: ['progress'],
		queryFn: () => api('getProgress')
	})
	const [quiz, setQuiz] = useState<QuizBest>(null)

	const loaded = progress.isSuccess
	const refetch = progress.refetch
	useFocusEffect(
		useCallback(() => {
			// A class or a warm-up finished elsewhere moves these numbers.
			if (loaded) void refetch()
			void loadQuizRecord().then((record) =>
				setQuiz(record ? { best: record.best, total: record.lastTotal } : null)
			)
		}, [loaded, refetch])
	)

	const numbers = useMemo(
		() =>
			progress.data ? dashboardNumbers(progress.data, new Date(progress.dataUpdatedAt)) : null,
		[progress.data, progress.dataUpdatedAt]
	)

	const viewed = useRef(false)
	useEffect(() => {
		if (!numbers || viewed.current) return
		viewed.current = true
		track('dashboard_viewed', {
			video_count: numbers.videoCount,
			idea_count: numbers.ideas,
			taught_count: numbers.taught
		})
	}, [numbers])

	function openVideo(video: ProgressVideo) {
		track('dashboard_video_opened', { topic_id: video.id })
		router.push(`/topic/${video.id}`)
	}

	function openMemory() {
		track('memory_opened', { source: 'dashboard' })
		router.push('/memory')
	}

	function teach() {
		track('dashboard_teach_tapped')
		router.navigate('/(tabs)')
	}

	const top = insets.top + BACKDROP_HEIGHT
	return (
		<View style={s.fill}>
			<PixelBackdrop scene="results" />
			<ScrollView
				contentContainerStyle={{ paddingTop: top, paddingBottom: clearance }}
				showsVerticalScrollIndicator={false}
			>
				<SheetCard>
					{numbers ? (
						numbers.videoCount > 0 ? (
							<Dashboard
								numbers={numbers}
								quiz={quiz}
								onOpenVideo={openVideo}
								onOpenMemory={openMemory}
							/>
						) : (
							<DashboardEmpty onTeach={teach} />
						)
					) : progress.isError ? (
						<QueryErrorState
							error={progress.error}
							title="Couldn't load your scores"
							onRetry={() => {
								void refetch()
							}}
						/>
					) : (
						<CardSkeleton height={320} />
					)}
				</SheetCard>
			</ScrollView>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 }
})
