/**
 * The class's memory: the student forgetting a due idea asks for it and the button opens that
 * warm-up, an idea not due yet can't be answered early, "Coming up" opens each video and
 * expands, learned ideas sit apart, the reminder shows only when this phone gets them, and an
 * empty board says what the screen is for.
 */
import { render, screen, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MemoryIdea } from '@app/contract'
import MemoryScreen from '@/app/memory'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { useMemoryPush } from '@/lib/memory-push'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('expo-router', () => ({
	router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }
}))
jest.mock('@react-navigation/native', () => ({
	useFocusEffect: () => undefined
}))
jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))
jest.mock('@/components/pixel/PixelBackdrop', () => ({ PixelBackdrop: () => null }))
jest.mock('@/components/ui/Skeleton', () => ({ CardSkeleton: () => null }))
jest.mock('@/components/QueryError', () => ({ QueryErrorState: () => null }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))
jest.mock('@/lib/motion', () => ({ useReducedMotion: () => true }))
jest.mock('@/lib/api', () => ({ api: jest.fn() }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/memory-push', () => ({ useMemoryPush: jest.fn(() => false) }))

const DAY = 24 * 60 * 60 * 1000

const DUE: MemoryIdea = {
	gap_id: '44444444-4444-4444-8444-444444444444',
	topic_id: '33333333-3333-4333-8333-333333333333',
	topic_title: 'Vaccines',
	concept_title: 'Herd immunity',
	closed: false,
	next_due_at: '2020-01-01T00:00:00.000Z',
	judged: true,
	student_name: 'Omar'
}

/** Not due for three days. */
const FADING: MemoryIdea = {
	...DUE,
	gap_id: '55555555-5555-4555-8555-555555555555',
	concept_title: 'Antibodies',
	next_due_at: new Date(Date.now() + 2.5 * DAY).toISOString(),
	student_name: 'Maya'
}

const KEPT: MemoryIdea = {
	...DUE,
	gap_id: '66666666-6666-4666-8666-666666666666',
	topic_id: '77777777-7777-4777-8777-777777777777',
	concept_title: 'Vaccination',
	closed: true,
	next_due_at: null
}

function later(n: number): MemoryIdea {
	return {
		...FADING,
		gap_id: `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`,
		concept_title: `Idea ${n}`,
		next_due_at: new Date(Date.now() + (1.5 + n * 0.01) * DAY).toISOString()
	}
}

function renderBoard(ideas: MemoryIdea[]) {
	jest.mocked(api).mockResolvedValue({ ideas } as never)
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: Infinity } }
	})
	render(
		<QueryClientProvider client={client}>
			<MemoryScreen />
		</QueryClientProvider>
	)
}

const { router } = jest.requireMock('expo-router') as {
	router: { push: jest.Mock; replace: jest.Mock }
}

describe("The class's memory", () => {
	beforeEach(() => jest.clearAllMocks())

	it('the student forgetting a due idea asks for it, and the button opens that warm-up', async () => {
		renderBoard([DUE, FADING])
		expect(
			await screen.findByText('I’m forgetting “Herd immunity”. Can you explain it to me again?')
		).toBeTruthy()
		expect(screen.getByText('Your explanation missed it · Vaccines')).toBeTruthy()
		fireEvent.press(screen.getByText('Answer Omar’s question'))
		expect(track).toHaveBeenCalledWith('memory_idea_tapped', {
			gap_id: DUE.gap_id,
			student: 'Omar'
		})
		expect(router.push).toHaveBeenCalledWith(`/warm-up/${DUE.gap_id}`)
	})

	it('offers no early warm-up: an idea not due says when, and its row opens the video', async () => {
		const after = { ...later(1), next_due_at: new Date(Date.now() + 3.5 * DAY).toISOString() }
		renderBoard([FADING, after])
		expect(
			await screen.findByText('No questions today! I’ll ask about “Antibodies” in 3 days.')
		).toBeTruthy()
		expect(screen.getByText('Maya asks in 3 days')).toBeTruthy()
		expect(screen.queryByText(/Answer .* question/)).toBeNull()
		fireEvent.press(screen.getByLabelText('Open the topic for Idea 1'))
		expect(track).toHaveBeenCalledWith('memory_topic_opened', { topic_id: FADING.topic_id })
		expect(router.push).toHaveBeenCalledWith(`/topic/${FADING.topic_id}`)
	})

	it('shows the next three, and See all shows every idea', async () => {
		renderBoard([DUE, later(1), later(2), later(3), later(4), later(5)])
		expect(await screen.findByText('Idea 3')).toBeTruthy()
		expect(screen.queryByText('Idea 4')).toBeNull()
		fireEvent.press(screen.getByText('See all 6'))
		expect(screen.getByText('Idea 5')).toBeTruthy()
		expect(track).toHaveBeenCalledWith('memory_list_expanded', { idea_count: 6 })
	})

	it('says Maya when an older server sends no student', async () => {
		const { student_name: _, ...noStudent } = DUE
		renderBoard([noStudent as MemoryIdea])
		expect(await screen.findByText('Answer Maya’s question')).toBeTruthy()
	})

	it('with every idea learned, says so, and each learned idea opens its video', async () => {
		renderBoard([KEPT])
		expect(
			await screen.findByText(
				'We remember everything you taught us! Teach another video to keep us busy.'
			)
		).toBeTruthy()
		expect(screen.getByText('Learned for good')).toBeTruthy()
		fireEvent.press(screen.getByLabelText('Open the topic for Vaccination'))
		expect(track).toHaveBeenCalledWith('memory_topic_opened', { topic_id: KEPT.topic_id })
	})

	it('shows the next reminder only when this phone gets them', async () => {
		renderBoard([FADING])
		await screen.findByText('Antibodies')
		expect(screen.queryByText('Next reminder')).toBeNull()

		jest.mocked(useMemoryPush).mockReturnValue(true)
		renderBoard([FADING])
		expect(await screen.findByText('Next reminder')).toBeTruthy()
		jest.mocked(useMemoryPush).mockReturnValue(false)
	})

	it('tells a new person what the board is for, and sends them to teach', async () => {
		renderBoard([])
		expect(
			await screen.findByText(
				'When your explanation misses an idea, it shows up here. A couple of days later, Maya or Omar asks about it, until you get it right twice.'
			)
		).toBeTruthy()
		fireEvent.press(screen.getByText('Teach your first video'))
		expect(track).toHaveBeenCalledWith('memory_teach_tapped')
		expect(router.replace).toHaveBeenCalledWith('/(tabs)')
	})
})
