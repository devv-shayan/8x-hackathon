import { useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import Animated, {
	FadeIn,
	ReduceMotion,
	useAnimatedStyle,
	withTiming
} from 'react-native-reanimated'
import { BookOpen, ChevronDown, Mail } from 'lucide-react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { ListGroup, ListRow, Section } from '@/components/ui/List'
import { PageHeader, ScreenTitle } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import { useColors } from '@/contexts/ThemeContext'
import { APP_DOCS_URL, APP_SUPPORT_EMAIL } from '@/lib/constants'
import { Durations, Timings, layoutTransition } from '@/lib/motion'

type FaqItem = { id: string; question: string; answer: string }

// 🎨 REPLACE: your app's real questions and answers. This ships in every build,
// release included, exactly as written here.
const FAQ: FaqItem[] = [
	{
		id: 'faq-1',
		question: 'Can I use this template without external services?',
		answer:
			'Yes. Development builds fill the screens with demo data, so the app works as a full demo before wiring real APIs.'
	},
	{
		id: 'faq-2',
		question: 'How do I swap mock data for real APIs?',
		answer:
			'Point the data hooks at your API adapter methods while keeping screen UI intact. Release builds never show demo data.'
	},
	{
		id: 'faq-3',
		question: 'Where should legal copy live?',
		answer:
			'Use the privacy and terms routes as placeholders until your final policy documents are ready.'
	}
]

const answerIn = FadeIn.duration(Durations.base).reduceMotion(ReduceMotion.System)

export default function SupportScreen() {
	const [openId, setOpenId] = useState<string | null>(FAQ[0]?.id ?? null)

	return (
		<Screen header={<PageHeader />} gap={26}>
			<ScreenTitle title="Help & support" subtitle="Questions, problems or ideas: get in touch." />

			<Section title="Contact">
				<ListRow
					icon={Mail}
					tone="brand"
					title="Email us"
					subtitle={APP_SUPPORT_EMAIL}
					onPress={() => Linking.openURL(`mailto:${APP_SUPPORT_EMAIL}`)}
				/>
				<ListRow
					icon={BookOpen}
					tone="brand"
					title="Read the guide"
					subtitle="Answers to the common questions"
					onPress={() => Linking.openURL(APP_DOCS_URL)}
				/>
			</Section>

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
