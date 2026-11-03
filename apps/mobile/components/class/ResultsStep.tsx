import { useEffect } from 'react'
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ClassSession, ConceptResult, TurnOutcome } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { Button } from '@/components/ui/Button'
import { Highlight } from '@/components/ui/Highlight'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { finalResult, summarizeResults } from '@/lib/assessment'
import { formatTimestamp } from '@/lib/formatTimestamp'
import { youtubeWatchUrl } from '@/lib/youtubeWatch'
import { leaveClass, studentName } from './shared'

/** A missed idea comes back as a warm-up two days later (the gap schedule, brief.md). */
const WARM_UP_AFTER_DAYS = 2
/** How much of the screen the students on the ripples get above the sheet. */
const ROOM_SHARE = 0.34

function outcomeLabel(outcome: TurnOutcome) {
	if (outcome === 'answered') return 'Answered'
	if (outcome === 'needed_help') return 'Needed help'
	return 'Skipped'
}

function warmUpDay() {
	const day = new Date()
	day.setDate(day.getDate() + WARM_UP_AFTER_DAYS)
	return day.toLocaleDateString(undefined, { weekday: 'long' })
}

type IdeaState = 'explained' | 'fixed' | 'missed'

function stateOf(item: ConceptResult, fixed: ConceptResult[]): IdeaState {
	if (fixed.includes(item)) return 'fixed'
	return finalResult(item) === 'correct' ? 'explained' : 'missed'
}

function IdeaRow({
	item,
	state,
	youtubeId,
	onNotInVideo,
	flagging
}: {
	item: ConceptResult
	state: IdeaState
	youtubeId: string | null
	onNotInVideo: (concept: string) => void
	flagging: boolean
}) {
	const { colors: c } = useTheme()
	const canOpen = Boolean(youtubeId)
	const note =
		state === 'fixed'
			? 'Fixed in class'
			: state === 'missed'
				? `${finalResult(item) === 'wrong' ? 'Wrong' : 'Missed'} · warm-up on ${warmUpDay()}`
				: null

	function openClip() {
		if (!youtubeId) return
		track('assessment_clip_opened', { concept: item.concept })
		void Linking.openURL(youtubeWatchUrl(youtubeId, item.start_seconds))
	}

	return (
		<View style={[s.idea, { borderTopColor: c.borderHairline }]}>
			<PressableScale
				scaleTo="card"
				disabled={!canOpen}
				onPress={openClip}
				accessibilityRole={canOpen ? 'button' : 'text'}
				accessibilityLabel={`${item.concept}${note ? `, ${note}` : ''}${canOpen ? ', open in YouTube' : ''}`}
				style={s.ideaMain}
			>
				<View
					style={[
						s.mark,
						state === 'explained' && { backgroundColor: c.textPrimary },
						state === 'fixed' && { backgroundColor: c.brandFill, borderColor: c.borderActive },
						state === 'missed' && { borderColor: c.borderActive }
					]}
				>
					{state === 'missed' ? null : (
						<Check
							size={13}
							strokeWidth={3}
							color={state === 'explained' ? c.surface : c.onBrand}
						/>
					)}
				</View>
				<View style={s.ideaCopy}>
					<Text
						variant="label"
						style={[s.ideaTitle, state === 'missed' && { color: c.textSecondary }]}
					>
						{item.concept}
					</Text>
					{note ? (
						<Text variant="caption" tone="secondary">
							{note}
						</Text>
					) : null}
					{state === 'missed' && item.quote ? (
						<Text variant="caption" tone="tertiary" numberOfLines={2}>
							{`“${item.quote}”`}
						</Text>
					) : null}
				</View>
				{item.start_seconds != null ? (
					<Text variant="eyebrow" tone="secondary">
						{formatTimestamp(item.start_seconds)}
					</Text>
				) : null}
			</PressableScale>
			<Button
				label="Not in the video"
				variant="ghost"
				size="sm"
				loading={flagging}
				disabled={flagging}
				onPress={() => onNotInVideo(item.concept)}
				accessibilityLabel={`${item.concept} was not in the video`}
			/>
		</View>
	)
}

/**
 * What the class taught, on See what stuck's red ripples: the score after class as the hero,
 * every idea with its moment in the video and what happens next, how each question went,
 * and what the students said.
 */
export function ResultsStep({
	session,
	title,
	onNotInVideo,
	flaggingConcept
}: {
	session: ClassSession
	title: string | null
	onNotInVideo: (concept: string) => void
	flaggingConcept: string | null
}) {
	const { colors: c } = useTheme()
	const insets = useSafeAreaInsets()
	const { height } = useWindowDimensions()
	const results = session.concept_results ?? []
	const reactions = session.reactions ?? []
	const { correct, finalCorrect, scoredAfterClass, fixed } = summarizeResults(results)
	const answered = session.turns.filter(({ outcome }) => outcome !== null)
	const youtubeId = session.youtube_id
	const shown = scoredAfterClass ? finalCorrect : correct

	useEffect(() => {
		if (results.length === 0) return
		track('assessment_viewed', {
			correct_count: correct,
			final_correct_count: finalCorrect,
			fixed_count: fixed.length,
			concept_count: results.length
		})
	}, [correct, finalCorrect, fixed.length, results.length])

	return (
		<View style={s.fill}>
			<PixelBackdrop scene="results" />
			<ScrollView
				style={s.fill}
				contentContainerStyle={{ paddingTop: height * ROOM_SHARE }}
				showsVerticalScrollIndicator={false}
			>
				<SheetCard>
					<MonoLabel>{title ? `Results · ${title}` : 'Results'}</MonoLabel>
					{results.length > 0 ? (
						<>
							<View style={s.score} accessibilityRole="header">
								<Text variant="displayHero" tabular style={s.number}>
									{String(shown)}
								</Text>
								<Text variant="h2">
									{`of ${results.length} ideas `}
									<Highlight>taught</Highlight>
								</Text>
							</View>
							<Text variant="bodySm" tone="secondary" style={s.lede}>
								{scoredAfterClass
									? `${correct} ${correct === 1 ? 'was' : 'were'} in your explanation. You fixed ${fixed.length} in class.`
									: 'How your explanation scored. Missed ideas come back as warm-ups.'}
							</Text>
							<View style={s.list}>
								{results.map((item) => (
									<IdeaRow
										key={item.concept}
										item={item}
										state={stateOf(item, fixed)}
										youtubeId={youtubeId}
										onNotInVideo={onNotInVideo}
										flagging={flaggingConcept === item.concept}
									/>
								))}
							</View>
						</>
					) : (
						<>
							<Text variant="question" style={s.lede}>
								Class finished
							</Text>
							<Text variant="bodySm" tone="secondary" style={s.lede}>
								Your explanation score isn’t available for this class.
							</Text>
						</>
					)}

					<MonoLabel style={s.section}>How each question went</MonoLabel>
					{answered.length > 0 ? (
						answered.map((turn) => (
							<View key={turn.id} style={[s.turn, { borderTopColor: c.borderHairline }]}>
								<MonoLabel>{`${studentName(session, turn)} · ${outcomeLabel(turn.outcome!)}`}</MonoLabel>
								<Text variant="bodySm">{turn.question}</Text>
							</View>
						))
					) : (
						<Text variant="bodySm" tone="secondary" style={s.lede}>
							You didn’t answer any questions this time.
						</Text>
					)}

					{reactions.length > 0 ? (
						<>
							<MonoLabel style={s.section}>From the class</MonoLabel>
							{reactions.map((reaction) => (
								<View
									key={reaction.student_id}
									style={[s.turn, { borderTopColor: c.borderHairline }]}
								>
									<MonoLabel>
										{session.students.find(({ id }) => id === reaction.student_id)?.name ??
											'A student'}
									</MonoLabel>
									<Text variant="bodySm">{`“${reaction.text}”`}</Text>
								</View>
							))}
						</>
					) : null}

					<Button
						label="Back to home"
						variant="ink"
						size="lg"
						fullWidth
						onPress={leaveClass}
						style={s.cta}
					/>
				</SheetCard>
				<View style={{ height: insets.bottom }} />
			</ScrollView>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	score: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10, flexWrap: 'wrap' },
	number: { fontSize: 96, lineHeight: 96 },
	lede: { marginTop: 10 },
	list: { marginTop: 14 },
	idea: {
		gap: 4,
		paddingVertical: 12,
		borderTopWidth: StyleSheet.hairlineWidth
	},
	ideaMain: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12
	},
	mark: {
		width: 22,
		height: 22,
		marginTop: 1,
		borderWidth: 1.5,
		borderColor: 'transparent',
		alignItems: 'center',
		justifyContent: 'center'
	},
	ideaCopy: { flex: 1, gap: 2 },
	ideaTitle: { fontSize: 15, lineHeight: 20 },
	section: { marginTop: 28, marginBottom: 6 },
	turn: { gap: 4, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
	cta: { marginTop: 24 }
})
