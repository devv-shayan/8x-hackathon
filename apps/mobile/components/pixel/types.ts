import type { StyleProp, ViewStyle } from 'react-native'
import type { Raised, SceneName } from '@app/pixel'

export interface PixelBackdropProps {
	/** Which step of the loop: its background and where the students stand (@app/pixel). */
	scene: SceneName
	/** Each student's hand, 0 down to 1 up. Hands move to a new value over a moment. */
	raised?: Raised
	style?: StyleProp<ViewStyle>
}
