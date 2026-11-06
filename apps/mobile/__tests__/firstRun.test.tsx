/**
 * First-run Home: when it shows, and what its starter video does.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { parseYouTubeVideoId, type ListedTopic } from '@app/contract'
import { HowAClassWorks, MayaAsks, StarterVideo } from '@/components/home/FirstRun'
import { isFirstRun, STARTER_URL, STARTER_VIDEO } from '@/lib/firstRun'

jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))

const topic = (taught: boolean): ListedTopic => ({
	id: '33333333-3333-4333-8333-333333333333',
	youtube_id: 'UNP03fDSj1U',
	title: 'A video',
	open_class_id: null,
	...(taught ? { idea_count: 5, ideas_taught: 3 } : {})
})

it('is a first run until a class has finished', () => {
	expect(isFirstRun([])).toBe(true)
	expect(isFirstRun([topic(false)])).toBe(true)
	expect(isFirstRun([topic(false), topic(true)])).toBe(false)
})

it('is not a first run while the videos are unknown', () => {
	expect(isFirstRun(undefined)).toBe(false)
})

it('offers a starter link the reader accepts', () => {
	expect(parseYouTubeVideoId(STARTER_URL)).toBe(STARTER_VIDEO.youtubeId)
})

it('reads the starter video on a tap, and not while another reads', () => {
	const onPress = jest.fn()
	const { rerender } = render(<StarterVideo onPress={onPress} disabled={false} />)
	fireEvent.press(screen.getByRole('button'))
	expect(onPress).toHaveBeenCalledTimes(1)
	rerender(<StarterVideo onPress={onPress} disabled />)
	fireEvent.press(screen.getByRole('button'))
	expect(onPress).toHaveBeenCalledTimes(1)
})

it('has Maya ask, and says how a class works', () => {
	render(
		<>
			<MayaAsks />
			<HowAClassWorks />
		</>
	)
	expect(screen.getByRole('header')).toBeTruthy()
	expect(screen.getByLabelText(/^1\. Paste a video/)).toBeTruthy()
	expect(screen.getByLabelText(/^3\. They come back to you/)).toBeTruthy()
})
