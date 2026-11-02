import { useEffect } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import type { ClassSession, ConceptResult, TurnOutcome } from '@app/contract'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Text } from '@/components/ui/Text'
import { track } from '@/lib/analytics'
import { finalResult, summarizeResults } from '@/lib/assessment'
import { formatTimestamp } from '@/lib/formatTimestamp'
import { youtubeWatchUrl } from '@/lib/youtubeWatch'
import { leaveClass, studentName } from './shared'

function resultLabel(result: ConceptResult['result']) {
	if (result === 'correct') return 'Correct'
	if (result === 'missed') return 'Missed'
	return 'Wrong'
}

function outcomeLabel(outcome: TurnOutcome) {
	if (outcome === 'answered') return 'Answered'
	if (outcome === 'needed_help') return 'Needed help'
	return 'Skipped'
}

function ConceptCard({
	item,
	label,
	youtubeId
}: {
	item: ConceptResult
	label: string
	youtubeId: string | null
}) {
	const canOpen = Boolean(youtubeId)

	function openClip() {
		if (!youtubeId) return
		track('assessment_clip_opened', { concept: item.concept })
		void Linking.openURL(youtubeWatchUrl(youtubeId, item.start_seconds))
	}

	return (
		<Card
			onPress={canOpen ? openClip : undefined}
			accessibilityLabel={
				canOpen
					? `Open video for ${item.concept}${item.start_seconds != null ? ` at ${formatTimestamp(item.start_seconds)}` : ''}`
					: undefined
			}
		>
			<View style={s.conceptRow}>
				<Eyebrow tone="muted">
					{item.start_seconds != null ? formatTimestamp(item.start_seconds) : label}
				</Eyebrow>
				<Text variant="body" style={{ fontWeight: '600' }}>
					{item.concept}
				</Text>
				{item.quote ? (
					<Text variant="bodySm" tone="secondary">
						{`“${item.quote}”`}
					</Text>
				) : null}
				<Text variant="caption" tone="secondary">
					{canOpen ? `${label} · Open in YouTube` : label}
				</Text>
			</View>
		</Card>
	)
}

function ScoreCard({ score, label }: { score: string; label: string }) {
	return (
		<View style={s.scoreCard}>
			<Card>
				<View style={s.conceptRow}>
					<Text variant="h1">{score}</Text>
					<Text variant="caption" tone="secondary">
						{label}
					</Text>
				</View>
			</Card>
		</View>
	)
}

/** What the class taught: the scores, each idea with its moment in the video, each question. */
export function ResultsStep({ session }: { session: ClassSession }) {
	const results = session.concept_results ?? []
	const reactions = session.reactions ?? []
	const { correct, finalCorrect, scoredAfterClass, fixed, gaps } = summarizeResults(results)
	const answered = session.turns.filter(({ outcome }) => outcome !== null)
	const youtubeId = session.youtube_id

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
		<View style={s.assessment}>
			{scoredAfterClass ? (
				<View style={s.scores} accessibilityRole="header">
					<ScoreCard score={`${correct} of ${results.length}`} label="In your first explanation" />
					<ScoreCard score={`${finalCorrect} of ${results.length}`} label="By the end of class" />
				</View>
			) : (
				<>
					<Text variant="h1" accessibilityRole="header">
						{results.length > 0 ? `${correct} of ${results.length}` : 'Class finished'}
					</Text>
					<Text variant="lead" tone="secondary">
						{results.length > 0
							? 'How your explanation scored, and how the class went.'
							: 'Your explanation score isn’t available for this class.'}
					</Text>
				</>
			)}

			{fixed.length > 0 ? (
				<View style={s.section}>
					<Eyebrow tone="muted">Fixed in class</Eyebrow>
					<Text variant="bodySm" tone="secondary">
						You got these while teaching. They’ll come back in a warm-up to check they stuck.
					</Text>
					{fixed.map((item) => (
						<ConceptCard
							key={item.concept}
							item={item}
							label={`${resultLabel(item.result)} at first`}
							youtubeId={youtubeId}
						/>
					))}
				</View>
			) : null}

			{gaps.length > 0 ? (
				<View style={s.section}>
					<Eyebrow tone="muted">
						{scoredAfterClass ? 'Still missed or wrong' : 'Missed or wrong'}
					</Eyebrow>
					{gaps.map((item) => (
						<ConceptCard
							key={item.concept}
							item={item}
							label={resultLabel(finalResult(item))}
							youtubeId={youtubeId}
						/>
					))}
				</View>
			) : null}

			{answered.length > 0 ? (
				<View style={s.section}>
					<Eyebrow tone="muted">How each question went</Eyebrow>
					{answered.map((turn) => (
						<Card key={turn.id}>
							<View style={s.conceptRow}>
								<Eyebrow tone="muted">
									{`${studentName(session, turn)} · ${outcomeLabel(turn.outcome!)}`}
								</Eyebrow>
								<Text variant="body">{turn.question}</Text>
							</View>
						</Card>
					))}
				</View>
			) : (
				<Text variant="body" tone="secondary">
					You didn’t answer any questions this time.
				</Text>
			)}

			{reactions.length > 0 ? (
				<View style={s.section}>
					<Eyebrow tone="muted">From the class</Eyebrow>
					{reactions.map((reaction) => {
						const who =
							session.students.find(({ id }) => id === reaction.student_id)?.name ?? 'A student'
						return (
							<Card key={reaction.student_id}>
								<View style={s.conceptRow}>
									<Eyebrow tone="muted">{who}</Eyebrow>
									<Text variant="body">{reaction.text}</Text>
								</View>
							</Card>
						)
					})}
				</View>
			) : null}

			<Button label="Back to home" fullWidth onPress={leaveClass} />
		</View>
	)
}

const s = StyleSheet.create({
	assessment: { gap: 14, paddingTop: 4 },
	scores: { flexDirection: 'row', gap: 10 },
	scoreCard: { flex: 1 },
	section: { gap: 10 },
	conceptRow: { gap: 6 }
})
