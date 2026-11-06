/**
 * What the dashboard says: its totals, the streak and calendar on local days, and the chart.
 */
import type { Progress, ProgressVideo, ProgressWarmUp } from '@app/contract'
import { dashboardNumbers } from '@/lib/dashboard'

/** A Friday. */
const NOW = new Date(2026, 10, 6, 16, 0)
const at = (daysAgo: number) => new Date(2026, 10, 6 - daysAgo, 12).toISOString()

const video = (id: string, taught: number, idea_count: number, daysAgo = 3): ProgressVideo => ({
	id,
	title: id,
	youtube_id: 'UNP03fDSj1U',
	idea_count,
	first_try: Math.min(1, taught),
	taught,
	learned: 0,
	open_gaps: idea_count - taught,
	taught_at: at(daysAgo)
})

const warmUp = (daysAgo: number, student_name = 'Maya', is_right = true): ProgressWarmUp => ({
	asked_at: at(daysAgo),
	student_name,
	is_right
})

const numbers = (videos: ProgressVideo[], warm_ups: Progress['warm_ups'] = []) =>
	dashboardNumbers({ videos, warm_ups }, NOW)

it('adds up every video and warm-up', () => {
	const result = numbers(
		[video('a', 8, 8), video('b', 2, 8)],
		[warmUp(1), warmUp(1, 'Omar', false), warmUp(30)]
	)
	expect(result).toMatchObject({
		videoCount: 2,
		ideas: 16,
		taught: 10,
		mastery: 63,
		warmUpsAnswered: 3,
		warmUpsRight: 2,
		warmUpsThisWeek: 2
	})
	expect(result.maya).toHaveLength(2)
	expect(result.omar).toHaveLength(1)
})

it('only says 100% when every idea is taught, and has no scores with nothing taught', () => {
	expect(numbers([video('a', 199, 200)]).mastery).toBe(99)
	expect(numbers([video('a', 200, 200)]).mastery).toBe(100)
	expect(numbers([])).toMatchObject({ ideas: 0, mastery: 0, streak: 0, bestRun: 0, activeDays: 0 })
})

it('counts a streak up to today, or yesterday when today is not done yet', () => {
	expect(numbers([], [warmUp(0), warmUp(1), warmUp(2), warmUp(4)]).streak).toBe(3)
	expect(numbers([], [warmUp(1), warmUp(2)]).streak).toBe(2)
	expect(numbers([], [warmUp(2), warmUp(3)]).streak).toBe(0)
})

it('remembers the best run, and counts a day once however much was done', () => {
	const result = numbers([], [warmUp(20), warmUp(19), warmUp(18), warmUp(5), warmUp(5)])
	expect(result).toMatchObject({ bestRun: 3, streak: 0, activeDays: 4 })
})

it('draws six weeks, Monday first, with the rest of this week still to come', () => {
	const { calendar } = numbers([video('a', 1, 1, 4)], [warmUp(4), warmUp(2), warmUp(0)])
	expect(calendar).toHaveLength(6)
	expect(calendar[5]).toEqual([2, 0, 1, 0, 1, null, null])
	expect(calendar[0]).toEqual([0, 0, 0, 0, 0, 0, 0])
})

it('grows the chart class by class, oldest first, up to the share taught', () => {
	const result = numbers([video('new', 2, 4, 1), video('old', 1, 4, 9)])
	expect(result.classes.map((v) => v.id)).toEqual(['old', 'new'])
	expect(result.growth).toEqual([0.125, 0.375])
})
