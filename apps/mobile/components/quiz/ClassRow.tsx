import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Springs, Timings } from '@/lib/motion'

const HOP = -10
const SLUMP = 4
const PORTRAIT = 44

export type StudentMood = 'waiting' | 'cheering' | 'slumped'

/** A student's portrait. Stays mounted through the quiz: each one is a whole pixel scene. */
export function StudentFace({
	name,
	mood,
	moodKey,
	size = PORTRAIT
}: {
	name: 'Maya' | 'Omar'
	mood: StudentMood
	/** Changes with each question, so the same mood twice still moves. */
	moodKey: number
	size?: number
}) {
	const { radii } = useTheme()
	const y = useSharedValue(0)
	useEffect(() => {
		if (mood === 'cheering') {
			y.value = withSequence(withTiming(HOP, Timings.fast), withSpring(0, Springs.settle))
		} else {
			y.value = withSpring(mood === 'slumped' ? SLUMP : 0, Springs.settle)
		}
	}, [mood, moodKey, y])
	const motion = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
	return (
		<Animated.View
			style={[{ width: size, height: size, borderRadius: radii.lg }, s.portrait, motion]}
		>
			<PixelBackdrop scene={name === 'Omar' ? 'omarPortrait' : 'mayaPortrait'} />
		</Animated.View>
	)
}

function Score({ label, value }: { label: string; value: number }) {
	const { colors: c } = useTheme()
	return (
		<View style={s.score}>
			<Text variant="caption" style={{ color: c.heroText }}>
				{label}
			</Text>
			<Text variant="h3" tabular style={{ color: c.brandFill }}>
				{String(value)}
			</Text>
		</View>
	)
}

/** You against the class: everyone's running score, with Maya and Omar reacting. */
export function ClassRow({
	you,
	maya,
	omar,
	mayaMood,
	omarMood,
	moodKey
}: {
	you: number
	maya: number
	omar: number
	mayaMood: StudentMood
	omarMood: StudentMood
	moodKey: number
}) {
	return (
		<View style={s.row}>
			<Score label="You" value={you} />
			<View style={s.student}>
				<StudentFace name="Maya" mood={mayaMood} moodKey={moodKey} />
				<Score label="Maya" value={maya} />
			</View>
			<View style={s.student}>
				<StudentFace name="Omar" mood={omarMood} moodKey={moodKey} />
				<Score label="Omar" value={omar} />
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	student: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	score: { alignItems: 'center', minWidth: 36 },
	portrait: { overflow: 'hidden' }
})
