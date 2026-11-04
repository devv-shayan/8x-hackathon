/**
 * Maya's memory: concept titles as chalk, the due one opens its warm-up, and an empty
 * board says what the screen is for.
 */
import { render, screen, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MemoryIdea } from '@app/contract'
import MemoryScreen from '@/app/memory'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'

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
jest.mock('@/lib/memory-push', () => ({ useMemoryPush: () => undefined }))

const DUE: MemoryIdea = {
	gap_id: '44444444-4444-4444-8444-444444444444',
	topic_id: '33333333-3333-4333-8333-333333333333',
	topic_title: 'Vaccines',
	concept_title: 'Herd immunity',
	closed: false,
	next_due_at: '2020-01-01T00:00:00.000Z',
	judged: true
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
		expect(screen.getByText('Vaccines')).toBeTruthy()
		fireEvent.press(screen.getByLabelText('Maya is forgetting Herd immunity. Practice it.'))
		expect(track).toHaveBeenCalledWith('memory_idea_tapped', { gap_id: DUE.gap_id })
		const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } }
		expect(router.push).toHaveBeenCalledWith(`/warm-up/${DUE.gap_id}`)
		fireEvent.press(screen.getByLabelText('Open the topic for Herd immunity'))
		expect(track).toHaveBeenCalledWith('memory_topic_opened', { topic_id: DUE.topic_id })
		expect(router.push).toHaveBeenCalledWith(`/topic/${DUE.topic_id}`)
	})

	it('tells a new person what the empty board is for', async () => {
		renderBoard([])
		expect(
			await screen.findByText('Teach a class, and what Maya might forget will show up here.')
		).toBeTruthy()
	})
})
