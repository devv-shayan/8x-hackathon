import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { ArrowRight } from 'lucide-react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { StudentFace } from './StudentFace'

const FACE = 40
const FACE_OVERLAP = 14

/** Home's way into Class memory, a card like the warm-up's, so it reads as something to tap. */
export function ClassMemoryLink() {
	const { colors: c, radii } = useTheme()
	return (
		<PressableScale
			scaleTo="card"
			onPress={() => {
				track('memory_opened', { source: 'home' })
				router.push('/memory')
			}}
			accessibilityRole="button"
			accessibilityLabel="Class memory. See what Maya and Omar might forget."
			style={[s.card, { backgroundColor: c.well, borderRadius: radii['3xl'] }]}
		>
			<View style={s.faces}>
				<StudentFace student="Maya" size={FACE} radius={radii.lg} />
				<StudentFace
					student="Omar"
					size={FACE}
					radius={radii.lg}
					style={[s.second, { borderColor: c.well }]}
				/>
			</View>
			<View style={s.copy}>
				<Text variant="h3">Class memory</Text>
				<Text variant="caption" tone="secondary" numberOfLines={2}>
					See what Maya and Omar might forget
				</Text>
			</View>
			<View style={[s.go, { backgroundColor: c.textPrimary }]}>
				<ArrowRight size={18} color={c.brandFill} strokeWidth={2.4} />
			</View>
		</PressableScale>
	)
}

const s = StyleSheet.create({
	card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14 },
	faces: { flexDirection: 'row' },
	second: { marginLeft: -FACE_OVERLAP, borderWidth: 2 },
	copy: { flex: 1, gap: 2 },
	go: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }
})
