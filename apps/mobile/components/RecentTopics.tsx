import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { isPastedTopic, type ListedTopic } from '@app/contract'
import { QueryErrorState } from '@/components/QueryError'
import { PressableScale } from '@/components/motion/PressableScale'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'
import { youtubeThumbnailUrl } from '@/lib/youtubeThumb'

export const topicsQueryKey = ['topics'] as const

function TopicRow({ topic }: { topic: ListedTopic }) {
	const { colors: c, radii } = useTheme()
	const unfinished = topic.open_class_id !== null

	function open() {
		if (unfinished) track('continue_opened', { topic_id: topic.id })
		else track('recent_topic_opened', { topic_id: topic.id })
		router.push(`/class/${topic.id}`)
	}

	return (
		<PressableScale
			scaleTo="card"
			onPress={open}
			accessibilityRole="button"
			accessibilityLabel={unfinished ? `Continue ${topic.title}` : `Open ${topic.title}`}
			style={[s.row, { borderTopColor: c.borderHairline }]}
		>
			{isPastedTopic(topic.youtube_id) ? null : (
				<Image
					source={{ uri: youtubeThumbnailUrl(topic.youtube_id) }}
					style={[s.thumb, { borderRadius: radii.md }]}
					contentFit="cover"
					accessibilityIgnoresInvertColors
				/>
			)}
			<View style={s.copy}>
				<Text variant="label" numberOfLines={2} style={s.title}>
					{topic.title}
				</Text>
				<Text variant="caption" tone="secondary">
					{unfinished ? 'Class in progress: continue' : 'Teach again'}
				</Text>
			</View>
		</PressableScale>
	)
}

/** The person's recent topics on Home, with Continue when a class is unfinished. */
export function RecentTopics() {
	const viewed = useRef(false)
	const topics = useQuery({
		queryKey: topicsQueryKey,
		queryFn: () => api('listTopics').then((r) => r.topics)
	})

	useEffect(() => {
		if (!topics.isSuccess || viewed.current) return
		viewed.current = true
		track('home_viewed', { topic_count: topics.data.length })
	}, [topics.isSuccess, topics.data])

	if (topics.isPending) return <CardSkeleton height={96} />
	if (topics.isError) {
		return (
			<QueryErrorState
				error={topics.error}
				title="Couldn't load recent topics"
				onRetry={() => {
					void topics.refetch()
				}}
			/>
		)
	}
	if (topics.data.length === 0) return null

	return (
		<View>
			<MonoLabel style={s.heading}>Your videos</MonoLabel>
			{topics.data.map((topic) => (
				<TopicRow key={topic.id} topic={topic} />
			))}
		</View>
	)
}

const s = StyleSheet.create({
	heading: { marginBottom: 8 },
	row: {
		flexDirection: 'row',
		gap: 12,
		alignItems: 'center',
		paddingVertical: 12,
		borderTopWidth: StyleSheet.hairlineWidth
	},
	thumb: { width: 72, height: 40, backgroundColor: 'transparent' },
	copy: { flex: 1, gap: 2 },
	title: { fontSize: 15, lineHeight: 20 }
})
