import type { StyleProp, ViewStyle } from 'react-native'
import type { Raised, SceneName, Stage } from '@app/pixel'

export interface PixelBackdropProps {
	/** Which step of the loop: its background and where the students stand (@app/pixel). */
	scene: SceneName
	/** Each student's hand, 0 down to 1 up. Hands move to a new value over a moment. */
	raised?: Raised
	/**
	 * Where the screen's sheet starts, as a share of its height. Students stand just above it
	 * instead of where the scene puts them, so a tall sheet never hides them.
	 */
	floor?: number | null
	/** The class: who is asking, under the light, and whether they're talking. */
	stage?: Stage | null
	/**
	 * Where the room above the sheet starts, as a share of the height, when something floats
	 * below the top buttons (the warm-up's reading pill). Students shrink to fit under it.
	 */
	ceiling?: number | null
	style?: StyleProp<ViewStyle>
}
