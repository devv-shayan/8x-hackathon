/**
 * The dashboard's content: what it shows for the numbers it is given, and where each tap goes.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ProgressVideo } from '@app/contract'
import { Dashboard, DashboardEmpty } from '@/components/dashboard/Dashboard'
import { dashboardNumbers } from '@/lib/dashboard'

jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))

const NOW = new Date(2026, 10, 6, 16, 0)
const TODAY = new Date(2026, 10, 6, 12).toISOString()
const LONG_AGO = new Date(2026, 8, 1, 12).toISOString()

const video = (
	id: string,
	taught: number,
	idea_count: number,
	taught_at = LONG_AGO
): ProgressVideo => ({
	id,
	title: `Video ${id}`,
	youtube_id: 'UNP03fDSj1U',
	idea_count,
	first_try: taught,
	taught,
	learned: 0,
	open_gaps: idea_count - taught,
	taught_at
})

function show(videos: ProgressVideo[], quiz: { best: number; total: number } | null = null) {
	const onOpenVideo = jest.fn()
	const onOpenMemory = jest.fn()
	const warmUps = [{ asked_at: TODAY, student_name: 'Maya', is_right: true }]
	render(
		<Dashboard
			numbers={dashboardNumbers({ videos, warm_ups: warmUps }, NOW)}
			quiz={quiz}
			onOpenVideo={onOpenVideo}
			onOpenMemory={onOpenMemory}
		/>
	)
	return { onOpenVideo, onOpenMemory }
}

it('shows the scoreboard, the streak and the tiles', () => {
	show([video('a', 8, 8), video('b', 1, 5)], { best: 4, total: 5 })
	expect(screen.getByLabelText('Mastery: 69 percent, 9 of 13 ideas')).toBeTruthy()
	expect(screen.getByLabelText('Streak: 1 day in a row')).toBeTruthy()
	expect(screen.getByLabelText('Videos taught: 2')).toBeTruthy()
	expect(screen.getByLabelText('Warm-ups right: 1/1')).toBeTruthy()
	expect(screen.getByLabelText('Quiz best: 4/5')).toBeTruthy()
	expect(screen.getByText('Maya · 1 of 1 right')).toBeTruthy()
	expect(screen.getByText('Omar · not yet')).toBeTruthy()
})

it('shows the best run when no streak is going, and a dash with no quiz played', () => {
	const onOpenVideo = jest.fn()
	render(
		<Dashboard
			numbers={dashboardNumbers({ videos: [video('a', 1, 2)], warm_ups: [] }, NOW)}
			quiz={null}
			onOpenVideo={onOpenVideo}
			onOpenMemory={jest.fn()}
		/>
	)
	expect(screen.getByLabelText('Best run: 1 day in a row')).toBeTruthy()
	expect(screen.getByLabelText('Quiz best: -')).toBeTruthy()
})

it('opens the video from its row', () => {
	const best = video('a', 8, 8)
	const { onOpenVideo } = show([best, video('b', 1, 5)])
	fireEvent.press(screen.getByLabelText(/^Video a: 8\/8 ideas/))
	expect(onOpenVideo).toHaveBeenCalledWith(best)
})

it('opens Class memory from who quizzed you', () => {
	const { onOpenMemory } = show([video('a', 1, 5)])
	fireEvent.press(screen.getByLabelText(/^Who quizzed you/))
	expect(onOpenMemory).toHaveBeenCalled()
})

it('offers the first video when nothing has been taught', () => {
	const onTeach = jest.fn()
	render(<DashboardEmpty onTeach={onTeach} />)
	fireEvent.press(screen.getByText('Teach your first video'))
	expect(onTeach).toHaveBeenCalled()
})
