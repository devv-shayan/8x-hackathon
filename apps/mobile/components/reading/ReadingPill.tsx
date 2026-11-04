import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useMutationState } from '@tanstack/react-query'
import { parseYouTubeVideoId, type Video } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBoard } from '@/components/pixel/PixelBoard'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { clock, readingAt } from '@/lib/readingProgress'
import { READ_VIDEO_KEY } from '@/lib/topicQuery'
import { youtubeBoardUrl } from '@/lib/youtubeThumb'

const TICK_MS = 1000
const MINI_W = 66
const MINI_H = 40

/** The read Home started, if any: its link, when it started, and the video once it's read. */
export function useReadingJob() {
	return (
		useMutationState({
			filters: { mutationKey: READ_VIDEO_KEY },
			select: (mutation) => ({
				status: mutation.state.status,
				submittedAt: mutation.state.submittedAt,
				link: typeof mutation.state.variables === 'string' ? mutation.state.variables : null,
				video: (mutation.state.data as Video | undefined) ?? null
			})
		}).at(-1) ?? null
	)
}

/**
 * The read that's still going while a warm-up is answered (8X-49): the class's board shrunk to
 * a pill, with Omar's line and how far it's got. It turns lime when the video is ready, without
 * interrupting the answer; tapping it then opens the class, and before that goes back to watch.
 */
export function ReadingPill({
	job,
	onOpen
}: {
	job: NonNullable<ReturnType<typeof useReadingJob>>
	onOpen: (video: Video | null) => void
}) {
	const { colors: c, radii, elevation } = useTheme()
	const [now, setNow] = useState(() => Date.now())
	const ready = job.status === 'success' && job.video
	const youtubeId = job.link ? parseYouTubeVideoId(job.link) : null

	useEffect(() => {
		if (ready) return
		const id = setInterval(() => setNow(Date.now()), TICK_MS)
		return () => clearInterval(id)
	}, [ready])

	const seconds = (now - job.submittedAt) / 1000
	const at = readingAt(seconds)
	const ideas = job.video?.concepts.length ?? 0
	const line = ready ? `Omar: “Done. ${ideas} big ideas.”` : 'Omar: “Still reading…”'
	const sub = ready
		? 'Ready · tap when you’re done'
		: `${Math.round(at.progress * 100)}% · ${clock(seconds)}`

	return (
		<PressableScale
			onPress={() => onOpen(ready ? job.video : null)}
			accessibilityRole="button"
			accessibilityLabel={
				ready ? 'Your video is ready. Teach it' : 'Your video is reading. Watch it'
			}
			style={[
				s.pill,
				{ backgroundColor: ready ? c.brandFill : c.surface, borderRadius: radii['2xl'] },
				elevation.soft
			]}
		>
			<View style={[s.mini, { backgroundColor: c.hero, borderRadius: radii.sm }]}>
				{youtubeId ? (
					<PixelBoard
						src={youtubeBoardUrl(youtubeId)}
						progress={at.progress}
						ready={Boolean(ready)}
					/>
				) : null}
			</View>
			<View style={s.copy}>
				<Text
					variant="label"
					numberOfLines={1}
					style={[s.line, ready ? { color: c.onBrand } : null]}
				>
					{line}
				</Text>
				<Text
					variant="eyebrow"
					numberOfLines={1}
					tone={ready ? undefined : 'secondary'}
					style={ready ? { color: c.onBrand } : undefined}
				>
					{sub}
				</Text>
			</View>
			{ready ? (
				<Text variant="h3" style={{ color: c.onBrand }}>
					›
				</Text>
			) : null}
		</PressableScale>
	)
}

const s = StyleSheet.create({
	pill: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingRight: 14 },
	mini: { width: MINI_W, height: MINI_H, padding: 3, overflow: 'hidden' },
	copy: { flex: 1, gap: 2 },
	line: { fontSize: 14 }
})
