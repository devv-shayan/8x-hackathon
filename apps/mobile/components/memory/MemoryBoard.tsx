import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { ChevronRight, Lock } from 'lucide-react-native'
import type { MemoryIdea } from '@app/contract'
import { Button } from '@/components/ui/Button'
import { Highlight } from '@/components/ui/Highlight'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { chalkOpacity, dueIdeaId, fadeStage } from '@/lib/chalk'
import { ShimmerWord } from './ShimmerWord'
import { StageRuler } from './StageRuler'

/** The board stays this share of the screen, even with one line or none. */
const BOARD_MIN_SHARE = 0.5

function plural(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`
}

function daysLeftWords(daysLeft: number): string {
	if (daysLeft === 0) return 'Due'
	return `${plural(daysLeft, 'day', 'days')} left`
}

/** What changed overnight: every open idea fades a day, and some reach due. */
function overnight(ideas: readonly MemoryIdea[], now: Date): string | null {
	const stages = ideas.flatMap((idea) => {
		const stage = fadeStage(idea, now)
		return stage ? [stage] : []
	})
	const faded = stages.filter((stage) => stage.daysPassed > 0).length
	const due = stages.filter((stage) => stage.daysLeft === 0).length
	if (faded === 0) return null
	const dueWords = due === 0 ? '' : ` ${due === 1 ? '1 is' : `${due} are`} due.`
	return `${plural(faded, 'idea', 'ideas')} faded a little overnight.${dueWords}`
}

function IdeaRow({
	idea,
	now,
	first,
	practice,
	onPractice,
	onOpenTopic
}: {
	idea: MemoryIdea
	now: Date
	first: boolean
	practice: boolean
	onPractice?: (gapId: string) => void
	onOpenTopic?: (topicId: string) => void
}) {
	const { colors: c } = useTheme()
	const stage = fadeStage(idea, now)
	if (!stage) return null
	return (
		<View
			style={[
				s.row,
				{ borderTopColor: c.borderHairline, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }
			]}
		>
			<MonoLabel right={daysLeftWords(stage.daysLeft)}>
				{`${idea.topic_title} · day ${stage.daysPassed}`}
			</MonoLabel>
			<View style={s.wordLine}>
				<View style={s.word}>
					<ShimmerWord
						text={idea.concept_title}
						solid={chalkOpacity(idea, now)}
						daysLeft={stage.daysLeft}
					/>
				</View>
				<Pressable
					onPress={() => onOpenTopic?.(idea.topic_id)}
					accessibilityRole="button"
					accessibilityLabel={`Open the topic for ${idea.concept_title}`}
					hitSlop={8}
				>
					<ChevronRight color={c.textTertiary} size={22} strokeWidth={2.2} />
				</Pressable>
			</View>
			<StageRuler window={stage.window} daysPassed={stage.daysPassed} />
			{practice ? (
				<Button
					label="Redraw it with Maya"
					accessibilityLabel={`Maya is forgetting ${idea.concept_title}. Practice it.`}
					variant="ink"
					size="md"
					fullWidth
					onPress={() => onPractice?.(idea.gap_id)}
				/>
			) : null}
		</View>
	)
}

/**
 * Maya's board: a white sheet with one shimmering word per idea she is forgetting, each with
 * the days it has faded and the days left, then the ideas she keeps. The signed-in screen and
 * the dev preview both use this. The green and grey classroom boards are kept in
 * ClassroomBoard, shown only in the preview.
 */
export function MemoryBoard({
	ideas,
	now,
	showEmpty = false,
	onPractice,
	onOpenTopic
}: {
	ideas: readonly MemoryIdea[]
	now: Date
	/** The empty sentence. Off while the real lines are still loading. */
	showEmpty?: boolean
	onPractice?: (gapId: string) => void
	onOpenTopic?: (topicId: string) => void
}) {
	const { colors: c, radii } = useTheme()
	const { height } = useWindowDimensions()
	const practiceId = dueIdeaId(ideas, now)
	const open = ideas.filter((idea) => fadeStage(idea, now) != null)
	const kept = ideas.filter((idea) => fadeStage(idea, now) == null)
	const sinceYesterday = overnight(ideas, now)

	return (
		<SheetCard style={s.sheet}>
			<View testID="memory-board" style={[s.board, { minHeight: height * BOARD_MIN_SHARE }]}>
				<Text variant="h1" accessibilityRole="header">
					Maya&apos;s <Highlight>memory</Highlight>
				</Text>
				{showEmpty ? (
					<Text variant="body" tone="secondary">
						Teach a class, and what Maya might forget will show up here.
					</Text>
				) : (
					<>
						{sinceYesterday ? (
							<View style={[s.overnight, { backgroundColor: c.surface2, borderRadius: radii.lg }]}>
								<Text variant="eyebrow" tone="secondary">
									Since yesterday
								</Text>
								<Text variant="bodySm">{sinceYesterday}</Text>
							</View>
						) : null}
						{open.length > 0 ? (
							<View>
								{open.map((idea, index) => (
									<IdeaRow
										key={idea.gap_id}
										idea={idea}
										now={now}
										first={index === 0}
										practice={idea.gap_id === practiceId}
										onPractice={onPractice}
										onOpenTopic={onOpenTopic}
									/>
								))}
							</View>
						) : null}
						{kept.length > 0 ? (
							<View style={s.kept}>
								<MonoLabel right={String(kept.length)}>Kept for good</MonoLabel>
								<View style={s.chips}>
									{kept.map((idea) => (
										<Pressable
											key={idea.gap_id}
											onPress={() => onOpenTopic?.(idea.topic_id)}
											accessibilityRole="button"
											accessibilityLabel={`Open the topic for ${idea.concept_title}`}
											style={[s.chip, { backgroundColor: c.surface2, borderRadius: radii.chip }]}
										>
											<Lock color={c.textSecondary} size={14} strokeWidth={2.4} />
											<Text variant="bodySm" style={s.chipText}>
												{idea.concept_title}
											</Text>
										</Pressable>
									))}
								</View>
							</View>
						) : null}
					</>
				)}
			</View>
		</SheetCard>
	)
}

const s = StyleSheet.create({
	sheet: { margin: 0 },
	board: { gap: 16 },
	overnight: { padding: 12, gap: 4 },
	row: { gap: 10, paddingVertical: 16 },
	wordLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	word: { flex: 1 },
	kept: { gap: 10 },
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingVertical: 8,
		paddingHorizontal: 12
	},
	chipText: { fontWeight: '700' }
})
