import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronLeft } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isPastedTopic, type TopicGap, type TopicGapWarmUp } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { QueryErrorState } from '@/components/QueryError'
import { Button } from '@/components/ui/Button'
import { Highlight } from '@/components/ui/Highlight'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'
import { dueDay } from '@/lib/dueDay'
import { formatTimestamp } from '@/lib/formatTimestamp'
import { youtubeThumbnailUrl } from '@/lib/youtubeThumb'

/** How much of the screen Omar's violet gets above the sheet. */
const ROOM_SHARE = 0.28

function leave() {
	if (router.canGoBack()) router.back()
	else router.replace('/(tabs)')
}

/**
 * One past warm-up on a gap: who asked and when, how it went, the student's question and what
 * the person said back.
 */
function WarmUpCard({ warmUp }: { warmUp: TopicGapWarmUp }) {
	const { colors: c, radii } = useTheme()
	const when = new Date(warmUp.asked_at).toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short'
	})
	const result = warmUp.is_right ? 'Right' : 'Not quite'
	return (
		<View
			style={[s.warmUp, { backgroundColor: c.well, borderRadius: radii.xl }]}
			accessible
			accessibilityLabel={`${warmUp.student_name}, ${when}, ${result}. Asked: ${warmUp.question}${warmUp.answer ? `. You said: ${warmUp.answer}` : ''}`}
		>
			<MonoLabel
				right={
					<View
						style={[
							s.result,
							{
								backgroundColor: warmUp.is_right ? c.brandFill : c.surface3,
								borderRadius: radii.sm
							}
						]}
					>
						<Text
							variant="eyebrow"
							style={{ color: warmUp.is_right ? c.onBrand : c.textSecondary }}
						>
							{result}
						</Text>
					</View>
				}
			>
				{`${warmUp.student_name} · ${when}`}
			</MonoLabel>
			<Text variant="caption" tone="secondary">{`“${warmUp.question}”`}</Text>
			{warmUp.answer ? (
				<View style={s.said}>
					<Text variant="eyebrow" tone="secondary">
						You said
					</Text>
					<Text variant="bodySm">{warmUp.answer}</Text>
				</View>
			) : null}
		</View>
	)
}

/**
 * An open gap's mark: one square per right answer it needs, filled as they come, so it reads as
 * progress and not as an unticked box. The line under the title says the same in words.
 */
function ProgressSquares({ gap }: { gap: TopicGap }) {
	const { colors: c } = useTheme()
	return (
		<View testID="progress-squares" style={s.squares}>
			{Array.from({ length: gap.rights_to_close }, (_, i) => (
				<View
					key={i}
					style={[
						s.square,
						{ backgroundColor: i < gap.right_streak ? c.textPrimary : c.borderActive }
					]}
				/>
			))}
		</View>
	)
}

function GapRow({ gap, onOpenWarmUps }: { gap: TopicGap; onOpenWarmUps: (count: number) => void }) {
	const { colors: c } = useTheme()
	const [all, setAll] = useState(false)
	const when = gap.next_due_at ? dueDay(gap.next_due_at) : null
	const note = gap.closed
		? 'Closed: right twice in warm-ups'
		: gap.taught_last_class
			? `Taught last class · checks it stuck ${when}`
			: `Missed · warm-up ${when}`
	// Newest first. An open gap shows its latest warm-up; a closed one folds them all away.
	const newest = [...gap.warm_ups].reverse()
	const shown = all ? newest : gap.closed ? [] : newest.slice(0, 1)
	const hidden = newest.length - shown.length
	return (
		<View style={[s.gap, { borderTopColor: c.borderHairline }]}>
			<View
				style={[
					s.mark,
					gap.closed && { backgroundColor: c.textPrimary },
					!gap.closed &&
						gap.taught_last_class && { backgroundColor: c.brandFill, borderColor: c.borderActive }
				]}
			>
				{gap.closed || gap.taught_last_class ? (
					<Check size={13} strokeWidth={3} color={gap.closed ? c.surface : c.onBrand} />
				) : (
					<ProgressSquares gap={gap} />
				)}
			</View>
			<View style={s.gapCopy}>
				<Text variant="label" style={s.gapTitle}>
					{gap.concept_title}
				</Text>
				<Text variant="caption" tone="secondary" style={s.quote}>
					{`“${gap.quote}”`}
				</Text>
				<Text variant="caption" tone="secondary">
					{note}
				</Text>
				{gap.closed ? null : (
					<Text variant="caption" tone="secondary">
						{`${gap.right_streak} of ${gap.rights_to_close} right`}
					</Text>
				)}
				{shown.map((warmUp) => (
					<WarmUpCard key={warmUp.asked_at} warmUp={warmUp} />
				))}
				{hidden > 0 ? (
					<PressableScale
						onPress={() => {
							setAll(true)
							onOpenWarmUps(gap.warm_ups.length)
						}}
						accessibilityRole="button"
						accessibilityLabel={`Show ${hidden} more ${hidden === 1 ? 'warm-up' : 'warm-ups'}`}
						hitSlop={8}
						style={s.more}
					>
						<Text variant="label" style={s.moreText}>
							{gap.closed && shown.length === 0
								? `${hidden} ${hidden === 1 ? 'warm-up' : 'warm-ups'} ›`
								: `${hidden} earlier ›`}
						</Text>
					</PressableScale>
				) : null}
			</View>
			{gap.start_seconds != null ? (
				<Text variant="eyebrow" tone="secondary">
					{formatTimestamp(gap.start_seconds)}
				</Text>
			) : null}
		</View>
	)
}

function Stat({ value, label }: { value: string; label: string }) {
	const { colors: c, radii } = useTheme()
	return (
		<View style={[s.stat, { backgroundColor: c.well, borderRadius: radii.xl }]}>
			<Text variant="h2" tabular>
				{value}
			</Text>
			<Text variant="caption" tone="secondary">
				{label}
			</Text>
		</View>
	)
}

/**
 * One video's page, on Omar's violet: how the latest class went, every idea missed in it and
 * when each comes back as a warm-up, and "Teach it again".
 */
export default function TopicScreen() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { colors: c, radii, elevation } = useTheme()
	const insets = useSafeAreaInsets()
	const { height } = useWindowDimensions()
	const page = useQuery({
		queryKey: ['topic-gaps', id],
		queryFn: () => api('getTopicGaps', { params: { id } })
	})
	const open = page.data?.gaps.filter((gap) => !gap.closed) ?? []
	const loaded = page.isSuccess

	useEffect(() => {
		if (loaded) track('topic_viewed', { topic_id: id, open_gaps: open.length })
		// Once per load; the count is the one shown.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loaded, id])

	const data = page.data
	const thumb =
		data && !isPastedTopic(data.topic.youtube_id)
			? youtubeThumbnailUrl(data.topic.youtube_id)
			: null
	const next = open.find((gap) => gap.next_due_at)?.next_due_at ?? null

	return (
		<View style={s.fill}>
			<PixelBackdrop scene="topic" />
			<View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
				<PressableScale
					onPress={leave}
					accessibilityRole="button"
					accessibilityLabel="Back"
					style={[s.back, { backgroundColor: c.surface }, elevation.soft]}
				>
					<ChevronLeft size={22} color={c.textPrimary} strokeWidth={2.2} />
				</PressableScale>
				{data ? (
					<View
						style={[
							s.video,
							{ backgroundColor: c.surface, borderRadius: radii['2xl'] },
							elevation.soft
						]}
					>
						{thumb ? (
							<Image
								source={{ uri: thumb }}
								style={[s.thumb, { borderRadius: radii.lg }]}
								contentFit="cover"
								accessibilityIgnoresInvertColors
							/>
						) : null}
						<Text variant="label" numberOfLines={2} style={s.videoTitle}>
							{data.topic.title}
						</Text>
					</View>
				) : null}
			</View>
			<ScrollView
				style={s.fill}
				contentContainerStyle={{ paddingTop: height * ROOM_SHARE, paddingBottom: insets.bottom }}
				showsVerticalScrollIndicator={false}
			>
				<SheetCard>
					{page.isPending ? (
						<CardSkeleton height={220} />
					) : page.isError ? (
						<QueryErrorState
							error={page.error}
							title="Couldn't load this video"
							onRetry={() => {
								void page.refetch()
							}}
						/>
					) : (
						<>
							<MonoLabel
								right={
									data?.taught_at
										? `Taught ${new Date(data.taught_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
										: undefined
								}
							>
								This video
							</MonoLabel>
							<Text variant="question" style={s.title} accessibilityRole="header">
								{!data?.taught_at ? (
									'Not taught yet.'
								) : open.length === 0 ? (
									data.gaps.length > 0 ? (
										'Every gap closed.'
									) : (
										'Nothing missed.'
									)
								) : (
									<>
										{`${open.length} ${open.length === 1 ? 'gap' : 'gaps'} left. Back `}
										<Highlight>{next ? dueDay(next) : 'soon'}</Highlight>.
									</>
								)}
							</Text>
							{data?.explanation_score ? (
								<View style={s.stats}>
									<Stat
										value={`${data.explanation_score.correct}/${data.explanation_score.total}`}
										label="Your explanation"
									/>
									{data.after_class_score ? (
										<Stat
											value={`${data.after_class_score.correct}/${data.after_class_score.total}`}
											label="After class"
										/>
									) : null}
									<Stat value={String(open.length)} label="Gaps open" />
								</View>
							) : null}
							{data && data.gaps.length > 0 ? (
								<View style={s.list}>
									{data.gaps.map((gap) => (
										<GapRow
											key={gap.id}
											gap={gap}
											onOpenWarmUps={(count) =>
												track('topic_warm_ups_opened', { topic_id: id, warm_up_count: count })
											}
										/>
									))}
								</View>
							) : null}
							<Button
								label="Teach it again"
								variant="ink"
								size="lg"
								fullWidth
								onPress={() => {
									track('topic_teach_again_tapped', { topic_id: id })
									router.push(`/class/${id}`)
								}}
								style={s.cta}
							/>
						</>
					)}
				</SheetCard>
			</ScrollView>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	top: { position: 'absolute', left: 16, right: 16, zIndex: 2, gap: 12, alignItems: 'flex-start' },
	back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
	video: {
		alignSelf: 'stretch',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		padding: 8,
		paddingRight: 14
	},
	thumb: { width: 88, height: 50, backgroundColor: 'transparent' },
	videoTitle: { flex: 1, fontSize: 15, lineHeight: 20 },
	title: { marginTop: 12 },
	stats: { flexDirection: 'row', gap: 8, marginTop: 16 },
	stat: { flex: 1, padding: 12, gap: 2 },
	list: { marginTop: 16 },
	gap: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
		paddingVertical: 12,
		borderTopWidth: StyleSheet.hairlineWidth
	},
	mark: {
		width: 22,
		height: 22,
		marginTop: 1,
		borderWidth: 1.5,
		borderColor: 'transparent',
		alignItems: 'center',
		justifyContent: 'center'
	},
	gapCopy: { flex: 1, gap: 2 },
	gapTitle: { fontSize: 15, lineHeight: 20 },
	quote: { fontStyle: 'italic' },
	squares: { flexDirection: 'row', gap: 2 },
	square: { width: 9, height: 9 },
	warmUp: { marginTop: 8, padding: 12, gap: 4 },
	result: { paddingHorizontal: 6, paddingVertical: 1 },
	said: { marginTop: 4, gap: 1 },
	more: { marginTop: 8, alignSelf: 'flex-start' },
	moreText: { fontSize: 14 },
	cta: { marginTop: 20 }
})
