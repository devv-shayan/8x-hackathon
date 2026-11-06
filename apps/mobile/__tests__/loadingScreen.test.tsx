/**
 * The loading screen: one line a screen reader also hears, a Cancel that leaves, and a mark
 * that ticks, then holds still under Reduce Motion.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { LoadingScreen } from '@/components/pixel/LoadingScreen'
import { useReducedMotion } from '@/lib/motion'

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))
jest.mock('@/components/pixel/PixelBackdrop', () => ({ PixelBackdrop: () => null }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))
jest.mock('@/lib/motion', () => ({ useReducedMotion: jest.fn(() => false) }))

describe('LoadingScreen', () => {
	afterEach(() => jest.useRealTimers())

	it('says what it is waiting for, to the eye and to a screen reader', () => {
		render(<LoadingScreen label="Checking for your class" />)
		expect(screen.getByText('Checking for your class')).toBeTruthy()
		expect(screen.getByLabelText('Checking for your class').props.accessibilityRole).toBe(
			'progressbar'
		)
		expect(screen.queryByText('Cancel')).toBeNull()
	})

	it('offers Cancel when it can be left', () => {
		const onBack = jest.fn()
		render(<LoadingScreen label="Checking for your class" onBack={onBack} />)
		fireEvent.press(screen.getByText('Cancel'))
		expect(onBack).toHaveBeenCalled()
	})

	it('ticks while it waits, and stops ticking when unmounted', () => {
		jest.useFakeTimers()
		const { unmount } = render(<LoadingScreen label="Loading" />)
		act(() => jest.advanceTimersByTime(180 * 3))
		unmount()
		expect(jest.getTimerCount()).toBe(0)
	})

	it('sets no timer under Reduce Motion', () => {
		jest.mocked(useReducedMotion).mockReturnValue(true)
		jest.useFakeTimers()
		render(<LoadingScreen label="Loading" />)
		expect(jest.getTimerCount()).toBe(0)
		jest.mocked(useReducedMotion).mockReturnValue(false)
	})
})
