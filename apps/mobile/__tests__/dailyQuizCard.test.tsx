/**
 * Home's daily quiz card: only for someone who has taught a video and hasn't played today, with
 * the score to beat when there is one, opening the quiz.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { DailyQuizCard } from '@/components/quiz/DailyQuizCard'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'
import { localDay, saveQuizRecord, type QuizRecord } from '@/lib/quiz'
import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('@react-navigation/native', () => ({
	useFocusEffect: (run: () => void) => {
		// Home is in focus for the whole test.
		const { useEffect: onMount } = jest.requireActual('react')
		onMount(run, [run])
	}
}))
jest.mock('@/components/RecentTopics', () => ({ topicsQueryKey: ['topics'] }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))
jest.mock('@/lib/api', () => ({ api: jest.fn() }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

const TOPIC = { id: 'a', youtube_id: 'b', title: 'Plants' }
const OLD: QuizRecord = { best: 3, lastScore: 3, lastTotal: 5, playedDay: '2020-01-01' }

function renderCard(topics: unknown[]) {
	jest.mocked(api).mockImplementation((() => Promise.resolve({ topics })) as never)
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: Infinity } }
	})
	render(
		<QueryClientProvider client={client}>
			<DailyQuizCard />
		</QueryClientProvider>
	)
}

beforeEach(async () => {
	await AsyncStorage.clear()
	jest.mocked(track).mockClear()
})

test('someone new gets the first-time line, and it opens the quiz', async () => {
	renderCard([TOPIC])
	const card = await screen.findByLabelText(/Daily quiz\. A minute on what you’ve taught/)
	expect(track).toHaveBeenCalledWith('quiz_offered')
	fireEvent.press(card)
	expect(router.push).toHaveBeenCalledWith('/quiz')
})

test('someone who has played shows the score to beat', async () => {
	await saveQuizRecord(OLD)
	renderCard([TOPIC])
	expect(await screen.findByText('Your best: 3 of 5. Can you beat it?')).toBeTruthy()
})

test('it hides after today’s quiz', async () => {
	await saveQuizRecord({ ...OLD, playedDay: localDay(new Date()) })
	renderCard([TOPIC])
	await waitFor(() => expect(api).toHaveBeenCalled())
	await new Promise((resolve) => setTimeout(resolve, 20))
	expect(screen.queryByText(/Daily quiz/)).toBeNull()
	expect(track).not.toHaveBeenCalled()
})

test('it hides until they have taught a video', async () => {
	renderCard([])
	await waitFor(() => expect(api).toHaveBeenCalled())
	await new Promise((resolve) => setTimeout(resolve, 20))
	expect(screen.queryByText(/Daily quiz/)).toBeNull()
})
