import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isPastedTopic, MIN_EXPLANATION_LENGTH } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { youtubeThumbnailUrl } from '@/lib/youtubeThumb'
import { leaveClass } from './shared'

/**
 * Explain the video in your own words, on the Explain section's green waves. The video's
 * ideas stay hidden until the class ends; "I'm done" starts the class.
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
	onStart: (explanation: string) => void
	pending: boolean
	error: string | null
}) {
	const { colors: c, radii, elevation } = useTheme()
	const insets = useSafeAreaInsets()
	const [explanation, setExplanation] = useState('')
	const ready = explanation.trim().length >= MIN_EXPLANATION_LENGTH
	const thumb = youtubeId && !isPastedTopic(youtubeId) ? youtubeThumbnailUrl(youtubeId) : null

	useEffect(() => {
		track('explain_viewed', { topic_id: topicId })
	}, [topicId])

	return (
		<View style={s.fill}>
			<PixelBackdrop scene="explain" />
			<View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
				<PressableScale
					onPress={leaveClass}
					accessibilityRole="button"
					style={[s.pill, { backgroundColor: c.surface }, elevation.soft]}
				>
					<Text variant="label" style={s.pillText}>
						Cancel
					</Text>
				</PressableScale>
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
					<Text variant="question" style={s.question} accessibilityRole="header">
						Teach it like they never saw it.
					</Text>
					<View style={s.field}>
						<TextInputField
							accessibilityLabel="Your explanation"
							placeholder="What’s the main idea, and how does it work?"
							multiline
							numberOfLines={6}
							value={explanation}
							onChangeText={setExplanation}
							error={error}
							hint={
								!ready && explanation.trim().length > 0
									? `A few more words: at least ${MIN_EXPLANATION_LENGTH} characters.`
									: undefined
							}
						/>
					</View>
					<Button
						label={pending ? 'Students are thinking…' : 'I’m done, start the class'}
						variant="ink"
						size="lg"
						fullWidth
						loading={pending}
						disabled={!ready || pending}
						onPress={() => onStart(explanation)}
						style={s.cta}
					/>
				</SheetCard>
			</KeyboardAvoidingView>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	top: { position: 'absolute', left: 16, right: 16, zIndex: 2, gap: 12, alignItems: 'flex-start' },
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
	field: { marginTop: 14 },
	cta: { marginTop: 14 }
})
