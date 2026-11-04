import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { SCENES, studentBounds, type Raised, type SceneName, type StudentName } from '@app/pixel'

/**
 * Tap areas over the students a scene draws, laid over its PixelBackdrop. Only students with
 * a hand up can be called on, which is how the class picks whose question to answer.
 */
export function StudentTargets({
	scene,
	raised,
	floor = null,
	onPick
}: {
	scene: SceneName
	raised: Raised
	/** The same floor the scene's PixelBackdrop stands its students on. */
	floor?: number | null
	onPick: (name: StudentName) => void
}) {
	const [size, setSize] = useState<{ width: number; height: number } | null>(null)
	const boxes = size ? studentBounds(SCENES[scene], size.width, size.height, floor) : []

	return (
		<View
			pointerEvents="box-none"
			style={StyleSheet.absoluteFill}
			onLayout={(e) => setSize(e.nativeEvent.layout)}
		>
			{boxes.map((box) => {
				const handUp = (raised[box.name] ?? 0) > 0.5
				return (
					<Pressable
						key={box.name}
						disabled={!handUp}
						onPress={() => onPick(box.name)}
						accessibilityRole="button"
						accessibilityLabel={`${box.name}, hand up`}
						accessibilityElementsHidden={!handUp}
						importantForAccessibility={handUp ? 'yes' : 'no-hide-descendants'}
						style={[s.box, { left: box.left, top: box.top, width: box.width, height: box.height }]}
					/>
				)
			})}
		</View>
	)
}

const s = StyleSheet.create({ box: { position: 'absolute' } })
