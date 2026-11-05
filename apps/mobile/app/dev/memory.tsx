import { useRef } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@app/brand'
import type { MemoryIdea } from '@app/contract'
import { CLASSROOM_BOARD } from '@app/pixel'
import { ClassroomBoard } from '@/components/memory/ClassroomBoard'
import { ClassMemory } from '@/components/memory/ClassMemory'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { Text } from '@/components/ui/Text'

const DAY = 24 * 60 * 60 * 1000
const SLATE = theme.palettes.dark.surface3
const GREEN = CLASSROOM_BOARD.green
/** The green and grey classroom boards stay in this file. They are not shown. */
const SHOW_SAVED_BOARDS = false

/** One sample line per day of the fade, so the slide can be looked at. Not for release. */
function sampleIdeas(now: Date): MemoryIdea[] {
	const at = (days: number) => new Date(now.getTime() + days * DAY).toISOString()
	const line = (
		id: string,
		title: string,
		caption: string,
		days: number | null,
		judged: boolean,
		closed = false
	): MemoryIdea => ({
		gap_id: id,
		topic_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
		topic_title: caption,
		concept_title: title,
		closed,
		next_due_at: days == null ? null : at(days),
		judged,
		student_name: Number(id[0]) % 2 ? 'Maya' : 'Omar'
	})
	return [
		line('99999999-9999-4999-8999-999999999999', 'Kept', 'Closed. Stays full', null, true, true),
		line(
			'88888888-8888-4888-8888-888888888888',
			'Just found',
			'Not answered yet. 2 days left',
			2,
			false
		),
		line(
			'77777777-7777-4777-8777-777777777777',
			'Fresh, 1 day',
			'Not answered yet. 1 day left',
			1,
			false
		),
		line('66666666-6666-4666-8666-666666666666', 'Day 5', 'Just answered right', 5, true),
		line('55555555-5555-4555-8555-555555555555', 'Day 4', 'After a right answer', 4, true),
		line('44444444-4444-4444-8444-444444444444', 'Day 3', 'After a right answer', 3, true),
		line('33333333-3333-4333-8333-333333333333', 'Day 2', 'Just answered wrong', 2, true),
		line('22222222-2222-4222-8222-222222222222', 'Day 1', 'After a right answer', 1, true),
		line('11111111-1111-4111-8111-111111111111', 'Due', 'Faintest. The one to practice', 0, true)
	]
}

/**
 * The class's board with sample ideas, for a look before sign-in. The green and grey boards
 * stay in this file and render only when SHOW_SAVED_BOARDS is on. Release builds redirect home.
 */
export default function MemoryPreviewScreen() {
	const insets = useSafeAreaInsets()
	const now = useRef(new Date()).current
	if (!__DEV__) return <Redirect href="/" />
	const ideas = sampleIdeas(now)

	if (!SHOW_SAVED_BOARDS) {
		return (
			<ClassMemory
				ideas={ideas}
				now={now}
				onAnswer={() => {}}
				onOpenTopic={() => {}}
				onTeach={() => {}}
				onExpand={() => {}}
			/>
		)
	}
	return (
		<View style={s.fill}>
			<PixelBackdrop scene="welcome" />
			<ScrollView
				style={s.fill}
				contentContainerStyle={{
					paddingTop: insets.top + 28,
					paddingBottom: insets.bottom + 28,
					paddingHorizontal: 16,
					gap: 28
				}}
			>
				{SHOW_SAVED_BOARDS ? (
					<>
						<Text variant="eyebrow" tone="inverse">
							Saved looks
						</Text>
						<View style={s.block}>
							<Text variant="eyebrow" tone="inverse">
								Green
							</Text>
							<ClassroomBoard ideas={ideas} now={now} ground={GREEN} />
						</View>
						<View style={s.block}>
							<Text variant="eyebrow" tone="inverse">
								Dark grey
							</Text>
							<ClassroomBoard ideas={ideas} now={now} ground={SLATE} />
						</View>
					</>
				) : null}
			</ScrollView>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	block: { gap: 10 }
})
