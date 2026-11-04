import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { isPastedTopic, type Video } from '@app/contract'
import { DueWarmUps, openWarmUp } from '@/components/DueWarmUps'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { RecentTopics, topicsQueryKey } from '@/components/RecentTopics'
import { useTabBarClearance } from '@/components/TabBar'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useTheme } from '@/contexts/ThemeContext'
import { useDueWarmUps } from '@/hooks/useWarmUps'
import { track } from '@/lib/analytics'
import { api, errorCode, errorMessage } from '@/lib/api'
import { haptic } from '@/lib/haptics'
import { READ_VIDEO_KEY, topicQueryKey } from '@/lib/topicQuery'
import { youtubeThumbnailUrl } from '@/lib/youtubeThumb'

// Reading a long video can take a minute or more, far past the API default.
const READ_VIDEO_TIMEOUT_MS = 5 * 60 * 1000

function ReadyToTeach({ video }: { video: Video }) {
	const { radii } = useTheme()
	const pasted = isPastedTopic(video.youtube_id)
	return (
		<View style={s.section}>
			<MonoLabel>Ready to teach</MonoLabel>
			{pasted ? null : (
				<Image
					source={{ uri: youtubeThumbnailUrl(video.youtube_id) }}
					style={[s.readyThumb, { borderRadius: radii['2xl'] }]}
					contentFit="cover"
					accessibilityIgnoresInvertColors
					accessibilityLabel={`Thumbnail for ${video.title}`}
				/>
			)}
			<Text variant="h2">{video.title}</Text>
			<Button
				label="Explain it to the class"
				variant="ink"
				size="lg"
				fullWidth
				onPress={() => router.push(`/class/${video.id}`)}
			/>
		</View>
	)
}

/**
 * Home, on the website's closing lime: what did you learn today, a box for the link, and a
 * sheet with the warm-up that's due and the videos taught before. Reading a video opens a due
 * warm-up to fill the wait.
 */
export default function HomeScreen() {
	const { t } = useTranslation()
	const { colors: c, radii, layout } = useTheme()
	const insets = useSafeAreaInsets()
	const tabClearance = useTabBarClearance()
	const queryClient = useQueryClient()
	const due = useDueWarmUps()
	const [url, setUrl] = useState('')
	const [paste, setPaste] = useState('')
	const offered = useRef(false)

	function fillTheWait() {
		const first = due.data?.[0]
		if (first) openWarmUp(first)
	}

	function onRead(video: Video) {
		queryClient.setQueryData(topicQueryKey(video.id), video)
		void queryClient.invalidateQueries({ queryKey: topicsQueryKey })
		haptic.success()
		track('video_read', { concept_count: video.concepts.length })
	}

	const readVideo = useMutation({
		mutationKey: READ_VIDEO_KEY,
		mutationFn: () =>
			api('readVideo', { body: { url }, timeoutMs: READ_VIDEO_TIMEOUT_MS }).then((r) => r.video),
		onMutate: fillTheWait,
		onSuccess: onRead,
		onError: () => haptic.error()
	})
	const pasteText = useMutation({
		mutationKey: READ_VIDEO_KEY,
		mutationFn: () =>
			api('pasteText', { body: { text: paste }, timeoutMs: READ_VIDEO_TIMEOUT_MS }).then(
				(r) => r.video
			),
		onSuccess: onRead,
		onError: () => haptic.error()
	})

	const video = readVideo.data ?? pasteText.data
	const offerPaste = errorCode(readVideo.error) === 'video_unreadable' && !readVideo.isPending

	useEffect(() => {
		if (!offerPaste || offered.current) return
		offered.current = true
		track('text_paste_offered')
	}, [offerPaste])

	return (
		<View style={s.fill}>
			<PixelBackdrop scene="home" />
			<ScrollView
				style={s.fill}
				contentContainerStyle={{ paddingTop: insets.top + 28, paddingBottom: tabClearance }}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
				showsVerticalScrollIndicator={false}
			>
				<View style={{ paddingHorizontal: layout.gutter }}>
					<Text variant="display" accessibilityRole="header" style={s.headline}>
						What did you learn today?
					</Text>
					<View style={[s.linkCard, { backgroundColor: c.surface, borderRadius: radii['3xl'] }]}>
						<TextInputField
							accessibilityLabel="YouTube link"
							placeholder="Paste a YouTube link"
							value={url}
							onChangeText={setUrl}
							autoCapitalize="none"
							autoCorrect={false}
							keyboardType="url"
							error={readVideo.isError ? errorMessage(readVideo.error) : null}
						/>
						<Button
							label={readVideo.isPending ? 'Reading the video…' : 'Teach it'}
							variant="ink"
							size="lg"
							fullWidth
							loading={readVideo.isPending}
							disabled={!url.trim() || readVideo.isPending}
							onPress={() => readVideo.mutate()}
						/>
						{offerPaste ? (
							<>
								<Text variant="bodySm" tone="secondary">
									{t('Home.pasteHint')}
								</Text>
								<TextInputField
									label={t('Home.pasteLabel')}
									placeholder={t('Home.pastePlaceholder')}
									value={paste}
									onChangeText={setPaste}
									multiline
									numberOfLines={6}
									textAlignVertical="top"
									error={pasteText.isError ? errorMessage(pasteText.error) : null}
								/>
								<Button
									label={pasteText.isPending ? t('Home.pasteButtonBusy') : t('Home.pasteButton')}
									variant="ink"
									size="lg"
									fullWidth
									loading={pasteText.isPending}
									disabled={!paste.trim() || pasteText.isPending}
									onPress={() => pasteText.mutate()}
								/>
							</>
						) : null}
					</View>
				</View>
				<SheetCard style={s.sheet}>
					{/* Ready sits above warm-ups so a fresh read isn't pushed down by "Nothing due". */}
					{video ? <ReadyToTeach video={video} /> : null}
					<DueWarmUps />
					<RecentTopics />
				</SheetCard>
			</ScrollView>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	headline: { marginBottom: 24 },
	linkCard: { padding: 8, gap: 8 },
	sheet: { marginTop: 32, gap: 28, minHeight: 360 },
	section: { gap: 12 },
	readyThumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: 'transparent' }
})
