import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import type { ListedTopic } from '@app/contract'
import { QueryErrorState } from '@/components/QueryError'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'
import { youtubeThumbnailUrl } from '@/lib/youtubeThumb'

export const topicsQueryKey = ['topics'] as const

function TopicRow({ topic }: { topic: ListedTopic }) {
	const { radii } = useTheme()
	const unfinished = topic.open_class_id !== null

	function open() {
		if (unfinished) track('continue_opened', { topic_id: topic.id })
		else track('recent_topic_opened', { topic_id: topic.id })
		router.push(`/class/${topic.id}`)
	}

	return (
		<Card
			onPress={open}
			accessibilityLabel={unfinished ? `Continue ${topic.title}` : `Open ${topic.title}`}
		>
			<View style={s.row}>
				<Image
					source={{ uri: youtubeThumbnailUrl(topic.youtube_id) }}
					style={[s.thumb, { borderRadius: radii.sm }]}
					contentFit="cover"
					accessibilityIgnoresInvertColors
				/>
				<View style={s.copy}>
					<Text variant="body" numberOfLines={2}>
						{topic.title}
					</Text>
					{unfinished ? (
						<Eyebrow tone="brand">Continue</Eyebrow>
					) : (
						<Text variant="caption" tone="secondary">
							Teach again
						</Text>
					)}
				</View>
			</View>
		</Card>
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
		<View style={s.section}>
			<View style={s.heading}>
				<Eyebrow tone="muted">Recent</Eyebrow>
				<Text variant="h3" accessibilityRole="header">
					Your topics
				</Text>
			</View>
			{topics.data.map((topic) => (
				<TopicRow key={topic.id} topic={topic} />
			))}
		</View>
	)
}

const s = StyleSheet.create({
	section: { gap: 12 },
	heading: { gap: 4 },
	row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
	thumb: { width: 96, height: 54, backgroundColor: 'transparent' },
	copy: { flex: 1, gap: 8 }
})
