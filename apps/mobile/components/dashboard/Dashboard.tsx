import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { PIXEL_FIELDS } from '@app/pixel'
import type { ProgressVideo, ProgressWarmUp } from '@app/contract'
import { StudentFace, type Student } from '@/components/memory/StudentFace'
import { PressableScale } from '@/components/motion/PressableScale'
import { Button } from '@/components/ui/Button'
import { Highlight } from '@/components/ui/Highlight'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { CALENDAR_WEEKS, daysWord, videosWord, type DashboardNumbers } from '@/lib/dashboard'
import { DensityTile, PixelColumns, PixelText, PixelRow, type Palette } from './PixelCharts'

const PALETTE = {
	board: PIXEL_FIELDS.tunnel.palette,
	videos: PIXEL_FIELDS.goldDrift.palette,
	warmUps: PIXEL_FIELDS.omar.palette,
	learned: PIXEL_FIELDS.voiceWaves.palette,
	quiz: PIXEL_FIELDS.maya.palette
} as const

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
/** The lamps along the scoreboard. */
const BOARD_LAMPS = 20
/** A person's squares stop here, so someone with hundreds of warm-ups keeps a tidy row. */
const MAX_WARM_UP_SQUARES = 32
const FACE = 56
/** Digits this long get a smaller cell, to stay inside a tile. */
const LONG_NUMBER = 4

/** The quiz's best, kept on this phone; null until a quiz has been played on it. */
export type QuizBest = { best: number; total: number } | null

function Panel({ title, right, children }: { title: string; right?: string; children: ReactNode }) {
	const { colors: c, radii } = useTheme()
	return (
		<View style={[s.panel, { backgroundColor: c.well, borderRadius: radii['2xl'] }]}>
			<MonoLabel right={right}>{title}</MonoLabel>
			{children}
		</View>
	)
}

function Scoreboard({ numbers }: { numbers: DashboardNumbers }) {
	const { colors: c, radii } = useTheme()
	const { mastery, taught, ideas, videoCount } = numbers
	const glow = PALETTE.board[3]!
	const label = { color: glow }
	return (
		<View
			accessible
			accessibilityLabel={`Mastery: ${mastery} percent, ${taught} of ${ideas} ideas`}
			style={[s.board, { backgroundColor: c.textPrimary, borderRadius: radii['2xl'] }]}
		>
			<View style={s.spread}>
				<Text variant="eyebrow" style={label}>
					Mastery
				</Text>
				<Text variant="eyebrow" style={label}>
					{`${taught} of ${ideas} ideas`}
				</Text>
			</View>
			<View style={s.boardDigits}>
				{/* 100% is a character wider, and has to fit the narrowest phone too. */}
				<PixelText
					text={`${mastery}%`}
					cell={mastery === 100 ? 10 : 12}
					color={PALETTE.board[4]!}
					off={PALETTE.board[1]!}
				/>
			</View>
			<PixelColumns
				values={Array.from({ length: BOARD_LAMPS }, (_, i) =>
					i < (mastery / 100) * BOARD_LAMPS ? 1 : 0
				)}
				rows={2}
				cell={6}
				gap={0}
				palette={PALETTE.board}
				ramp={[0.6, 1]}
				track={PALETTE.board[2]!}
			/>
			<Text variant="caption" style={[s.boardLine, label]}>
				{`Ideas you could explain to Maya and Omar, across ${videosWord(videoCount)}.`}
			</Text>
		</View>
	)
}

function StreakRow({ numbers }: { numbers: DashboardNumbers }) {
	const { colors: c, radii } = useTheme()
	const { streak, bestRun, activeDays, warmUpsThisWeek } = numbers
	const live = streak > 0
	const days = live ? streak : bestRun
	const stats = [
		[activeDays, 'active days'],
		[warmUpsThisWeek, 'warm-ups this week']
	] as const
	return (
		<View style={s.streakRow}>
			<View
				accessible
				accessibilityLabel={`${live ? 'Streak' : 'Best run'}: ${days} ${daysWord(days)}`}
				style={[
					s.streakCard,
					{ backgroundColor: c.brandFill, borderRadius: radii['2xl'], borderColor: c.textPrimary }
				]}
			>
				<Text variant="eyebrow">{live ? 'Streak' : 'Best run'}</Text>
				<PixelText text={String(days)} cell={days > 99 ? 7 : 11} color={c.textPrimary} />
				<Text variant="label">
					{live ? daysWord(days) : `${daysWord(days)}. Teach today to start a new one.`}
				</Text>
			</View>
			<View style={s.streakStats}>
				{stats.map(([value, label]) => (
					<View
						key={label}
						accessible
						accessibilityLabel={`${value} ${label}`}
						style={[s.streakStat, { backgroundColor: c.well, borderRadius: radii.xl }]}
					>
						<PixelText text={String(value)} cell={5} color={c.textPrimary} />
						<Text variant="caption" tone="secondary">
							{label}
						</Text>
					</View>
				))}
			</View>
		</View>
	)
}

function Tile({ label, value, palette }: { label: string; value: string; palette: Palette }) {
	const { colors: c, radii } = useTheme()
	return (
		<View
			accessible
			accessibilityLabel={`${label}: ${value}`}
			style={[s.tile, { backgroundColor: c.well, borderRadius: radii.xl }]}
		>
			<Text variant="eyebrow" tone="secondary">
				{label}
			</Text>
			<View style={s.tileDigits}>
				<PixelText
					text={value}
					cell={value.length > LONG_NUMBER ? 3 : value.length === LONG_NUMBER ? 4 : 5}
					color={c.textPrimary}
				/>
			</View>
			<PixelRow value={1} cell={4} rows={2} palette={palette} track={c.surface3} />
		</View>
	)
}

function Calendar({ weeks }: { weeks: DashboardNumbers['calendar'] }) {
	const { colors: c } = useTheme()
	const tile = (count: number, cell: number, key?: number) => (
		<DensityTile
			key={key}
			count={count}
			cell={cell}
			ink={c.textPrimary}
			lit={c.brandFill}
			empty={c.surface3}
		/>
	)
	return (
		<Panel title="Days you showed up" right={`${CALENDAR_WEEKS} weeks`}>
			<View style={s.calendar}>
				<View style={s.calendarColumn}>
					{WEEKDAYS.map((day, i) => (
						<Text key={i} variant="eyebrow" tone="secondary" style={s.calendarDay}>
							{day}
						</Text>
					))}
				</View>
				{weeks.map((week, w) => (
					<View key={w} style={s.calendarColumn}>
						{week.map((count, d) =>
							count === null ? <View key={d} style={s.calendarFuture} /> : tile(count, 6.5, d)
						)}
					</View>
				))}
			</View>
			<View style={s.key}>
				{[0, 1, 2, 3].map((count) => (
					<View key={count} style={s.keyItem}>
						{tile(count, 3.5)}
						<Text variant="eyebrow" tone="secondary">
							{count === 3 ? '3+' : String(count)}
						</Text>
					</View>
				))}
			</View>
		</Panel>
	)
}

const dayOfMonth = (iso: string) => String(new Date(iso).getDate())

function WhoQuizzed({
	student,
	warmUps,
	palette
}: {
	student: Student
	warmUps: readonly ProgressWarmUp[]
	palette: Palette
}) {
	const { colors: c, radii } = useTheme()
	const right = warmUps.filter((warmUp) => warmUp.is_right).length
	const squares = warmUps.slice(-MAX_WARM_UP_SQUARES)
	return (
		<View style={s.quizzed}>
			<StudentFace student={student} size={FACE} radius={radii.lg} />
			<View style={s.quizzedCopy}>
				<Text variant="label">
					{warmUps.length
						? `${student} · ${right} of ${warmUps.length} right`
						: `${student} · not yet`}
				</Text>
				<View style={s.squares}>
					{(squares.length ? squares.map((w) => (w.is_right ? 3 : 1)) : [0, 0, 0]).map(
						(count, i) => (
							<DensityTile
								key={i}
								count={count}
								cell={4}
								ink={palette[1]!}
								lit={palette[3]!}
								empty={c.surface3}
							/>
						)
					)}
				</View>
			</View>
		</View>
	)
}

function VideoRow({ video, onPress }: { video: ProgressVideo; onPress: () => void }) {
	const { colors: c } = useTheme()
	const count = `${video.taught}/${video.idea_count}`
	return (
		<PressableScale
			scaleTo="card"
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${video.title}: ${count} ideas. Open this video.`}
			style={s.videoRow}
		>
			<View style={s.spread}>
				<Text variant="caption" numberOfLines={1} style={s.videoTitle}>
					{video.title}
				</Text>
				<Text variant="eyebrow">{count}</Text>
			</View>
			<PixelRow
				value={video.taught / video.idea_count}
				cell={4}
				rows={3}
				palette={PALETTE.quiz}
				track={c.surface3}
			/>
		</PressableScale>
	)
}

/** The sheet's content once something has been taught: the score, the habit, then the detail. */
export function Dashboard({
	numbers,
	quiz,
	onOpenVideo,
	onOpenMemory
}: {
	numbers: DashboardNumbers
	quiz: QuizBest
	onOpenVideo: (video: ProgressVideo) => void
	onOpenMemory: () => void
}) {
	const { colors: c } = useTheme()
	const { classes, growth, firstClassAt, taught } = numbers
	return (
		<>
			<MonoLabel right="All time">Dashboard</MonoLabel>
			<Text variant="h1" style={s.title}>
				Your <Highlight>scores</Highlight>
			</Text>
			<Scoreboard numbers={numbers} />
			<StreakRow numbers={numbers} />
			<View style={s.tiles}>
				<Tile label="Videos taught" value={String(numbers.videoCount)} palette={PALETTE.videos} />
				<Tile
					label="Warm-ups right"
					value={`${numbers.warmUpsRight}/${numbers.warmUpsAnswered}`}
					palette={PALETTE.warmUps}
				/>
				<Tile label="Learned for good" value={String(numbers.learned)} palette={PALETTE.learned} />
				<Tile
					label="Quiz best"
					value={quiz ? `${quiz.best}/${quiz.total}` : '-'}
					palette={PALETTE.quiz}
				/>
			</View>
			<Calendar weeks={numbers.calendar} />
			<Panel title="Ideas you can explain" right="over time">
				<PixelColumns
					values={growth}
					rows={22}
					cell={5}
					gap={0}
					palette={PALETTE.learned}
					ramp={[0.02, 0.55]}
					track={c.surface3}
					highlight={growth.length - 1}
				/>
				<View style={s.spread}>
					<Text variant="eyebrow" tone="secondary">
						{firstClassAt ? dayOfMonth(firstClassAt) : ''}
					</Text>
					<Text variant="eyebrow">{`${taught} now`}</Text>
				</View>
			</Panel>
			<Panel title="First explanation, each class" right="% right">
				<PixelColumns
					values={classes.map((video) => video.first_try / video.idea_count)}
					rows={18}
					cell={5}
					gap={2}
					palette={PALETTE.videos}
					track={c.surface3}
				/>
				<View style={s.axis}>
					{classes.map((video) => (
						<Text key={video.id} variant="eyebrow" tone="secondary" style={s.axisDay}>
							{dayOfMonth(video.taught_at)}
						</Text>
					))}
				</View>
			</Panel>
			<PressableScale
				scaleTo="card"
				onPress={onOpenMemory}
				accessibilityRole="button"
				accessibilityLabel="Who quizzed you. Open Class memory."
			>
				<Panel title="Who quizzed you" right="warm-ups">
					<WhoQuizzed student="Maya" warmUps={numbers.maya} palette={PALETTE.quiz} />
					<WhoQuizzed student="Omar" warmUps={numbers.omar} palette={PALETTE.warmUps} />
				</Panel>
			</PressableScale>
			<Panel title="Every video" right="can explain">
				{numbers.videos.map((video) => (
					<VideoRow key={video.id} video={video} onPress={() => onOpenVideo(video)} />
				))}
			</Panel>
		</>
	)
}

/** Before a class has finished there is nothing to score: this says so, and offers the first. */
export function DashboardEmpty({ onTeach }: { onTeach: () => void }) {
	return (
		<>
			<MonoLabel>Dashboard</MonoLabel>
			<Text variant="h1" style={s.title}>
				Your <Highlight>scores</Highlight>
			</Text>
			<View style={s.empty}>
				<Text variant="body" tone="secondary">
					Your mastery, streak and every video show up once you&apos;ve taught your first class.
				</Text>
				<Button
					label="Teach your first video"
					variant="ink"
					size="lg"
					fullWidth
					onPress={onTeach}
				/>
			</View>
		</>
	)
}

const s = StyleSheet.create({
	title: { marginTop: 8 },
	spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
	panel: { marginTop: 14, padding: 14, gap: 10 },
	board: { marginTop: 14, padding: 16 },
	boardDigits: { alignItems: 'center', paddingVertical: 18 },
	boardLine: { marginTop: 10 },
	streakRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
	streakCard: { flex: 1, padding: 16, gap: 10, borderWidth: 2, justifyContent: 'space-between' },
	streakStats: { flex: 1, gap: 10 },
	streakStat: { flex: 1, padding: 12, gap: 6, justifyContent: 'center' },
	tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
	tile: { width: '47.5%', flexGrow: 1, padding: 12, gap: 2 },
	tileDigits: { height: 35, marginTop: 10, justifyContent: 'center' },
	calendar: { flexDirection: 'row', justifyContent: 'space-between' },
	calendarColumn: { justifyContent: 'space-between', gap: 2 },
	calendarDay: { height: 26, lineHeight: 26 },
	calendarFuture: { width: 26, height: 26 },
	key: { flexDirection: 'row', gap: 14 },
	keyItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
	axis: { flexDirection: 'row', gap: 8 },
	axisDay: { flex: 1, textAlign: 'center' },
	quizzed: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	quizzedCopy: { flex: 1, gap: 6 },
	squares: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
	videoRow: { gap: 6 },
	videoTitle: { flex: 1 },
	empty: { marginTop: 16, gap: 16 }
})
