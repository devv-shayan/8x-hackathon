import { useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'

/** The space between something floating at the top and a raised hand below it, in points. */
const CEILING_GAP = 12

/**
 * Where a screen's sheet starts, as a share of its height, for PixelBackdrop's `floor`: put
 * `onScreenLayout` on the screen and `onSheetLayout` on the sheet's wrapper, and students stand
 * on the sheet's top edge wherever long content pushes it. `screenHeight` is 0 until the screen
 * has been laid out. Put `onCeilingLayout` on anything floating below the top buttons, for
 * PixelBackdrop's `ceiling`, and the students shrink to fit under it instead of behind it.
 */
export function useSheetFloor() {
	const [screenHeight, setScreenHeight] = useState(0)
	const [sheetTop, setSheetTop] = useState(0)
	const [overhead, setOverhead] = useState(0)
	return {
		floor: screenHeight && sheetTop ? sheetTop / screenHeight : null,
		ceiling: screenHeight && overhead ? (overhead + CEILING_GAP) / screenHeight : null,
		screenHeight,
		onScreenLayout: (e: LayoutChangeEvent) => setScreenHeight(e.nativeEvent.layout.height),
		onSheetLayout: (e: LayoutChangeEvent) => setSheetTop(e.nativeEvent.layout.y),
		onCeilingLayout: (e: LayoutChangeEvent) =>
			setOverhead(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
	}
}
