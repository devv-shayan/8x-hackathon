import { useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MemoryIdea } from '@app/contract'
import { FIGURE_COLOURS, type Rgb } from '@app/pixel'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { useSheetFloor } from '@/components/pixel/useSheetFloor'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { fadeStage } from '@/lib/chalk'

type Student = 'Maya' | 'Omar'

type Line = { idea: MemoryIdea; daysLeft: number; student: Student }

/** How many ideas "Coming up" shows before "See all". */
const COMING_UP = 3
/** Where the board's top sits under the back button when every idea is shown. */
const TOP_ROOM = 64
/** The bubble's gap below the top of the safe area. */
const BUBBLE_TOP = 64

/** The student who asks this idea's warm-up. An older server sends none: the board says Maya. */
function studentOf(idea: MemoryIdea): Student {
	return idea.student_name === 'Omar' ? 'Omar' : 'Maya'
}

/** When the warm-up comes, in words. */
function inDays(daysLeft: number) {
	if (daysLeft === 0) return 'today'
	if (daysLeft === 1) return 'tomorrow'
	return `in ${daysLeft} days`
}

/** A palette colour as the hex string React Native takes. */
function toHex([r, g, b]: Rgb) {
	return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** The student's colour, from the pixel students' own palette. */
const FACE = {
	Maya: toHex(FIGURE_COLOURS.maya[2]!),
	Omar: toHex(FIGURE_COLOURS.omar[2]!)
} as const

/** Open ideas, soonest first, each with when it's asked and by whom. */
function openLines(ideas: readonly MemoryIdea[], now: Date): Line[] {
	const lines: Line[] = []
	for (const idea of ideas) {
		const stage = fadeStage(idea, now)
		if (stage) lines.push({ idea, daysLeft: stage.daysLeft, student: studentOf(idea) })
	}
	return lines.sort(
		(a, b) =>
			new Date(a.idea.next_due_at ?? 0).getTime() - new Date(b.idea.next_due_at ?? 0).getTime()
	)
}

/** What the student says above the board. */
function bubbleLine(hero: Line | undefined, kept: number): string {
	if (!hero) {
		return kept > 0
			? 'We remember everything you taught us! Teach another video to keep us busy.'
			: 'Teach us a video. Anything you leave out, we’ll ask about again later!'
	}
	if (hero.daysLeft === 0) {
		return `I’m forgetting “${hero.idea.concept_title}”. Can you explain it to me again?`
	}
	return `No questions today! I’ll ask about “${hero.idea.concept_title}” ${inDays(hero.daysLeft)}.`
}

/**
 * The class's memory: the ideas your explanations missed, each asked again by the student who
 * asks that video's warm-ups. Whoever is forgetting today raises a hand and says so; the sheet
 * holds that idea and its warm-up, then what comes up next. Only a due idea can be answered
 * (the server starts no early warm-up); the others open their video.
 */
export function ClassMemory({
	ideas,
	now,
	reminder,
	onAnswer,
	onOpenTopic,
	onTeach,
	onExpand
}: {
	ideas: readonly MemoryIdea[]
	now: Date
	/** The next reminder note, shown at the end of the sheet on a phone that gets them. */
	reminder?: ReactNode
	onAnswer: (idea: MemoryIdea, student: Student) => void
	onOpenTopic: (topicId: string) => void
	onTeach: () => void
	onExpand: (ideaCount: number) => void
}) {
	const { colors: c, radii, elevation } = useTheme()
	const insets = useSafeAreaInsets()
	const { floor, ceiling, screenHeight, onScreenLayout, onSheetLayout, onCeilingLayout } =
		useSheetFloor()
	const [expanded, setExpanded] = useState(false)

	const open = openLines(ideas, now)
	const kept = ideas.filter((idea) => fadeStage(idea, now) == null)
	const hero = open[0]
	const dueNow = hero?.daysLeft === 0
	const dueCount = open.filter((line) => line.daysLeft === 0).length
	const speaker: Student = hero?.student ?? 'Maya'
	const rest = open.slice(1)
	const shown = expanded ? rest : rest.slice(0, COMING_UP)
	const sheetMax = screenHeight
		? screenHeight - (expanded ? insets.top + TOP_ROOM : screenHeight * 0.38)
		: undefined

	return (
		<View style={s.fill} onLayout={onScreenLayout}>
			<PixelBackdrop
				scene="classroom"
				raised={dueNow ? { [speaker]: 1 } : {}}
				floor={floor}
				ceiling={ceiling}
			/>
			{expanded ? null : (
				<View
					style={[
						speaker === 'Omar' ? s.bubbleRight : s.bubbleLeft,
						{ top: insets.top + BUBBLE_TOP, backgroundColor: c.surface },
						elevation.soft
					]}
					onLayout={onCeilingLayout}
					accessibilityLiveRegion="polite"
				>
					<View style={s.speaker}>
						<View style={[s.speakerFace, { borderRadius: radii.sm }]}>
							<PixelBackdrop scene={speaker === 'Omar' ? 'omarPortrait' : 'mayaPortrait'} />
						</View>
						<Text variant="eyebrow" tone="secondary">
							{speaker}
						</Text>
					</View>
					<Text variant="label" style={s.bubbleText}>
						{bubbleLine(hero, kept.length)}
					</Text>
				</View>
			)}
			<View style={s.fill} pointerEvents="none" />
			<View onLayout={onSheetLayout} style={{ maxHeight: sheetMax }}>
				<SheetCard style={s.shrink}>
					<ScrollView
						testID="memory-board"
						style={s.shrink}
						bounces={false}
						showsVerticalScrollIndicator={false}
					>
						<MonoLabel
							right={hero ? (dueNow ? `${dueCount} today` : `${open.length} waiting`) : undefined}
						>
							What your class might forget
						</MonoLabel>

						{hero ? (
							<>
								<Text variant="h2" accessibilityRole="header" style={s.heroTitle}>
									{hero.idea.concept_title}
								</Text>
								<Text variant="caption" tone="secondary">
									{`Your explanation missed it · ${hero.idea.topic_title}`}
								</Text>
								{dueNow ? (
									<Button
										label={`Answer ${speaker}’s question`}
										variant="ink"
										size="lg"
										fullWidth
										onPress={() => onAnswer(hero.idea, speaker)}
										style={s.cta}
									/>
								) : (
									<View style={[s.note, { backgroundColor: c.well, borderRadius: radii.xl }]}>
										<Text variant="label">{`${speaker} asks ${inDays(hero.daysLeft)}`}</Text>
										<Text variant="caption" tone="secondary">
											Nothing to answer yet. It shows up on Home when it’s time.
										</Text>
									</View>
								)}
							</>
						) : (
							<>
								<Text variant="body" tone="secondary" style={s.lede}>
									{kept.length > 0
										? 'Every idea your explanations missed is learned for good: right twice in a row.'
										: 'When your explanation misses an idea, it shows up here. A couple of days later, Maya or Omar asks about it, until you get it right twice.'}
								</Text>
								<Button
									label={kept.length > 0 ? 'Teach another video' : 'Teach your first video'}
									variant="ink"
									size="lg"
									fullWidth
									onPress={onTeach}
									style={s.cta}
								/>
							</>
						)}

						{shown.length > 0 ? (
							<View style={s.section}>
								<MonoLabel
									right={
										!expanded && rest.length > COMING_UP ? (
											<Pressable
												onPress={() => {
													setExpanded(true)
													onExpand(ideas.length)
												}}
												accessibilityRole="button"
												hitSlop={10}
											>
												<Text variant="eyebrow">{`See all ${open.length}`}</Text>
											</Pressable>
										) : undefined
									}
								>
									Coming up
								</MonoLabel>
								{shown.map((line, i) => (
									<Pressable
										key={line.idea.gap_id}
										onPress={() =>
											line.daysLeft === 0
												? onAnswer(line.idea, line.student)
												: onOpenTopic(line.idea.topic_id)
										}
										accessibilityRole="button"
										accessibilityLabel={
											line.daysLeft === 0
												? `Answer ${line.student}’s question about ${line.idea.concept_title}`
												: `Open the topic for ${line.idea.concept_title}`
										}
										style={[
											s.row,
											{
												borderTopColor: c.borderHairline,
												borderTopWidth: i ? StyleSheet.hairlineWidth : 0
											}
										]}
									>
										<View
											style={[
												s.face,
												{ backgroundColor: FACE[line.student], borderRadius: radii.sm }
											]}
											accessibilityLabel={line.student}
										>
											<Text variant="label" style={{ color: c.surface }}>
												{line.student[0]}
											</Text>
										</View>
										<View style={s.rowText}>
											<Text variant="label" numberOfLines={1}>
												{line.idea.concept_title}
											</Text>
											<Text variant="caption" tone="secondary" numberOfLines={1}>
												{line.idea.topic_title}
											</Text>
										</View>
										<Text
											variant="label"
											style={{ color: line.daysLeft === 0 ? c.textPrimary : c.textSecondary }}
										>
											{inDays(line.daysLeft)}
										</Text>
									</Pressable>
								))}
							</View>
						) : null}

						{kept.length > 0 && (expanded || !hero) ? (
							<View style={s.section}>
								<MonoLabel right={String(kept.length)}>Learned for good</MonoLabel>
								<View style={s.chips}>
									{kept.map((idea) => (
										<Pressable
											key={idea.gap_id}
											onPress={() => onOpenTopic(idea.topic_id)}
											accessibilityRole="button"
											accessibilityLabel={`Open the topic for ${idea.concept_title}`}
											style={[s.chip, { backgroundColor: c.well, borderRadius: radii.lg }]}
										>
											<Text variant="label" numberOfLines={1}>
												{idea.concept_title}
											</Text>
										</Pressable>
									))}
								</View>
							</View>
						) : null}

						{reminder ? <View style={s.section}>{reminder}</View> : null}
					</ScrollView>
				</SheetCard>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	shrink: { flexShrink: 1 },
	bubbleLeft: {
		position: 'absolute',
		left: 16,
		right: 150,
		zIndex: 2,
		gap: 4,
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 18,
		borderBottomLeftRadius: 4
	},
	bubbleRight: {
		position: 'absolute',
		left: 150,
		right: 16,
		zIndex: 2,
		gap: 4,
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 18,
		borderBottomRightRadius: 4
	},
	bubbleText: { fontWeight: '600' },
	speaker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	speakerFace: { width: 20, height: 20, overflow: 'hidden' },
	heroTitle: { marginTop: 12, marginBottom: 2 },
	lede: { marginTop: 10 },
	cta: { marginTop: 16 },
	note: { marginTop: 16, padding: 14, gap: 2 },
	section: { marginTop: 22, gap: 4 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
	face: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
	rowText: { flex: 1, gap: 1 },
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
	chip: { paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' }
})
