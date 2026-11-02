/**
 * The topic page: each gap's warm-up history, and a closed gap reading as closed.
 */
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TopicGaps } from '@app/contract'
import TopicScreen from '@/app/topic/[id]'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('expo-router', () => ({
	router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
	useLocalSearchParams: () => ({ id: 'topic' })
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
jest.mock('@/lib/api', () => ({ api: jest.fn() }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

const PAGE: TopicGaps = {
	topic: { id: 'topic', title: 'Try something new for 30 days', youtube_id: 'UNP03fDSj1U' },
	taught_at: '2026-11-02T08:00:00.000Z',
	explanation_score: { correct: 2, total: 5 },
	after_class_score: { correct: 3, total: 5 },
	gaps: [
		{
			id: 'open',
			concept_title: 'Writing a Novel in a Month',
			start_seconds: 111,
			closed: false,
			next_due_at: '2026-11-07T08:00:00.000Z',
			taught_last_class: false,
			warm_ups: [
				{ asked_at: '2026-10-31T12:00:00.000Z', student_name: 'Maya', is_right: false },
				{ asked_at: '2026-11-02T12:00:00.000Z', student_name: 'Omar', is_right: true }
			]
		},
		{
			id: 'closed',
			concept_title: 'Growing Self-Confidence',
			start_seconds: 66,
			closed: true,
			next_due_at: null,
			taught_last_class: true,
			warm_ups: []
		}
	]
}

async function renderPage() {
	jest.mocked(api).mockResolvedValue(PAGE as never)
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: Infinity } }
	})
	render(
		<QueryClientProvider client={client}>
			<TopicScreen />
		</QueryClientProvider>
	)
	await screen.findByText('Writing a Novel in a Month')
}

describe('the topic page', () => {
	it('shows who asked each warm-up and how it went, oldest first', async () => {
		await renderPage()
		const lines = screen.getAllByText(/^(Maya|Omar), .*: (right|not quite)$/)
		expect(lines).toHaveLength(2)
		expect(lines[0]).toHaveTextContent(/^Maya, .*: not quite$/)
		expect(lines[1]).toHaveTextContent(/^Omar, .*: right$/)
	})

	it('reads a closed gap as closed, and counts only open ones', async () => {
		await renderPage()
		expect(screen.getByText('Closed: right twice in warm-ups')).toBeTruthy()
		expect(screen.getByText('Gaps open')).toBeTruthy()
		expect(track).toHaveBeenCalledWith('topic_viewed', { topic_id: 'topic', open_gaps: 1 })
	})
})
