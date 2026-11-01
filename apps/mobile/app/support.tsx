import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	FadeIn,
	ReduceMotion,
	useAnimatedStyle,
	withTiming
} from 'react-native-reanimated'
import { ChevronDown } from 'lucide-react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { ListGroup, Section } from '@/components/ui/List'
import { PageHeader, ScreenTitle } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import { useColors } from '@/contexts/ThemeContext'
import { Durations, Timings, layoutTransition } from '@/lib/motion'

type FaqItem = { id: string; question: string; answer: string }

const FAQ: FaqItem[] = [
	{
		id: 'faq-1',
		question: 'Which videos work?',
		answer:
			'Public YouTube videos with speech. Private, removed or silent videos can’t be read, and the app will tell you.'
	},
	{
		id: 'faq-2',
		question: 'How is my score worked out?',
		answer:
			'Your explanation is compared with the key ideas in the video. Each one counts as correct, missed or wrong, and you see the result when the class ends.'
	},
	{
		id: 'faq-3',
		question: 'What if I can’t answer a student?',
		answer:
			'Tap I’ll be back to see that part of the video, then come back and answer. You can also skip the question.'
	}
]

const answerIn = FadeIn.duration(Durations.base).reduceMotion(ReduceMotion.System)

export default function SupportScreen() {
	const [openId, setOpenId] = useState<string | null>(FAQ[0]?.id ?? null)

	return (
		<Screen header={<PageHeader />} gap={26}>
			<ScreenTitle title="Help & support" subtitle="Answers to the common questions." />

			<Section title="Frequently asked">
				<ListGroup inset={false}>
					{FAQ.map((item) => (
						<FaqRow
							key={item.id}
							item={item}
							open={openId === item.id}
							onToggle={() => setOpenId(openId === item.id ? null : item.id)}
						/>
					))}
				</ListGroup>
			</Section>
		</Screen>
	)
}

function FaqRow({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
	const c = useColors()
	const chevron = useAnimatedStyle(() => ({
		transform: [{ rotate: withTiming(open ? '180deg' : '0deg', Timings.fast) }]
	}))
	return (
		<Animated.View layout={layoutTransition}>
			<PressableScale
				onPress={onToggle}
				scaleTo="card"
				haptic="select"
				accessibilityRole="button"
				accessibilityState={{ expanded: open }}
				style={s.faq}
			>
				<View style={s.faqTop}>
					<Text variant="label" style={s.flex}>
						{item.question}
					</Text>
					<Animated.View style={chevron}>
						<ChevronDown size={18} color={c.textTertiary} strokeWidth={2} />
					</Animated.View>
				</View>
				{open ? (
					<Animated.View entering={answerIn}>
						<Text variant="bodySm" tone="secondary">
							{item.answer}
						</Text>
					</Animated.View>
				) : null}
			</PressableScale>
		</Animated.View>
	)
}

const s = StyleSheet.create({
	flex: { flex: 1 },
	faq: { paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
	faqTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }
})
