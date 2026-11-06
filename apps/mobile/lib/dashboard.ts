import type { Progress, ProgressVideo, ProgressWarmUp } from '@app/contract'

export const CALENDAR_WEEKS = 6
const DAYS_IN_WEEK = 7
/** The newest classes a chart can fit bars for. */
const MAX_CLASSES_CHARTED = 12

/** A whole percent, where 100 only ever means all of it. */
function percent(part: number, whole: number) {
	if (!whole) return 0
	return part === whole ? 100 : Math.min(99, Math.round((part / whole) * 100))
}

function startOfDay(date: Date) {
	const day = new Date(date)
	day.setHours(0, 0, 0, 0)
	return day
}

/** Calendar days, not 24 hours: a day with a clock change still lands on midnight. */
function addDays(date: Date, days: number) {
	const next = new Date(date)
	next.setDate(next.getDate() + days)
	return next
}

/** How many things were done each day: classes taught and warm-ups answered, by local midnight. */
function activityByDay({ videos, warm_ups: warmUps }: Progress) {
	const counts = new Map<number, number>()
	for (const at of [
		...videos.map((video) => video.taught_at),
		...warmUps.map((warmUp) => warmUp.asked_at)
	]) {
		const day = startOfDay(new Date(at)).getTime()
		counts.set(day, (counts.get(day) ?? 0) + 1)
	}
	return counts
}

/** The longest run of days in a row, ever. */
function bestRun(counts: ReadonlyMap<number, number>) {
	let best = 0
	let run = 0
	let previous: Date | null = null
	for (const time of [...counts.keys()].sort((a, b) => a - b)) {
		const day = new Date(time)
		run = previous && addDays(previous, 1).getTime() === time ? run + 1 : 1
		best = Math.max(best, run)
		previous = day
	}
	return best
}

/** Days in a row up to today. Today not done yet doesn't end it: yesterday's run still counts. */
function currentRun(counts: ReadonlyMap<number, number>, today: Date) {
	let day = counts.has(today.getTime()) ? today : addDays(today, -1)
	let run = 0
	while (counts.has(day.getTime())) {
		run++
		day = addDays(day, -1)
	}
	return run
}

/** Weeks of days, Monday first, ending this week. A day's count, or null for days to come. */
function calendarOf(counts: ReadonlyMap<number, number>, today: Date) {
	const weekday = (today.getDay() + 6) % DAYS_IN_WEEK
	const first = addDays(today, -weekday - (CALENDAR_WEEKS - 1) * DAYS_IN_WEEK)
	return Array.from({ length: CALENDAR_WEEKS }, (_, week) =>
		Array.from({ length: DAYS_IN_WEEK }, (_, offset) => {
			const day = addDays(first, week * DAYS_IN_WEEK + offset)
			return day > today ? null : (counts.get(day.getTime()) ?? 0)
		})
	)
}

function askedBy(warmUps: readonly ProgressWarmUp[], student: string) {
	return warmUps.filter((warmUp) => warmUp.student_name === student)
}

const sum = (videos: readonly ProgressVideo[], pick: (video: ProgressVideo) => number) =>
	videos.reduce((total, video) => total + pick(video), 0)

export type DashboardNumbers = ReturnType<typeof dashboardNumbers>

/** What the dashboard says. `progress.videos` comes from the server best first. */
export function dashboardNumbers(progress: Progress, now: Date) {
	const { videos, warm_ups: warmUps } = progress
	const today = startOfDay(now)
	const counts = activityByDay(progress)
	const weekAgo = addDays(today, -(DAYS_IN_WEEK - 1)).getTime()
	const oldestFirst = [...videos].sort((a, b) => a.taught_at.localeCompare(b.taught_at))
	const ideas = sum(videos, (video) => video.idea_count)
	const taught = sum(videos, (video) => video.taught)

	let taughtSoFar = 0
	const growth = oldestFirst.map((video) => {
		taughtSoFar += video.taught
		return ideas ? taughtSoFar / ideas : 0
	})

	return {
		videos,
		videoCount: videos.length,
		ideas,
		taught,
		learned: sum(videos, (video) => video.learned),
		/** Percent of ideas taught. */
		mastery: percent(taught, ideas),
		warmUpsAnswered: warmUps.length,
		warmUpsRight: warmUps.filter((warmUp) => warmUp.is_right).length,
		warmUpsThisWeek: warmUps.filter((w) => new Date(w.asked_at).getTime() >= weekAgo).length,
		streak: currentRun(counts, today),
		bestRun: bestRun(counts),
		activeDays: counts.size,
		calendar: calendarOf(counts, today),
		maya: askedBy(warmUps, 'Maya'),
		omar: askedBy(warmUps, 'Omar'),
		/** Ideas taught by the end of each class, oldest first, as a share of all of them. */
		growth,
		firstClassAt: oldestFirst[0]?.taught_at ?? null,
		/** The newest classes, oldest first, for the bars. */
		classes: oldestFirst.slice(-MAX_CLASSES_CHARTED)
	}
}

export const videosWord = (count: number) => (count === 1 ? '1 video' : `${count} videos`)
export const daysWord = (count: number) => (count === 1 ? 'day in a row' : 'days in a row')
