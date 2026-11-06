/**
 * Home's Class memory card says what it is and opens the board, recording the way in.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ClassMemoryLink } from '@/components/memory/ClassMemoryLink'
import { track } from '@/lib/analytics'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

it('shows both students, and opens Class memory on a tap', () => {
	render(<ClassMemoryLink />)
	expect(screen.getByText('Class memory')).toBeTruthy()
	expect(screen.getByLabelText('Maya')).toBeTruthy()
	expect(screen.getByLabelText('Omar')).toBeTruthy()

	fireEvent.press(screen.getByRole('button'))
	expect(track).toHaveBeenCalledWith('memory_opened', { source: 'home' })
	const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } }
	expect(router.push).toHaveBeenCalledWith('/memory')
})
