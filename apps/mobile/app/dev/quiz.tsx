import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { QuizQuestion } from '@app/contract'
import { QuizPlayer } from '@/components/quiz/QuizPlayer'
import { ShimmerField } from '@/components/quiz/ShimmerField'
import { useTheme } from '@/contexts/ThemeContext'

const LINE = 'Leaves use sunlight to turn water and carbon dioxide into sugar.'
const SHARED = {
	topic_title: 'How plants make food',
	quote: LINE,
	start_seconds: 192
}
const FLASH_MS = 650

/** One of each format and then some, so the deck can be looked at without an AI call. */
const SAMPLE: QuizQuestion[] = [
	{
		id: '0',
		type: 'fill_blank',
		before: 'Leaves use sunlight to turn water and carbon dioxide into ',
		after: '.',
		concept_title: 'Photosynthesis',
		options: ['soil', 'sugar', 'oxygen', 'minerals'],
		right_index: 1,
		...SHARED
	},
	{
		id: '1',
		type: 'multiple_choice',
		question: 'Where does a plant get its food?',
		concept_title: 'Food',
		options: [
			'It takes it from the soil',
			'It makes sugar in its leaves',
			'It absorbs it from rain',
			'It collects it from insects'
		],
		right_index: 1,
		...SHARED
	},
	{
		id: '2',
		type: 'true_false',
		statement: 'The soil gives plants their food.',
		concept_title: 'Soil',
		options: ['True', 'False'],
		right_index: 1,
		...SHARED
	},
	{
		id: '3',
		type: 'true_false',
		statement: 'Plants use sunlight to make sugar.',
		concept_title: 'Sunlight',
		options: ['True', 'False'],
		right_index: 0,
		...SHARED
	},
	{
		id: '4',
		type: 'fill_blank',
		before: 'Leaves use ',
		after: ' to turn water and carbon dioxide into sugar.',
		concept_title: 'Sunlight',
		options: ['sunlight', 'minerals', 'nitrogen', 'rain'],
		right_index: 0,
		...SHARED
	}
]

const SAMPLE_WORDS = [
	'Photosynthesis',
	'Chlorophyll',
	'stomata',
	'glucose',
	'sunlight',
	'Chloroplast'
]

/** The quiz with sample questions, for a look before sign-in. Release builds redirect home. */
export default function QuizPreviewScreen() {
	const { colors: c } = useTheme()
	const insets = useSafeAreaInsets()
	const [flash, setFlash] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	if (!__DEV__) return <Redirect href="/" />
	return (
		<View style={[s.fill, { backgroundColor: c.hero }]}>
			<ShimmerField words={SAMPLE_WORDS} flash={flash} />
			<View style={[s.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 14 }]}>
				<QuizPlayer
					questions={SAMPLE}
					previous={{ best: 3, lastScore: 3, lastTotal: 5, playedDay: 'yesterday' }}
					onFinish={() => undefined}
					onDone={() => router.back()}
					onRightAnswer={() => {
						setFlash(true)
						if (timer.current) clearTimeout(timer.current)
						timer.current = setTimeout(() => setFlash(false), FLASH_MS)
					}}
				/>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	content: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 16 }
})
