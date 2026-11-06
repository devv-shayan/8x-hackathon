/**
 * The floating tab bar hides itself while a screen takes the whole screen, the standard way
 * (`tabBarStyle: { display: 'none' }`): Home does it while the class watches a video read.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import TabBar from '@/components/TabBar'

jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))
jest.mock('expo-blur', () => ({ BlurView: () => null }))
jest.mock('react-native-reanimated', () => ({
	__esModule: true,
	default: { View: jest.requireActual('react-native').View },
	useSharedValue: (value: number) => ({ value }),
	useAnimatedStyle: () => ({}),
	withSpring: (value: number) => value
}))
jest.mock('@/lib/motion', () => ({ Springs: { smooth: {} } }))
jest.mock('@/lib/haptics', () => ({ haptic: { select: jest.fn() } }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))

function props(tabBarStyle?: { display: 'none' }): BottomTabBarProps {
	const routes = [
		{ key: 'home', name: 'index' },
		{ key: 'profile', name: 'profile' }
	]
	const descriptors = Object.fromEntries(
		routes.map((route) => [
			route.key,
			{
				options: {
					tabBarLabel: route.name === 'index' ? 'Home' : 'Profile',
					tabBarIcon: () => null,
					...(route.key === 'home' && tabBarStyle ? { tabBarStyle } : {})
				}
			}
		])
	)
	return {
		state: { index: 0, routes },
		descriptors,
		navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn() }
	} as unknown as BottomTabBarProps
}

it('shows the tabs', () => {
	render(<TabBar {...props()} />)
	expect(screen.getByText('Home')).toBeTruthy()
	expect(screen.getByText('Profile')).toBeTruthy()
})

it('hides while the focused screen asks it to', () => {
	render(<TabBar {...props({ display: 'none' })} />)
	expect(screen.queryByText('Home')).toBeNull()
})

it('leaves a press to a tab that handles it, like the full-screen Quiz button', () => {
	const base = props()
	const navigate = jest.fn()
	const navigation = { emit: () => ({ defaultPrevented: true }), navigate }
	render(<TabBar {...base} navigation={navigation as never} />)
	fireEvent.press(screen.getByLabelText('Profile'))
	expect(navigate).not.toHaveBeenCalled()
	const { haptic } = jest.requireMock('@/lib/haptics') as { haptic: { select: jest.Mock } }
	expect(haptic.select).toHaveBeenCalled()
})
