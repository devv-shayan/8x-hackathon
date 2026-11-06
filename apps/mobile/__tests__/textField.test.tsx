/**
 * Every text field looks like the website's: white with a hairline edge, not the old grey fill,
 * with a lime ring only while it has focus and no system outline. The code boxes match it.
 */
import { StyleSheet } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { theme } from '@app/brand'
import { CodeInput } from '@/components/ui/CodeInput'
import TextInputField from '@/components/ui/TextInputField'

jest.mock('react-native-reanimated', () => {
	const { View } = jest.requireActual('react-native')
	const motion = { duration: () => motion, reduceMotion: () => motion }
	return {
		__esModule: true,
		default: { View },
		ReduceMotion: { System: 'system' },
		ZoomIn: motion,
		useAnimatedStyle: () => ({}),
		useReducedMotion: () => true,
		useSharedValue: (value: number) => ({ value }),
		withRepeat: (value: number) => value,
		withSequence: (value: number) => value,
		withTiming: (value: number) => value
	}
})
jest.mock('@/lib/motion', () => ({
	Durations: { fast: 0 },
	shake: () => 0
}))
jest.mock('@/lib/haptics', () => ({ haptic: { warning: () => undefined } }))

const { surface, well } = theme.palettes.light

function fieldStyle() {
	const input = screen.getByLabelText('Name')
	return StyleSheet.flatten(input.parent?.parent?.props.style) as { backgroundColor?: string }
}

describe('text field', () => {
	it('is white, not the grey well', () => {
		render(<TextInputField accessibilityLabel="Name" />)
		expect(fieldStyle().backgroundColor).toBe(surface)
		expect(fieldStyle().backgroundColor).not.toBe(well)
	})

	it('shows the ring only while it has focus', () => {
		render(<TextInputField accessibilityLabel="Name" />)
		expect(screen.queryByTestId('focus-ring')).toBeNull()
		fireEvent(screen.getByLabelText('Name'), 'focus')
		expect(screen.getByTestId('focus-ring')).toBeTruthy()
		fireEvent(screen.getByLabelText('Name'), 'blur')
		expect(screen.queryByTestId('focus-ring')).toBeNull()
	})

	it('shows the error, not the ring, when a focused field is wrong', () => {
		render(<TextInputField accessibilityLabel="Name" error="Add your name." />)
		fireEvent(screen.getByLabelText('Name'), 'focus')
		expect(screen.queryByTestId('focus-ring')).toBeNull()
		expect(screen.getByText('Add your name.')).toBeTruthy()
	})

	it('still calls the caller on focus and blur', () => {
		const onFocus = jest.fn()
		const onBlur = jest.fn()
		render(<TextInputField accessibilityLabel="Name" onFocus={onFocus} onBlur={onBlur} />)
		fireEvent(screen.getByLabelText('Name'), 'focus')
		fireEvent(screen.getByLabelText('Name'), 'blur')
		expect(onFocus).toHaveBeenCalledTimes(1)
		expect(onBlur).toHaveBeenCalledTimes(1)
	})
})

describe('code boxes', () => {
	it('ring the box being typed in', () => {
		render(<CodeInput value="12" onChange={() => undefined} />)
		expect(screen.queryByTestId('focus-ring')).toBeNull()
		fireEvent(screen.getByLabelText('Six-digit code'), 'focus')
		expect(screen.getAllByTestId('focus-ring')).toHaveLength(1)
	})
})
