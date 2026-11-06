import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react-native'
import { topicsQueryKey } from '@/components/RecentTopics'
import { PressableScale } from '@/components/motion/PressableScale'
import { Highlight } from '@/components/ui/Highlight'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'
import { loadQuizRecord, playedToday, type QuizRecord } from '@/lib/quiz'

/**
 * Home's way into the daily quiz, with the score to beat. Shows only once they've taught a
 * video and haven't played today.
 */
export function DailyQuizCard() {
	const { colors: c, radii } = useTheme()
	const topics = useQuery({
		queryKey: topicsQueryKey,
		queryFn: () => api('listTopics').then((r) => r.topics)
	})
	/** Undefined until it's read. Read again on every return to Home, so playing hides it. */
	const [record, setRecord] = useState<QuizRecord | null | undefined>(undefined)
	const offered = useRef(false)

	useFocusEffect(
		useCallback(() => {
			void loadQuizRecord().then(setRecord)
		}, [])
	)

	const hasTaught = (topics.data?.length ?? 0) > 0
	const show = hasTaught && record !== undefined && !playedToday(record, new Date())

	useEffect(() => {
		if (!show || offered.current) return
		offered.current = true
		track('quiz_offered')
	}, [show])

	if (!show) return null

	const best = record?.best ?? 0
	const line = record
		? `Your best: ${best} of ${record.lastTotal}. Can you beat it?`
		: 'A minute on what you’ve taught. Set a score to beat.'

	return (
		<PressableScale
			scaleTo="card"
			onPress={() => {
				track('quiz_opened', { source: 'home' })
				router.push('/quiz')
			}}
			accessibilityLabel={`Daily quiz. ${line}`}
			style={[s.card, { backgroundColor: c.hero, borderRadius: radii['3xl'] }]}
		>
			<View style={s.deck} aria-hidden>
				<View
					style={[
						s.mini,
						s.miniBack,
						{ backgroundColor: c.heroTextSecondary, borderRadius: radii.md }
					]}
				/>
				<View style={[s.mini, s.miniFront, { backgroundColor: c.surface, borderRadius: radii.md }]}>
					<Text variant="h2" style={{ color: c.onBrand }}>
						?
					</Text>
				</View>
			</View>
			<View style={s.copy}>
				<Text variant="h3" style={{ color: c.heroText }}>
					<Highlight> Daily quiz </Highlight>
				</Text>
				<Text variant="bodySm" style={{ color: c.heroTextSecondary }}>
					{line}
				</Text>
			</View>
			<View style={[s.go, { backgroundColor: c.brandFill }]}>
				<ArrowRight size={18} color={c.onBrand} strokeWidth={2.4} />
			</View>
		</PressableScale>
	)
}

const s = StyleSheet.create({
	card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
	deck: { width: 50, height: 58 },
	mini: { position: 'absolute', width: 42, height: 54 },
	miniBack: { left: 8, top: 2, transform: [{ rotate: '8deg' }] },
	miniFront: {
		left: 0,
		top: 2,
		alignItems: 'center',
		justifyContent: 'center',
		transform: [{ rotate: '-5deg' }]
	},
	copy: { flex: 1, gap: 4, alignItems: 'flex-start' },
	go: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }
})
