import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Mic, MicOff, Square } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isPastedTopic, MIN_EXPLANATION_LENGTH } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { RecordingStrip } from '@/components/voice/RecordingStrip'
import type { AnswerMeta } from '@/components/voice/VoiceAnswer'
import { useTheme } from '@/contexts/ThemeContext'
import { useLiveTranscript } from '@/hooks/useLiveTranscript'
import { track } from '@/lib/analytics'
import { canRecordVoice } from '@/lib/voice/recorder'
import { youtubeThumbnailUrl } from '@/lib/youtubeThumb'
import { leaveClass } from './shared'

/**
 * Explain the video in your own words, on the Explain section's green waves. Where this build
 * can record, it's said out loud and written down as it's said (the canvas board "Explain out
 * loud"); typing is one tap away, and the only way where it can't. The video's ideas stay
 * hidden until the class ends; "I'm done" starts the class.
 */
export function ExplainStep({
	topicId,
	title,
	youtubeId,
	ideaCount,
	onStart,
	pending,
	error
}: {
	topicId: string
	title: string | null
	youtubeId: string | null
	/** How many ideas the video has, when known: the class checks each one. */
	ideaCount: number | null
	onStart: (explanation: string, meta: AnswerMeta) => void
	pending: boolean
	error: string | null
}) {
	const { colors: c, radii, elevation } = useTheme()
	const insets = useSafeAreaInsets()
	const live = useLiveTranscript(title)
	const [typing, setTyping] = useState(!canRecordVoice)
	const [typed, setTyped] = useState('')
	const micOff = live.failure?.reason === 'denied' || live.failure?.reason === 'unsupported'
	const showTyped = typing || micOff
	const explanation = showTyped ? typed : live.text
	const ready = explanation.trim().length >= MIN_EXPLANATION_LENGTH
	const recording = live.phase === 'recording'
	const finishing = live.phase === 'finishing'
	const thumb = youtubeId && !isPastedTopic(youtubeId) ? youtubeThumbnailUrl(youtubeId) : null

	useEffect(() => {
		track('explain_viewed', { topic_id: topicId })
	}, [topicId])

	function switchMode() {
		if (showTyped) {
			live.setText(typed)
			setTyping(false)
			return
		}
		track('voice_typed_instead', { surface: 'explain' })
		void live.stop().then((said) => {
			setTyped(said)
			setTyping(true)
		})
	}

	async function done() {
		if (showTyped) {
			onStart(typed.trim(), { method: 'typed' })
			return
		}
		const said = recording ? await live.stop() : live.text
		if (said.trim().length >= MIN_EXPLANATION_LENGTH) {
			onStart(said.trim(), { method: 'voice', edited: live.edited })
		}
	}

	const busy = pending || finishing
	return (
		<View style={s.fill}>
			<PixelBackdrop scene="explain" />
			<View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
				<View style={s.bar} pointerEvents="box-none">
					<PressableScale
						onPress={leaveClass}
						accessibilityRole="button"
						style={[s.pill, { backgroundColor: c.surface }, elevation.soft]}
					>
						<Text variant="label" style={s.pillText}>
							Cancel
						</Text>
					</PressableScale>
					{canRecordVoice && !micOff ? (
						<PressableScale
							onPress={switchMode}
							disabled={busy}
							accessibilityRole="button"
							style={[s.pill, { backgroundColor: c.surface }, elevation.soft]}
						>
							<Text variant="label" style={s.pillText}>
								{showTyped ? 'Explain out loud' : 'Type instead'}
							</Text>
						</PressableScale>
					) : null}
				</View>
				{title ? (
					<View
						style={[
							s.video,
							{ backgroundColor: c.surface, borderRadius: radii['2xl'] },
							elevation.soft
						]}
					>
						{thumb ? (
							<Image
								source={{ uri: thumb }}
								style={[s.thumb, { borderRadius: radii.lg }]}
								contentFit="cover"
								accessibilityIgnoresInvertColors
							/>
						) : null}
						<View style={s.videoCopy}>
							<Text variant="label" numberOfLines={2} style={s.videoTitle}>
								{title}
							</Text>
							<MonoLabel>
								{ideaCount
									? `${ideaCount} ideas, hidden till the end`
									: 'Ideas hidden till the end'}
							</MonoLabel>
						</View>
					</View>
				) : null}
			</View>
			<View style={s.fill} pointerEvents="none" />
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<SheetCard>
					<MonoLabel>Explain it in your own words</MonoLabel>
					{showTyped ? (
						<>
							{micOff ? (
								<View
									style={[s.notice, { backgroundColor: c.surface2 }]}
									accessibilityLiveRegion="polite"
								>
									<MicOff size={18} color={c.textPrimary} />
									<Text variant="bodySm" style={s.noticeText}>
										{live.failure?.message}
									</Text>
								</View>
							) : (
								<Text variant="question" style={s.question} accessibilityRole="header">
									Teach it like they never saw it.
								</Text>
							)}
							<View style={s.field}>
								<TextInputField
									accessibilityLabel="Your explanation"
									placeholder="What’s the main idea, and how does it work?"
									multiline
									numberOfLines={6}
									value={typed}
									onChangeText={setTyped}
									error={error}
									hint={
										!ready && typed.trim().length > 0
											? `A few more words: at least ${MIN_EXPLANATION_LENGTH} characters.`
											: undefined
									}
								/>
							</View>
						</>
					) : recording || finishing ? (
						<>
							<Text variant="h2" style={s.words} accessibilityLiveRegion="polite">
								{live.text ? (
									<>
										<Text variant="h2" tone="tertiary">
											{live.latest ? live.text.slice(0, -live.latest.length) : live.text}
										</Text>
										{live.latest}
									</>
								) : (
									<Text variant="h2" tone="tertiary">
										{recording
											? live.streams
												? 'Listening… your words show up here as you talk.'
												: 'Listening… your words show up here when you stop.'
											: 'Writing down what you said…'}
									</Text>
								)}
							</Text>
							<View style={s.recRow}>
								<RecordingStrip
									seconds={live.seconds}
									levels={live.levels}
									bars={live.waveBars}
									scene="explain"
									end={
										<Pressable
											onPress={() => void live.stop()}
											disabled={!recording}
											accessibilityRole="button"
											accessibilityLabel="Stop recording"
											style={[s.stop, { backgroundColor: c.brandFill, borderColor: c.textPrimary }]}
										>
											<Square size={16} color={c.textPrimary} fill={c.textPrimary} />
										</Pressable>
									}
								/>
							</View>
							{finishing ? (
								<Text variant="caption" tone="secondary" style={s.status}>
									Writing down the end of what you said…
								</Text>
							) : null}
						</>
					) : live.text ? (
						<>
							<View style={s.field}>
								<TextInputField
									accessibilityLabel="Your explanation"
									multiline
									numberOfLines={6}
									value={live.text}
									onChangeText={live.setText}
									error={error}
									hint={
										ready
											? 'Tap to fix a word.'
											: `A few more words: at least ${MIN_EXPLANATION_LENGTH} characters.`
									}
								/>
							</View>
							{live.phase === 'failed' ? (
								<Text variant="bodySm" tone="secondary" style={s.status}>
									{live.failure?.message}
								</Text>
							) : null}
							<View style={s.row}>
								<Button
									label={live.phase === 'failed' ? 'Try again' : 'Keep talking'}
									variant="ghost"
									icon={(color) => <Mic size={18} color={color} />}
									disabled={busy}
									onPress={() => void (live.phase === 'failed' ? live.retry() : live.start())}
								/>
							</View>
						</>
					) : (
						<>
							<Text variant="question" style={s.question} accessibilityRole="header">
								Teach it like they never saw it.
							</Text>
							<Text variant="lead" tone="secondary" style={s.lead}>
								{live.streams
									? 'Talk it through out loud. Your words show up as you go; tap stop when you’re done.'
									: 'Talk it through out loud, then tap stop. Your words show up when you do.'}
							</Text>
							<Button
								label="Start explaining"
								variant="ink"
								size="lg"
								fullWidth
								icon={(color) => <Mic size={20} color={color} />}
								onPress={() => void live.start()}
								style={s.cta}
							/>
						</>
					)}
					{showTyped || recording || finishing || live.text ? (
						<Button
							label={pending ? 'Students are thinking…' : 'I’m done, start the class'}
							variant="ink"
							size="lg"
							fullWidth
							loading={busy}
							disabled={busy || (!recording && !ready)}
							onPress={() => void done()}
							style={s.cta}
						/>
					) : null}
					{!showTyped && error ? (
						<Text variant="caption" style={[s.status, { color: c.errorText }]}>
							{error}
						</Text>
					) : null}
				</SheetCard>
			</KeyboardAvoidingView>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	top: { position: 'absolute', left: 16, right: 16, zIndex: 2, gap: 12 },
	bar: { flexDirection: 'row', justifyContent: 'space-between' },
	pill: { height: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center' },
	pillText: { fontSize: 15 },
	video: {
		alignSelf: 'stretch',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		padding: 8,
		paddingRight: 14
	},
	thumb: { width: 88, height: 50, backgroundColor: 'transparent' },
	videoCopy: { flex: 1, gap: 4 },
	videoTitle: { fontSize: 15, lineHeight: 20 },
	question: { marginTop: 14 },
	lead: { marginTop: 8 },
	words: { marginTop: 14 },
	recRow: { marginTop: 20 },
	stop: {
		width: 56,
		height: 56,
		borderRadius: 28,
		borderWidth: 1.5,
		alignItems: 'center',
		justifyContent: 'center'
	},
	notice: {
		marginTop: 14,
		borderRadius: 16,
		padding: 12,
		flexDirection: 'row',
		gap: 10,
		alignItems: 'flex-start'
	},
	noticeText: { flex: 1 },
	field: { marginTop: 14 },
	row: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
	status: { marginTop: 12, textAlign: 'center' },
	cta: { marginTop: 14 }
})
