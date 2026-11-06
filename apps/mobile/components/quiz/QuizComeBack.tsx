import { useEffect, useState, type RefObject } from 'react'
import { StyleSheet, View } from 'react-native'
import { Flame } from 'lucide-react-native'
import { withAlpha } from '@app/brand'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import {
	comeBackLine,
	streakDays,
	streakWords,
	untilNextQuiz,
	weekDays,
	type QuizRecord,
	type WeekDay
} from '@/lib/quiz'
import { QuizPanel } from './QuizPanel'

/** How often the countdown looks at the clock: it shows minutes, so this is close enough. */
const TICK_MS = 30_000
const MISSED_FILL = 0.18

function DaySquare({ day }: { day: WeekDay }) {
	const { colors: c, radii } = useTheme()
	const look = {
		played: { backgroundColor: c.surface, borderColor: 'transparent', borderWidth: 1 },
		today: { backgroundColor: c.brandFill, borderColor: 'transparent', borderWidth: 1 },
		missed: {
			backgroundColor: withAlpha(c.heroTextSecondary, MISSED_FILL),
			borderColor: 'transparent',
			borderWidth: 1
		},
		next: { backgroundColor: 'transparent', borderColor: c.brandFill, borderWidth: 2 },
		later: { backgroundColor: 'transparent', borderColor: c.heroTextSecondary, borderWidth: 1 }
	}[day.state]
	return (
		<View style={s.dayColumn}>
			<View style={[s.day, { borderRadius: radii.md }, look]}>
				{day.score != null ? (
					<Text variant="label" tabular style={{ color: c.onBrand }}>
						{String(day.score)}
					</Text>
				) : null}
			</View>
			<Text variant="eyebrow" style={{ color: c.heroTextSecondary }}>
				{day.letter}
			</Text>
		</View>
	)
}

/**
 * The quiz after today's is played: the streak they're building, this week's scores with
 * tomorrow waiting, and how long until the next one.
 */
export function QuizComeBack({
	record,
	onDone,
	blurTarget
}: {
	record: QuizRecord
	onDone: () => void
	blurTarget?: RefObject<View | null>
}) {
	const { colors: c, radii } = useTheme()
	const [now, setNow] = useState(() => new Date())
	const [firstSeen] = useState(now)
	const streak = streakDays(record, firstSeen)
	const week = weekDays(record, firstSeen)
	const playedThisWeek = week.filter((day) => day.score != null).length

	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), TICK_MS)
		return () => clearInterval(id)
	}, [])

	useEffect(() => {
		track('quiz_done_viewed', { streak_days: streak, played_this_week: playedThisWeek })
		// Once per visit: the counts are from when it opened.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<View style={s.wrap} accessibilityLiveRegion="polite">
			<QuizPanel blurTarget={blurTarget}>
				<View style={[s.streak, { backgroundColor: c.brandFill, borderRadius: radii.pill }]}>
					<Flame size={18} color={c.onBrand} strokeWidth={2.4} />
					<Text variant="label" style={{ color: c.onBrand }}>
						{streakWords(streak)}
					</Text>
				</View>
				<Text
					variant="display"
					accessibilityRole="header"
					style={[s.center, { color: c.heroText }]}
				>
					See you tomorrow.
				</Text>
				<Text variant="body" style={[s.center, { color: c.heroTextSecondary }]}>
					{comeBackLine(record)}
				</Text>
				<View
					style={s.week}
					accessible
					accessibilityLabel={`This week: played ${playedThisWeek} of 7 days`}
				>
					{week.map((day) => (
						<DaySquare key={day.date} day={day} />
					))}
				</View>
				<Text variant="bodySm" style={{ color: c.heroTextSecondary }}>
					{`Next quiz in ${untilNextQuiz(now)}`}
				</Text>
				<Button label="Back to Home" variant="primary" size="lg" fullWidth onPress={onDone} />
			</QuizPanel>
		</View>
	)
}

const s = StyleSheet.create({
	wrap: { flex: 1, justifyContent: 'center' },
	center: { textAlign: 'center' },
	streak: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingVertical: 8,
		paddingHorizontal: 14
	},
	week: { alignSelf: 'stretch', flexDirection: 'row', gap: 6, marginVertical: 8 },
	dayColumn: { flex: 1, alignItems: 'center', gap: 6 },
	day: { alignSelf: 'stretch', height: 48, alignItems: 'center', justifyContent: 'center' }
})
