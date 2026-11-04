import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import type { MemoryIdea } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { chalkOpacity, dueIdeaId } from '@/lib/chalk'
import { useReducedMotion } from '@/lib/motion'

function ChalkTitle({ opacity, children }: { opacity: number; children: ReactNode }) {
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

function IdeaLine({
	idea,
	practice,
	now,
	onPractice
}: {
	idea: MemoryIdea
	practice: boolean
	now: Date
	onPractice?: (gapId: string) => void
}) {
	const { colors: c } = useTheme()
	const opacity = chalkOpacity(idea, now)
	const copy = (
		<View style={[s.line, { borderTopColor: c.borderHairline }]}>
			<ChalkTitle opacity={opacity}>
				<Text variant="h3">{idea.concept_title}</Text>
				<Text variant="caption" tone="secondary">
					{idea.topic_title}
				</Text>
			</ChalkTitle>
		</View>
	)
	if (!practice) return copy
	return (
		<PressableScale
			onPress={() => onPractice?.(idea.gap_id)}
			accessibilityRole="button"
			accessibilityLabel={`Maya is forgetting ${idea.concept_title}. Practice it.`}
			scaleTo="card"
		>
			{copy}
			<MonoLabel>Forgetting</MonoLabel>
		</PressableScale>
	)
}

/** The chalk lines. The screen that fetches and the temporary preview both use this. */
export function MemoryBoard({
	ideas,
	now,
	onPractice
}: {
	ideas: readonly MemoryIdea[]
	now: Date
	onPractice?: (gapId: string) => void
}) {
	const practiceId = dueIdeaId(ideas, now)
	if (ideas.length === 0) {
		return <Text variant="body">Teach a class, and what Maya might forget will show up here.</Text>
	}
	return (
		<>
			{ideas.map((idea) => (
				<IdeaLine
					key={idea.gap_id}
					idea={idea}
					practice={idea.gap_id === practiceId}
					now={now}
					onPractice={onPractice}
				/>
			))}
		</>
	)
}

const s = StyleSheet.create({
	line: { gap: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth }
})
