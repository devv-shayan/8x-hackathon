/**
 * Maya's memory: concept titles as fading chalk with their day, the due one opens its
 * warm-up, kept ideas open their topic, the next reminder shows only when this phone gets
 * them, and an empty board says what the screen is for.
 */
import { Dimensions, StyleSheet } from 'react-native'
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

const DUE: MemoryIdea = {
	gap_id: '44444444-4444-4444-8444-444444444444',
	topic_id: '33333333-3333-4333-8333-333333333333',
	topic_title: 'Vaccines',
	concept_title: 'Herd immunity',
	closed: false,
	next_due_at: '2020-01-01T00:00:00.000Z',
	judged: true
}

const DAY = 24 * 60 * 60 * 1000

/** Two days into a five-day ruler after a judged warm-up: three days left. */
const FADING: MemoryIdea = {
	...DUE,
	gap_id: '55555555-5555-4555-8555-555555555555',
	concept_title: 'Antibodies',
	next_due_at: new Date(Date.now() + 2.5 * DAY).toISOString()
}

const KEPT: MemoryIdea = {
	...DUE,
	gap_id: '66666666-6666-4666-8666-666666666666',
	topic_id: '77777777-7777-4777-8777-777777777777',
	concept_title: 'Vaccination',
	closed: true,
	next_due_at: null
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

describe("Maya's memory", () => {
	it('shows the concept title and its video, and opens the due warm-up', async () => {
		renderBoard([DUE])
		expect(await screen.findByText('Herd immunity')).toBeTruthy()
		expect(screen.getByText('Vaccines · day 5')).toBeTruthy()
		fireEvent.press(screen.getByLabelText('Maya is forgetting Herd immunity. Practice it.'))
		expect(track).toHaveBeenCalledWith('memory_idea_tapped', { gap_id: DUE.gap_id })
		const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } }
		expect(router.push).toHaveBeenCalledWith(`/warm-up/${DUE.gap_id}`)
		fireEvent.press(screen.getByLabelText('Open the topic for Herd immunity'))
		expect(track).toHaveBeenCalledWith('memory_topic_opened', { topic_id: DUE.topic_id })
		expect(router.push).toHaveBeenCalledWith(`/topic/${DUE.topic_id}`)
	})

	it('says how far each idea has faded, and what changed overnight', async () => {
		renderBoard([DUE, FADING])
		expect(await screen.findByText('Vaccines · day 2')).toBeTruthy()
		expect(screen.getByText('3 days left')).toBeTruthy()
		expect(screen.getByText('2 ideas faded a little overnight. 1 is due.')).toBeTruthy()
		expect(screen.getByLabelText("Day 2 of 5 before it's due")).toBeTruthy()
	})

	it('keeps closed ideas apart, and each opens its topic', async () => {
		renderBoard([DUE, KEPT])
		expect(await screen.findByText('Kept for good')).toBeTruthy()
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

	it('tells a new person what the empty board is for', async () => {
		renderBoard([])
		expect(
			await screen.findByText('Teach a class, and what Maya might forget will show up here.')
		).toBeTruthy()
	})

	it('keeps the writing surface at least half the screen tall with one line or none', async () => {
		renderBoard([])
		const board = await screen.findByTestId('memory-board')
		const style = StyleSheet.flatten(board.props.style)
		expect(style.minHeight).toBeGreaterThanOrEqual(Dimensions.get('window').height * 0.5)
	})
})
