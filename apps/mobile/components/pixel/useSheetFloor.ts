import { useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'

/**
 * Where a screen's sheet starts, as a share of its height, for PixelBackdrop's `floor`: put
 * `onScreenLayout` on the screen and `onSheetLayout` on the sheet's wrapper, and students stand
 * on the sheet's top edge wherever long content pushes it.
 */
export function useSheetFloor() {
	const [screenHeight, setScreenHeight] = useState(0)
	const [sheetTop, setSheetTop] = useState(0)
	return {
		floor: screenHeight && sheetTop ? sheetTop / screenHeight : null,
		onScreenLayout: (e: LayoutChangeEvent) => setScreenHeight(e.nativeEvent.layout.height),
		onSheetLayout: (e: LayoutChangeEvent) => setSheetTop(e.nativeEvent.layout.y)
	}
}
