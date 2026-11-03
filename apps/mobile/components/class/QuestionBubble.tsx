import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import type { QuestionReveal } from '@/hooks/useQuestionReveal'

/** The tail's height and half its width. */
export const BUBBLE_TAIL = 14
const TAIL_HALF = 11
/** The bubble's inset from the screen's sides, and how close the tail comes to its corners. */
const SIDE = 16
const CORNER = 26
/**
 * Past this many characters a question is set smaller, so one written before questions were
 * kept short still fits without scrolling (R16 keeps new ones under 140).
 */
const LONG_QUESTION = 120

/**
 * The asking student's question, in a speech bubble under the class's top buttons, its tail
 * pointing down at their head (docs/class-scene-requirements.md, R7–R13). Every word is laid
 * out from the start, so the bubble keeps its size while the words appear as they're said; the
 * word being said is highlighted. A tap shows the whole question. A question too long for the
 * room scrolls inside the bubble. Screen readers get the whole question as one header.
 */
export function QuestionBubble({
	question,
	student,
	reveal,
	top,
	maxHeight,
	tailX,
	showName,
	onShowAll,
	onLayout
}: {
	question: string
	student: string
	reveal: QuestionReveal
	/** Where the bubble starts, and the most it can take with its tail, in points. */
	top: number
	maxHeight?: number
	/** The asking student's head, in points across the screen. */
	tailX: number | null
	/** With the keyboard up the sheet covers the student, so the bubble says who's asking. */
	showName: boolean
	onShowAll: () => void
	onLayout?: (e: LayoutChangeEvent) => void
}) {
	const { colors: c, elevation } = useTheme()
	const [width, setWidth] = useState(0)
	const last = reveal.words.length - 1
	const variant = question.length > LONG_QUESTION ? 'h3' : 'h2'
	const tailLeft =
		tailX === null || width === 0
			? null
			: Math.min(Math.max(tailX - SIDE - TAIL_HALF, CORNER), width - CORNER - 2 * TAIL_HALF)

	return (
		<View
			style={[s.wrap, { top, maxHeight }]}
			onLayout={(e) => {
				setWidth(e.nativeEvent.layout.width)
				onLayout?.(e)
			}}
			pointerEvents="box-none"
		>
			<View style={[s.bubble, { backgroundColor: c.surface }, elevation.soft]}>
				<ScrollView style={s.scroll} bounces={false} showsVerticalScrollIndicator={false}>
					<Pressable onPress={onShowAll} accessible={false}>
						<Text variant={variant} accessibilityRole="header" accessibilityLabel={question}>
							{reveal.words.map((word, i) => (
								// Each word names the variant too: the app's Text sets its own font.
								<Text
									key={i}
									variant={variant}
									style={
										i >= reveal.shown
											? s.unsaid
											: i === reveal.current
												? { backgroundColor: c.brandFill, color: c.onBrand }
												: undefined
									}
								>
									{i < last ? `${word} ` : word}
								</Text>
							))}
						</Text>
						{reveal.waiting ? (
							<Text
								variant={variant}
								tone="tertiary"
								style={s.waiting}
								importantForAccessibility="no"
							>
								…
							</Text>
						) : null}
					</Pressable>
					{showName ? <MonoLabel style={s.name}>{`${student} asks`}</MonoLabel> : null}
				</ScrollView>
			</View>
			{tailLeft === null ? null : (
				<View
					pointerEvents="none"
					style={[s.tail, { left: tailLeft, borderTopColor: c.surface }]}
				/>
			)}
		</View>
	)
}

const s = StyleSheet.create({
	wrap: { position: 'absolute', left: SIDE, right: SIDE, zIndex: 1, paddingBottom: BUBBLE_TAIL },
	bubble: { borderRadius: 24, paddingHorizontal: 18, paddingVertical: 14, flexShrink: 1 },
	scroll: { flexGrow: 0 },
	unsaid: { color: 'transparent' },
	waiting: { position: 'absolute', left: 0, top: 0 },
	name: { marginTop: 6 },
	tail: {
		position: 'absolute',
		bottom: 0,
		width: 0,
		height: 0,
		borderLeftWidth: TAIL_HALF,
		borderRightWidth: TAIL_HALF,
		borderTopWidth: BUBBLE_TAIL,
		borderLeftColor: 'transparent',
		borderRightColor: 'transparent'
	}
})
