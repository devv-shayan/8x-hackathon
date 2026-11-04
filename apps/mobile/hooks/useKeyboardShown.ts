import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

/**
 * Whether the on-screen keyboard is up. iOS says so as it starts to move, so a layout can move
 * with it; Android only once it has.
 */
export function useKeyboardShown(): boolean {
	const [shown, setShown] = useState(false)
	useEffect(() => {
		const ios = Platform.OS === 'ios'
		const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () =>
			setShown(true)
		)
		const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
			setShown(false)
		)
		return () => {
			show.remove()
			hide.remove()
		}
	}, [])
	return shown
}
