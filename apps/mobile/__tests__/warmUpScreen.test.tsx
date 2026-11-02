/**
 * The warm-up screen: after an answer, the result stays on screen even though the gap has
 * left the due list.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AnswerWarmUpResult, DueWarmUp } from '@app/contract'
import WarmUpScreen from '@/app/warm-up/[gapId]'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('expo-router', () => ({
	router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
	useLocalSearchParams: () => ({ gapId: 'gap' }),
	useIsFocused: () => true
}))
jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))
jest.mock('@/components/pixel/PixelBackdrop', () => ({ PixelBackdrop: () => null }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))
jest.mock('@/lib/api', () => ({ api: jest.fn(), errorMessage: () => 'error' }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

const DUE: DueWarmUp = {
	gap_id: 'gap',
	topic_title: 'How plants eat',
	concept_title: 'Photosynthesis',
	start_seconds: 12,
	student_name: 'Maya',
	open_warm_up: { id: 'warm-up', question: 'So how do plants make food?', student_name: 'Maya' }
}

const NOT_QUITE: AnswerWarmUpResult = {
	is_right: false,
	closed: false,
	next_due_at: '2026-11-04T08:00:00.000Z'
}

describe('the warm-up screen', () => {
	it('keeps the result on screen once the gap is no longer due', async () => {
		let answered = false
		jest.mocked(api).mockImplementation(((name: string) => {
			if (name === 'listDueWarmUps') return Promise.resolve({ warm_ups: answered ? [] : [DUE] })
			if (name === 'answerWarmUp') {
				answered = true
				return Promise.resolve(NOT_QUITE)
			}
			return Promise.reject(new Error(`unexpected ${name}`))
		}) as never)
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false, gcTime: Infinity } }
		})
		render(
			<QueryClientProvider client={client}>
				<WarmUpScreen />
			</QueryClientProvider>
		)

		fireEvent.press(await screen.findByText('I don’t remember'))

		expect(await screen.findByText(/^Not quite\. It comes back /)).toBeTruthy()
		expect(track).toHaveBeenCalledWith('warm_up_answered', { gap_id: 'gap', is_right: false })
		// The due list has refetched without the gap; the result must still be what shows.
		await waitFor(() =>
			expect(
				jest.mocked(api).mock.calls.filter(([name]) => name === 'listDueWarmUps')
			).toHaveLength(2)
		)
		expect(screen.getByText(/^Not quite\./)).toBeTruthy()
		expect(screen.queryByText('Nothing due right now.')).toBeNull()
	})
})
