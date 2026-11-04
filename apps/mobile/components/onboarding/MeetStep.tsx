import { StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { SceneName } from '@app/pixel'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { Button } from '@/components/ui/Button'
import { Highlight } from '@/components/ui/Highlight'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { STUDENT_LINES } from '@/lib/studentLines'

const STUDENTS: { name: string; scene: SceneName; says: string; who: string }[] = [
	{
		name: 'Maya',
		scene: 'mayaCard',
		says: STUDENT_LINES.Maya,
		who: 'Never saw the video. Stops you when it doesn’t add up.'
	},
	{
		name: 'Omar',
		scene: 'omarCard',
		says: STUDENT_LINES.Omar,
		who: 'Watched it twice. Catches what you left out.'
	}
]

/**
 * Onboarding's first step: the two students, each on their own colour, as the website's
 * "Meet the students" cards, on the black band's tunnel.
 */
export function MeetStep({ onContinue }: { onContinue: () => void }) {
	const { colors: c, radii } = useTheme()
	const insets = useSafeAreaInsets()
	return (
		<View style={[s.fill, { backgroundColor: c.hero }]}>
			<StatusBar style="light" />
			<PixelBackdrop scene="meet" />
			<View style={[s.cards, { paddingTop: insets.top + 16 }]}>
				{STUDENTS.map((student) => (
					<View
						key={student.name}
						style={[s.card, { borderRadius: radii['3xl'] }]}
						accessibilityLabel={`${student.name}: ${student.says}`}
					>
						<PixelBackdrop scene={student.scene} raised={{ Omar: 1 }} />
						<View style={[s.quote, { backgroundColor: c.surface, borderRadius: radii.xl }]}>
							<Text variant="caption" style={s.quoteText}>
								{student.says}
							</Text>
						</View>
					</View>
				))}
			</View>
			<SheetCard>
				<MonoLabel>Your class</MonoLabel>
				<Text variant="question" style={s.title} accessibilityRole="header">
					Watch a video. Then <Highlight>teach it</Highlight> to these two.
				</Text>
				<View style={s.who}>
					{STUDENTS.map((student) => (
						<View key={student.name} style={s.person}>
							<Text variant="h3">{student.name}</Text>
							<Text variant="caption" tone="secondary">
								{student.who}
							</Text>
						</View>
					))}
				</View>
				<Button
					label="Continue"
					variant="ink"
					size="lg"
					fullWidth
					onPress={onContinue}
					style={s.cta}
				/>
			</SheetCard>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	cards: { flex: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
	card: { flex: 1, overflow: 'hidden' },
	quote: { margin: 10, padding: 10 },
	quoteText: { fontWeight: '600' },
	title: { marginTop: 14 },
	who: { flexDirection: 'row', gap: 16, marginTop: 16 },
	person: { flex: 1, gap: 4 },
	cta: { marginTop: 20 }
})
