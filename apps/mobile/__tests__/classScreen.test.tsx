/**
 * The class route's first moment: when Home's list already says this video has no class in
 * progress, the explain step opens at once with the list's title, without asking the server.
 * When the list says one is in progress, or doesn't know the video, the server is asked.
 */
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ListedTopic } from '@app/contract'
import ClassScreen from '@/app/class/[topicId]'
import { api } from '@/lib/api'

const TOPIC = '33333333-3333-4333-8333-333333333333'

jest.mock('expo-router', () => ({
	useLocalSearchParams: () => ({ topicId: '33333333-3333-4333-8333-333333333333' }),
	router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }
}))
jest.mock('@/components/RecentTopics', () => ({ topicsQueryKey: ['topics'] }))
jest.mock('@/components/class/ExplainStep', () => ({
	ExplainStep: ({ title }: { title: string | null }) => {
		const { Text: T } = jest.requireActual('react-native')
		return <T>{`explain: ${title ?? 'no title'}`}</T>
	}
}))
jest.mock('@/components/class/ClassStep', () => ({ ClassStep: () => null }))
jest.mock('@/components/class/ResultsStep', () => ({ ResultsStep: () => null }))
jest.mock('@/components/pixel/LoadingScreen', () => ({
	LoadingScreen: ({ label }: { label: string }) => {
		const { Text: T } = jest.requireActual('react-native')
		return <T>{`loading: ${label}`}</T>
	}
}))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))
jest.mock('@/components/ui/Screen', () => ({ Screen: () => null }))
jest.mock('@/components/ui/PageHeader', () => ({ PageHeader: () => null }))
jest.mock('@/lib/api', () => ({ api: jest.fn(), errorMessage: () => 'error' }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/haptics', () => ({ haptic: { success: jest.fn(), error: jest.fn() } }))

function row(open: string | null): ListedTopic {
	return { id: TOPIC, youtube_id: 'abc', title: 'How vaccines work', open_class_id: open }
}

function renderClass(listed: ListedTopic[] | undefined) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	if (listed) client.setQueryData(['topics'], listed)
	render(
		<QueryClientProvider client={client}>
			<ClassScreen />
		</QueryClientProvider>
	)
}

describe('opening a class', () => {
	beforeEach(() => jest.mocked(api).mockReset())

	it("opens the explain step at once when Home's list says there is no class", () => {
		renderClass([row(null)])
		expect(screen.getByText('explain: How vaccines work')).toBeTruthy()
		expect(api).not.toHaveBeenCalled()
	})

	it('asks the server when the list says a class is in progress', async () => {
		jest.mocked(api).mockResolvedValue({ class: null } as never)
		renderClass([row('44444444-4444-4444-8444-444444444444')])
		expect(screen.getByText('loading: Checking for your class')).toBeTruthy()
		expect(api).toHaveBeenCalledWith('openClass', { query: { topic_id: TOPIC } })
		expect(await screen.findByText('explain: How vaccines work')).toBeTruthy()
	})

	it("asks the server when Home's list doesn't know this video", async () => {
		jest
			.mocked(api)
			.mockImplementation(((name: string) =>
				Promise.resolve(
					name === 'openClass'
						? { class: null }
						: { topic: { id: TOPIC, title: 'From the server', youtube_id: 'abc' } }
				)) as never)
		renderClass(undefined)
		expect(api).toHaveBeenCalledWith('openClass', { query: { topic_id: TOPIC } })
		expect(await screen.findByText('explain: From the server')).toBeTruthy()
	})
})
