import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SCENES, type Raised, type SceneName, type StudentName } from '@app/pixel'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { StudentTargets } from '@/components/pixel/StudentTargets'
import { Button } from '@/components/ui/Button'
import { Highlight } from '@/components/ui/Highlight'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'

const NAMES = Object.keys(SCENES) as SceneName[]

/**
 * Development only: every scene of the redesign behind a sample sheet, to check the pixel
 * backgrounds, the students and their tap areas on the web build and on a phone. Open
 * /dev/backdrops. Release builds redirect home.
 */
export default function BackdropsScreen() {
	const { colors: c, radii } = useTheme()
	const insets = useSafeAreaInsets()
	const [scene, setScene] = useState<SceneName>('classroom')
	const [raised, setRaised] = useState<Raised>({ Omar: 1 })
	const [picked, setPicked] = useState<StudentName | null>(null)
	if (!__DEV__) return <Redirect href="/" />

	const students = SCENES[scene].students
	const toggle = (name: StudentName) =>
		setRaised((r) => ({ ...r, [name]: (r[name] ?? 0) > 0.5 ? 0 : 1 }))

	return (
		<View style={s.fill}>
			<PixelBackdrop scene={scene} raised={raised} />
			<StudentTargets scene={scene} raised={raised} onPick={setPicked} />
			<ScrollView
				horizontal
				style={[s.chips, { top: insets.top + 8 }]}
				contentContainerStyle={s.chipRow}
				showsHorizontalScrollIndicator={false}
			>
				{NAMES.map((name) => (
					<PressableScale
						key={name}
						onPress={() => {
							setScene(name)
							setPicked(null)
						}}
						accessibilityRole="button"
						accessibilityState={{ selected: name === scene }}
						style={[
							s.chip,
							{
								borderRadius: radii.pill,
								backgroundColor: name === scene ? c.textPrimary : c.surface
							}
						]}
					>
						<Text variant="caption" style={{ color: name === scene ? c.brandFill : c.textPrimary }}>
							{name}
						</Text>
					</PressableScale>
				))}
			</ScrollView>
			<View style={s.spacer} pointerEvents="none" />
			<SheetCard>
				<MonoLabel right={`${students.length} students`}>{`Scene · ${scene}`}</MonoLabel>
				<Text variant="question" style={s.title}>
					The video also covers <Highlight>confidence</Highlight>. You skipped it.
				</Text>
				<Text variant="lead" tone="secondary" style={s.lead}>
					{picked ? `You picked ${picked}.` : 'Tap a student with a hand up.'}
				</Text>
				<View style={s.actions}>
					{students.map(({ name }) => (
						<Button
							key={name}
							label={`${name}'s hand`}
							variant="outline"
							size="sm"
							onPress={() => toggle(name)}
						/>
					))}
				</View>
				<Button label="Back" variant="ink" size="lg" fullWidth onPress={() => router.back()} />
			</SheetCard>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	spacer: { flex: 1 },
	chips: { position: 'absolute', left: 0, right: 0, zIndex: 1 },
	chipRow: { gap: 8, paddingHorizontal: 16 },
	chip: { height: 36, paddingHorizontal: 14, justifyContent: 'center' },
	title: { marginTop: 14 },
	lead: { marginTop: 8 },
	actions: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16, minHeight: 40 }
})
