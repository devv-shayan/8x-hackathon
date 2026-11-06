import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { ArrowRight } from 'lucide-react-native'
import { StudentFace } from '@/components/memory/StudentFace'
import { PressableScale } from '@/components/motion/PressableScale'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { STARTER_VIDEO } from '@/lib/firstRun'
import { youtubeThumbnailUrl } from '@/lib/youtubeThumb'

const FACE = 52
const STEPS = [
	['Paste a video', 'Any YouTube video you watched and want to keep.'],
	['Explain it to the class', 'Out loud. Maya and Omar ask when they get lost.'],
	['They come back to you', 'Days later they forget an idea and ask you again.']
] as const

/** Maya, in place of Home's question, asking for the first video. */
export function MayaAsks() {
	const { colors: c, radii } = useTheme()
	return (
		<View
			style={s.ask}
			accessible
			accessibilityRole="header"
			accessibilityLabel="Maya: What should we learn first? Teach us a video you liked."
		>
			<StudentFace student="Maya" size={FACE} radius={radii.lg} />
			<View style={[s.bubble, { backgroundColor: c.surface, borderRadius: radii['2xl'] }]}>
				<Text variant="eyebrow" tone="secondary">
					Maya
				</Text>
				<Text variant="h3">What should we learn first? Teach us a video you liked.</Text>
			</View>
		</View>
	)
}

/** For a person with no link ready: one short video, read on a tap. */
export function StarterVideo({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
	const { colors: c, radii } = useTheme()
	const { title, by, minutes, youtubeId } = STARTER_VIDEO
	return (
		<PressableScale
			scaleTo="card"
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={`No link? Teach ${title}, a ${minutes} minute video by ${by}.`}
			style={[s.starter, { backgroundColor: c.surface, borderRadius: radii['2xl'] }]}
		>
			<Image
				source={{ uri: youtubeThumbnailUrl(youtubeId) }}
				style={[s.thumb, { borderRadius: radii.md }]}
				contentFit="cover"
				accessibilityIgnoresInvertColors
			/>
			<View style={s.flex}>
				<Text variant="eyebrow" tone="secondary">
					No link? Try this one
				</Text>
				<Text variant="label" numberOfLines={1}>
					{title}
				</Text>
				<Text variant="caption" tone="secondary">{`${minutes} min · ${by}`}</Text>
			</View>
			<View style={[s.go, { backgroundColor: c.textPrimary }]}>
				<ArrowRight size={18} color={c.brandFill} strokeWidth={2.4} />
			</View>
		</PressableScale>
	)
}

/** What happens after the link, said once before the first class. */
export function HowAClassWorks() {
	const { colors: c, radii } = useTheme()
	return (
		<View style={s.steps}>
			<MonoLabel>How a class works</MonoLabel>
			{STEPS.map(([title, line], i) => (
				<View
					key={title}
					style={s.step}
					accessible
					accessibilityLabel={`${i + 1}. ${title}. ${line}`}
				>
					<View
						style={[
							s.number,
							{ backgroundColor: i === 0 ? c.brandFill : c.well, borderRadius: radii.md }
						]}
					>
						<Text variant="label">{String(i + 1)}</Text>
					</View>
					<View style={s.flex}>
						<Text variant="label">{title}</Text>
						<Text variant="caption" tone="secondary">
							{line}
						</Text>
					</View>
				</View>
			))}
		</View>
	)
}

const s = StyleSheet.create({
	flex: { flex: 1 },
	ask: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 16 },
	bubble: { flex: 1, padding: 14, gap: 4 },
	starter: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginTop: 12 },
	thumb: { width: 72, height: 44 },
	go: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
	steps: { gap: 12 },
	step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
	number: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }
})
