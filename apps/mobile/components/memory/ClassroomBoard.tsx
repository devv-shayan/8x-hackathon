import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { theme, withAlpha } from '@app/brand'
import type { MemoryIdea } from '@app/contract'
import { CLASSROOM_BOARD } from '@app/pixel'
import { PressableScale } from '@/components/motion/PressableScale'
import { Text } from '@/components/ui/Text'
import { chalkOpacity, dueIdeaId } from '@/lib/chalk'
import { useReducedMotion } from '@/lib/motion'

/** The writing surface stays this share of the screen, even with one line or none. */
const BOARD_MIN_SHARE = 0.5
const CHALK_FACE = 'CabinSketch_700Bold'
const CHALK = CLASSROOM_BOARD.chalk
const MARK = CLASSROOM_BOARD.mark
const INK = theme.palettes.light.textPrimary
const WOOD_EDGE = CLASSROOM_BOARD.wood[0]
const WOOD_GRAIN = CLASSROOM_BOARD.wood[1]
const WOOD_FACE = CLASSROOM_BOARD.wood[2]
const WOOD_TRAY = CLASSROOM_BOARD.wood[3]

function ChalkFade({ opacity, children }: { opacity: number; children: ReactNode }) {
	const reduced = useReducedMotion()
	const value = useRef(new Animated.Value(opacity)).current

	useEffect(() => {
		if (reduced) {
			value.setValue(opacity)
			return
		}
		Animated.timing(value, { toValue: opacity, duration: 700, useNativeDriver: true }).start()
	}, [opacity, reduced, value])

	return <Animated.View style={{ opacity: value }}>{children}</Animated.View>
}

function BoardHeading() {
	return (
		<Text
			variant="h1"
			accessibilityRole="header"
			style={[s.heading, { color: CHALK, fontFamily: CHALK_FACE }]}
		>
			Maya&apos;s{' '}
			<Text style={[s.mark, { fontFamily: CHALK_FACE, backgroundColor: MARK, color: INK }]}>
				memory
			</Text>
		</Text>
	)
}

function IdeaLine({
	idea,
	practice,
	now,
	first,
	onPractice,
	onOpenTopic
}: {
	idea: MemoryIdea
	practice: boolean
	now: Date
	first: boolean
	onPractice?: (gapId: string) => void
	onOpenTopic?: (topicId: string) => void
}) {
	const opacity = chalkOpacity(idea, now)
	const copy = (
		<ChalkFade opacity={opacity}>
			<Text style={[s.title, { color: CHALK, fontFamily: CHALK_FACE }]}>{idea.concept_title}</Text>
			<Text variant="caption" style={{ color: CHALK }}>
				{idea.topic_title}
			</Text>
		</ChalkFade>
	)
	return (
		<View
			style={[
				s.line,
				{
					borderTopColor: withAlpha(CHALK, 0.28),
					borderTopWidth: first ? 0 : StyleSheet.hairlineWidth
				}
			]}
		>
			{practice ? (
				<PressableScale
					onPress={() => onPractice?.(idea.gap_id)}
					accessibilityLabel={`Maya is forgetting ${idea.concept_title}. Practice it.`}
					scaleTo="card"
					style={s.copy}
				>
					{copy}
				</PressableScale>
			) : (
				<View style={s.copy}>{copy}</View>
			)}
			<Pressable
				onPress={() => onOpenTopic?.(idea.topic_id)}
				accessibilityRole="button"
				accessibilityLabel={`Open the topic for ${idea.concept_title}`}
				hitSlop={8}
			>
				<ChevronRight color={CHALK} size={22} strokeWidth={2.4} />
			</Pressable>
		</View>
	)
}

/**
 * The classroom board: oak frame, chalk tray, and one fading line per gap.
 * `ground` is the writing surface (the green board, or the grey sample).
 */
export function ClassroomBoard({
	ideas,
	now,
	ground,
	showEmpty = false,
	onPractice,
	onOpenTopic
}: {
	ideas: readonly MemoryIdea[]
	now: Date
	ground: string
	/** The empty sentence. Off while the real lines are still loading. */
	showEmpty?: boolean
	onPractice?: (gapId: string) => void
	onOpenTopic?: (topicId: string) => void
}) {
	const practiceId = dueIdeaId(ideas, now)
	const { height } = useWindowDimensions()
	return (
		<View style={[s.shell, { backgroundColor: WOOD_EDGE }]}>
			<View style={[s.frame, { backgroundColor: WOOD_FACE }]}>
				<View style={[s.groove, { backgroundColor: WOOD_GRAIN }]}>
					<View
						testID="memory-board"
						style={[s.writing, { backgroundColor: ground, minHeight: height * BOARD_MIN_SHARE }]}
					>
						<BoardHeading />
						{showEmpty ? (
							<Text variant="body" style={{ color: CHALK }}>
								Teach a class, and what Maya might forget will show up here.
							</Text>
						) : (
							ideas.map((idea, index) => (
								<IdeaLine
									key={idea.gap_id}
									idea={idea}
									practice={idea.gap_id === practiceId}
									now={now}
									first={index === 0}
									onPractice={onPractice}
									onOpenTopic={onOpenTopic}
								/>
							))
						)}
					</View>
				</View>
				<View style={[s.traySlot, { backgroundColor: WOOD_GRAIN }]}>
					<View style={[s.tray, { backgroundColor: WOOD_TRAY }]} />
				</View>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	shell: { borderRadius: 16, padding: 4 },
	frame: { borderRadius: 13, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 10 },
	groove: { padding: 5, borderRadius: 6 },
	traySlot: { marginTop: 10, borderRadius: 4, padding: 3 },
	tray: { height: 16, borderRadius: 2 },
	writing: { borderRadius: 3, paddingHorizontal: 16, paddingVertical: 12 },
	heading: { marginBottom: 8 },
	mark: { paddingHorizontal: 6 },
	line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
	copy: { flex: 1, gap: 2 },
	title: { fontSize: 28, lineHeight: 34 }
})
