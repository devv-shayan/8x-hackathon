import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Video } from '@app/contract'
import { DueWarmUps } from '@/components/DueWarmUps'
import { RecentTopics, topicsQueryKey } from '@/components/RecentTopics'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api, errorMessage } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { topicQueryKey } from '@/lib/topicQuery'
import { youtubeThumbnailUrl } from '@/lib/youtubeThumb'

// Reading a long video can take a minute or more, far past the API default.
const READ_VIDEO_TIMEOUT_MS = 5 * 60 * 1000

function ReadyToTeach({ video }: { video: Video }) {
	const { radii } = useTheme()
	return (
		<FadeSlideIn index={2} style={s.results}>
			<Eyebrow tone="muted">Ready to teach</Eyebrow>
			<Image
				source={{ uri: youtubeThumbnailUrl(video.youtube_id) }}
				style={[s.readyThumb, { borderRadius: radii.md }]}
				contentFit="cover"
				accessibilityIgnoresInvertColors
				accessibilityLabel={`Thumbnail for ${video.title}`}
			/>
			<Text variant="h1">{video.title}</Text>
			<Button
				label="Teach this to the class"
				fullWidth
				onPress={() => router.push(`/class/${video.id}`)}
			/>
		</FadeSlideIn>
	)
}

export default function HomeScreen() {
	const queryClient = useQueryClient()
	const [url, setUrl] = useState('')
	const readVideo = useMutation({
		mutationFn: () =>
			api('readVideo', { body: { url }, timeoutMs: READ_VIDEO_TIMEOUT_MS }).then((r) => r.video),
		onSuccess: (video: Video) => {
			queryClient.setQueryData(topicQueryKey(video.id), video)
			void queryClient.invalidateQueries({ queryKey: topicsQueryKey })
			haptic.success()
			track('video_read', { concept_count: video.concepts.length })
		},
		onError: () => haptic.error()
	})
	const video = readVideo.data

	return (
		<Screen tabs gap={14}>
			<FadeSlideIn index={0} style={s.masthead}>
				<Text variant="title" accessibilityRole="header">
					What did you learn today?
				</Text>
			</FadeSlideIn>

			<FadeSlideIn index={1} style={s.form}>
				<TextInputField
					label="YouTube link"
					placeholder="https://www.youtube.com/watch?v=…"
					value={url}
					onChangeText={setUrl}
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="url"
					error={readVideo.isError ? errorMessage(readVideo.error) : null}
				/>
				<Button
					label={readVideo.isPending ? 'Reading the video…' : 'Read the video'}
					loading={readVideo.isPending}
					disabled={!url.trim() || readVideo.isPending}
					fullWidth
					onPress={() => readVideo.mutate()}
				/>
			</FadeSlideIn>

			{/* Ready sits above warm-ups so a fresh read isn't pushed down by "Nothing due". */}
			{video ? <ReadyToTeach video={video} /> : null}

			<DueWarmUps fillingWait={readVideo.isPending} />

			<View style={s.recent}>
				<RecentTopics />
			</View>
		</Screen>
	)
}

const s = StyleSheet.create({
	masthead: { gap: 4, paddingTop: 8 },
	form: { gap: 12 },
	results: { gap: 12, paddingTop: 8 },
	readyThumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: 'transparent' },
	recent: { paddingTop: 4 }
})
