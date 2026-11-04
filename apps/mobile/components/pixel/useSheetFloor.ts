import { useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'

/** The space between something floating at the top and a raised hand below it, in points. */
const CEILING_GAP = 12

/**
 * Where a screen's sheet starts, as a share of its height, for PixelBackdrop's `floor`: put
 * `onScreenLayout` on the screen and `onSheetLayout` on the sheet's wrapper, and students stand
 * on the sheet's top edge wherever long content pushes it. `screenWidth` and `screenHeight` are
 * 0 until the screen has been laid out. While `hold` is set (the keyboard is up), the floor
 * stays where it was, so the sheet covers the students instead of shrinking them. Put
 * `onCeilingLayout` on anything floating below the top buttons, for PixelBackdrop's `ceiling`,
 * and the students shrink to fit under it instead of behind it.
 */
export function useSheetFloor({ hold = false }: { hold?: boolean } = {}) {
	const [screen, setScreen] = useState({ width: 0, height: 0 })
	const [sheetTop, setSheetTop] = useState(0)
	const [overhead, setOverhead] = useState(0)
	return {
		floor: screen.height && sheetTop ? sheetTop / screen.height : null,
		ceiling: screen.height && overhead ? (overhead + CEILING_GAP) / screen.height : null,
		screenWidth: screen.width,
		screenHeight: screen.height,
		onScreenLayout: (e: LayoutChangeEvent) => {
			const { width, height } = e.nativeEvent.layout
			setScreen({ width, height })
		},
		onSheetLayout: (e: LayoutChangeEvent) => {
			if (!hold) setSheetTop(e.nativeEvent.layout.y)
		},
		onCeilingLayout: (e: LayoutChangeEvent) =>
			setOverhead(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
	}
}
