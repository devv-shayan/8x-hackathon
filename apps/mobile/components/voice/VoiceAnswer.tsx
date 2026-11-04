import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Keyboard, Mic, MicOff, RotateCcw } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { RecordingStrip } from './RecordingStrip'
import { useTheme } from '@/contexts/ThemeContext'
import { useVoiceAnswer, type VoiceSurface } from '@/hooks/useVoiceAnswer'
import { track } from '@/lib/analytics'
import { canRecordVoice } from '@/lib/voice/recorder'

export type AnswerMeta = { method: 'voice' | 'typed'; edited?: boolean }

/**
 * Answering a student: "Hold to answer" where this build can record, typing everywhere else
 * and one tap away ("Type instead"). A held answer comes back as text to check and fix before
 * it's sent (the canvas "Chalkback voice class", boards 2–5). Remount it per question.
 */
export function VoiceAnswer({
	surface,
	student,
	question,
	typed,
	onTypedChange,
	onSend,
	sending,
	error,
	sendingLabel = 'Waiting for the class…',
	maxLength,
	secondary
}: {
	surface: Exclude<VoiceSurface, 'explain'>
	student: string
	/** What's being answered: sent with the recording so its words are spelled right. */
	question: string
	typed: string
	onTypedChange: (text: string) => void
	onSend: (text: string, meta: AnswerMeta) => void
	sending: boolean
	error: string | null
	/** What the send button says while the answer is judged. */
	sendingLabel?: string
	maxLength?: number
	/** The quiet way out: "Skip this one", or "I don't remember". */
	secondary: { label: string; onPress: () => void; disabled?: boolean }
}) {
	const { colors: c } = useTheme()
	const voice = useVoiceAnswer(surface, question)
	const [typing, setTyping] = useState(!canRecordVoice)
	// Letting go inside sends; sliding off first cancels (the press ends without a press).
	const released = useRef(false)
	const micOff = voice.failure?.reason === 'denied' || voice.failure?.reason === 'unsupported'
	const showTyped = typing || micOff

	function typeInstead() {
		track('voice_typed_instead', { surface })
		voice.reset()
		setTyping(true)
	}

	const quietRow = (lead: { label: string; icon: typeof Mic; onPress: () => void } | null) => (
		<View style={s.row}>
			{lead ? (
				<Button
					label={lead.label}
					variant="ghost"
					icon={(color) => <lead.icon size={18} color={color} />}
					disabled={sending}
					onPress={lead.onPress}
				/>
			) : null}
			<Button
				label={secondary.label}
				variant="ghost"
				disabled={sending || secondary.disabled}
				onPress={secondary.onPress}
			/>
		</View>
	)

	if (showTyped) {
		return (
			<>
				{micOff ? (
					<View
						style={[s.notice, { backgroundColor: c.surface2 }]}
						accessibilityLiveRegion="polite"
					>
						<MicOff size={18} color={c.textPrimary} />
						<Text variant="bodySm" style={s.noticeText}>
							{voice.failure?.message}
						</Text>
					</View>
				) : null}
				<View style={s.field}>
					<TextInputField
						accessibilityLabel={`Answer ${student}`}
						placeholder={`Answer ${student} in your own words`}
						multiline
						value={typed}
						onChangeText={onTypedChange}
						maxLength={maxLength}
						error={error}
					/>
				</View>
				<Button
					label={sending ? sendingLabel : 'Answer'}
					variant="ink"
					size="lg"
					fullWidth
					loading={sending}
					disabled={!typed.trim() || sending}
					onPress={() => onSend(typed.trim(), { method: 'typed' })}
					style={s.cta}
				/>
				{quietRow(
					canRecordVoice && voice.failure?.reason !== 'unsupported'
						? {
								label: 'Answer out loud',
								icon: Mic,
								onPress: () => {
									voice.reset()
									setTyping(false)
								}
							}
						: null
				)}
			</>
		)
	}

	if (voice.phase === 'review') {
		return (
			<>
				<View style={s.field}>
					<MonoLabel>What you said · tap to fix a word</MonoLabel>
					<View style={s.reviewField}>
						<TextInputField
							accessibilityLabel={`What you said to ${student}`}
							multiline
							value={voice.draft}
							onChangeText={voice.setDraft}
							maxLength={maxLength}
							error={error}
						/>
					</View>
				</View>
				<Button
					label={sending ? sendingLabel : `Send to ${student}`}
					variant="ink"
					size="lg"
					fullWidth
					loading={sending}
					disabled={!voice.draft.trim() || sending}
					onPress={() => onSend(voice.draft.trim(), { method: 'voice', edited: voice.edited })}
					style={s.cta}
				/>
				{quietRow({ label: 'Record again', icon: RotateCcw, onPress: voice.reset })}
			</>
		)
	}

	if (voice.phase === 'failed') {
		return (
			<>
				<Text variant="bodySm" tone="secondary" style={s.status} accessibilityLiveRegion="polite">
					{voice.failure?.message}
				</Text>
				<Button
					label="Try again"
					variant="ink"
					size="lg"
					fullWidth
					onPress={voice.retry}
					style={s.cta}
				/>
				{quietRow({ label: 'Type instead', icon: Keyboard, onPress: typeInstead })}
			</>
		)
	}

	const recording = voice.phase === 'recording'
	const transcribing = voice.phase === 'transcribing'
	return (
		<>
			{recording ? (
				<View style={s.stripRow}>
					<RecordingStrip
						seconds={voice.seconds}
						levels={voice.levels}
						bars={voice.waveBars}
						scene={surface}
					/>
				</View>
			) : voice.hint ? (
				<Text variant="caption" tone="secondary" style={s.status} accessibilityLiveRegion="polite">
					{voice.hint}
				</Text>
			) : null}
			{/* One element for idle and recording, so the hold carries on as the button changes. */}
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={recording ? 'Let go to send' : `Hold to answer ${student}`}
				accessibilityHint="Hold down while you talk, then let go to check what you said."
				accessibilityState={{ busy: transcribing, disabled: transcribing || sending }}
				disabled={transcribing || sending}
				onPressIn={() => {
					released.current = false
					void voice.start()
				}}
				onPress={() => {
					released.current = true
					void voice.finish()
				}}
				onPressOut={() => {
					// onPress follows onPressOut when the finger lets go on the button; without it,
					// the finger slid off first.
					setTimeout(() => {
						if (!released.current) voice.cancel()
					}, 0)
				}}
				style={[
					s.hold,
					recording
						? { backgroundColor: c.brandFill, borderColor: c.textPrimary, borderWidth: 1.5 }
						: { backgroundColor: c.textPrimary, opacity: transcribing ? 0.7 : 1 }
				]}
			>
				<Mic size={20} color={recording ? c.textPrimary : c.brandFill} />
				<Text variant="label" style={{ color: recording ? c.textPrimary : c.brandFill }}>
					{transcribing ? 'Writing it down…' : recording ? 'Let go to send' : 'Hold to answer'}
				</Text>
			</Pressable>
			{recording ? (
				<Text variant="caption" tone="secondary" style={s.status}>
					Slide off the button to cancel
				</Text>
			) : (
				quietRow({ label: 'Type instead', icon: Keyboard, onPress: typeInstead })
			)}
		</>
	)
}

const s = StyleSheet.create({
	field: { marginTop: 14 },
	reviewField: { marginTop: 8 },
	cta: { marginTop: 14 },
	row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginTop: 4 },
	notice: {
		marginTop: 14,
		borderRadius: 16,
		padding: 12,
		flexDirection: 'row',
		gap: 10,
		alignItems: 'flex-start'
	},
	noticeText: { flex: 1 },
	status: { marginTop: 14, textAlign: 'center' },
	stripRow: { marginTop: 18 },
	hold: {
		marginTop: 14,
		height: 56,
		borderRadius: 28,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 10,
		userSelect: 'none'
	}
})
