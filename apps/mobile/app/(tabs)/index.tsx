import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useNavigation } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { isPastedTopic, parseYouTubeVideoId, type DueWarmUp, type Video } from '@app/contract'
import { DueWarmUps, openWarmUp } from '@/components/DueWarmUps'
import { HowAClassWorks, MayaAsks, StarterVideo } from '@/components/home/FirstRun'
import { ClassMemoryLink } from '@/components/memory/ClassMemoryLink'
import { DailyQuizCard } from '@/components/quiz/DailyQuizCard'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { ReadingView, type ReadingPhase } from '@/components/reading/ReadingView'
import { RecentTopics, topicsQueryKey } from '@/components/RecentTopics'
import { useTabBarClearance } from '@/components/TabBar'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useTheme } from '@/contexts/ThemeContext'
import { useVideoTitle } from '@/hooks/useVideoTitle'
import { useDueWarmUps } from '@/hooks/useWarmUps'
import { track } from '@/lib/analytics'
import { api, errorCode, errorMessage } from '@/lib/api'
import { isFirstRun, STARTER_URL, STARTER_VIDEO } from '@/lib/firstRun'
import { haptic } from '@/lib/haptics'
import { READ_VIDEO_KEY, topicQueryKey } from '@/lib/topicQuery'
import { KEYBOARD_LIFT } from '@/lib/keyboard'
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

/** How often the reading screen moves on while a video reads. */
const READING_TICK_MS = 500
/** The server's words for a link that isn't a video, said before it's ever sent. */
const NOT_A_VIDEO = "That doesn't look like a YouTube video link."

/**
 * Home, on the website's closing lime: what did you learn today, a box for the link, and a
 * sheet with the warm-up that's due and the videos taught before. Reading a video shows the
 * class watching it come in on a board (8X-49), with a due warm-up offered to fill the wait.
 */
export default function HomeScreen() {
	const { t } = useTranslation()
	const { colors: c, radii, layout } = useTheme()
	const insets = useSafeAreaInsets()
	const tabClearance = useTabBarClearance()
	const queryClient = useQueryClient()
	const due = useDueWarmUps()
	// The same request and cache as the videos list below.
	const topics = useQuery({
		queryKey: topicsQueryKey,
		queryFn: () => api('listTopics').then((r) => r.topics)
	})
	const firstRun = isFirstRun(topics.data)
	const [url, setUrl] = useState('')
	const [paste, setPaste] = useState('')
	const offered = useRef(false)
	const [watching, setWatching] = useState(false)
	const [linkError, setLinkError] = useState<string | null>(null)
	const [guess, setGuess] = useState<number | null>(null)
	const [readSeconds, setReadSeconds] = useState(0)
	const [now, setNow] = useState(() => Date.now())
	const reader = useRef<AbortController | null>(null)

	function onRead(video: Video) {
		queryClient.setQueryData(topicQueryKey(video.id), video)
		void queryClient.invalidateQueries({ queryKey: topicsQueryKey })
		haptic.success()
		track('video_read', { concept_count: video.concepts.length })
	}

	const readVideo = useMutation({
		mutationKey: READ_VIDEO_KEY,
		mutationFn: (link: string) => {
			reader.current = new AbortController()
			return api('readVideo', {
				body: { url: link },
				signal: reader.current.signal,
				timeoutMs: READ_VIDEO_TIMEOUT_MS
			}).then((r) => r.video)
		},
		onSuccess: (video, _link, _context) => {
			setReadSeconds((Date.now() - (readVideo.submittedAt || Date.now())) / 1000)
			// The link did its job. Coming back to Home shows an empty box.
			setUrl('')
			onRead(video)
		},
		onError: () => haptic.error()
	})
	const readingId = readVideo.variables ? parseYouTubeVideoId(readVideo.variables) : null
	const title = useVideoTitle(watching ? readingId : null)
	const seconds = readVideo.submittedAt ? (now - readVideo.submittedAt) / 1000 : 0

	// The reading screen moves on twice a second while it's open and the video reads.
	useEffect(() => {
		if (!watching || !readVideo.isPending) return
		setNow(Date.now())
		const id = setInterval(() => setNow(Date.now()), READING_TICK_MS)
		return () => clearInterval(id)
	}, [watching, readVideo.isPending])

	function startReading(source: 'link' | 'starter' = 'link', link = url.trim()) {
		// A link that isn't a video never opens the class: say so under the box instead.
		if (!parseYouTubeVideoId(link)) {
			setLinkError(NOT_A_VIDEO)
			haptic.error()
			return
		}
		setLinkError(null)
		setGuess(null)
		setWatching(true)
		track('reading_started', { warm_up_due: (due.data?.length ?? 0) > 0, source })
		readVideo.mutate(link)
	}

	function startStarter() {
		track('first_run_starter_tapped', { youtube_id: STARTER_VIDEO.youtubeId })
		setUrl(STARTER_URL)
		startReading('starter', STARTER_URL)
	}

	function cancelReading() {
		track('reading_cancelled', { seconds: Math.round(seconds) })
		reader.current?.abort()
		readVideo.reset()
		setWatching(false)
	}

	function leaveReading() {
		if (readVideo.isPending) track('reading_left', { seconds: Math.round(seconds) })
		setWatching(false)
	}

	function answerWarmUp(gap: DueWarmUp) {
		openWarmUp(gap)
	}
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

	const phase: ReadingPhase | null = readVideo.isPending
		? { kind: 'reading', seconds }
		: readVideo.isSuccess
			? { kind: 'ready', video: readVideo.data, seconds: readSeconds }
			: readVideo.isError
				? offerPaste
					? { kind: 'unreadable' }
					: {
							kind: 'failed',
							message: errorMessage(readVideo.error),
							busy: errorCode(readVideo.error) === 'unavailable'
						}
				: null

	// The reading screen takes the whole screen: it has its own way back, so the tab bar goes.
	const navigation = useNavigation()
	const takeover = watching && phase !== null
	useEffect(() => {
		navigation.setOptions({ tabBarStyle: takeover ? { display: 'none' } : undefined })
	}, [navigation, takeover])

	// A pasted text that reads becomes the ready card on Home, like a video.
	useEffect(() => {
		if (pasteText.isSuccess) setWatching(false)
	}, [pasteText.isSuccess])

	useEffect(() => {
		if (!offerPaste || offered.current) return
		offered.current = true
		track('text_paste_offered')
	}, [offerPaste])

	const pasteForm = (
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
	)

	if (watching && phase) {
		return (
			<ReadingView
				youtubeId={readingId}
				title={title}
				phase={phase}
				warmUp={due.data?.[0] ?? null}
				guess={guess}
				onGuess={(n) => {
					setGuess(n)
					haptic.select()
					track('reading_guess_made', { guess: n })
				}}
				onAnswerWarmUp={answerWarmUp}
				onCancel={cancelReading}
				onBack={leaveReading}
				onTeach={(read) => {
					setWatching(false)
					router.push(`/class/${read.id}`)
				}}
				onRetry={() => startReading()}
				unreadable={pasteForm}
			/>
		)
	}

	return (
		<View style={s.fill}>
			<PixelBackdrop scene="home" />
			<KeyboardAvoidingView style={s.fill} behavior={KEYBOARD_LIFT}>
				<ScrollView
					style={s.fill}
					contentContainerStyle={{ paddingTop: insets.top + 28, paddingBottom: tabClearance }}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					showsVerticalScrollIndicator={false}
				>
					<View style={{ paddingHorizontal: layout.gutter }}>
						{firstRun ? (
							<MayaAsks />
						) : (
							<Text variant="display" accessibilityRole="header" style={s.headline}>
								What did you learn today?
							</Text>
						)}
						<View style={[s.linkCard, { backgroundColor: c.surface, borderRadius: radii['3xl'] }]}>
							<TextInputField
								accessibilityLabel="YouTube link"
								placeholder="Paste a YouTube link"
								value={url}
								onChangeText={(next) => {
									setUrl(next)
									setLinkError(null)
								}}
								autoCapitalize="none"
								autoCorrect={false}
								keyboardType="url"
								error={linkError ?? (readVideo.isError ? errorMessage(readVideo.error) : null)}
							/>
							<Button
								label={
									readVideo.isPending
										? 'Reading… watch the class'
										: firstRun
											? 'Teach your first video'
											: 'Teach it'
								}
								variant="ink"
								size="lg"
								fullWidth
								disabled={!url.trim() && !readVideo.isPending}
								onPress={() => (readVideo.isPending ? setWatching(true) : startReading())}
							/>
							{offerPaste ? pasteForm : null}
						</View>
						{firstRun && topics.data?.length === 0 && !video ? (
							<StarterVideo onPress={startStarter} disabled={readVideo.isPending} />
						) : null}
					</View>
					<SheetCard style={s.sheet}>
						{/* Ready sits above warm-ups so a fresh read isn't pushed down by "Nothing due". */}
						{video ? <ReadyToTeach video={video} /> : null}
						{/* Before the first class, Class memory and warm-ups would only say "nothing yet". */}
						{firstRun ? null : (
							<>
								<DailyQuizCard />
								<ClassMemoryLink />
								<DueWarmUps />
							</>
						)}
						<RecentTopics />
						{firstRun ? <HowAClassWorks /> : null}
					</SheetCard>
				</ScrollView>
			</KeyboardAvoidingView>
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
