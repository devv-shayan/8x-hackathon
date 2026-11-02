import { StyleSheet } from 'react-native'
import { Volume2 } from 'lucide-react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import type { VoiceState } from '@/hooks/useQuestionVoice'

/**
 * Beside "<Student> · …": whether the student is saying their question, and Replay once
 * they've said it. Nothing at all where this build has no voice.
 */
export function QuestionVoice({
	state,
	student,
	onReplay
}: {
	state: VoiceState
	student: string
	onReplay: () => void
}) {
	const { colors: c } = useTheme()
	if (state === 'off') return null
	const label = state === 'loading' ? 'Voice…' : state === 'speaking' ? 'Speaking' : 'Replay'
	return (
		<PressableScale
			onPress={onReplay}
			disabled={state === 'loading'}
			accessibilityRole="button"
			accessibilityLabel={`Hear ${student}’s question again`}
			accessibilityState={{ disabled: state === 'loading' }}
			hitSlop={12}
			style={s.row}
		>
			<Volume2 size={14} color={state === 'loading' ? c.textTertiary : c.textPrimary} />
			<Text variant="eyebrow" tone={state === 'loading' ? 'tertiary' : 'primary'}>
				{label}
			</Text>
		</PressableScale>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 }
})
