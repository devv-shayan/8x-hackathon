import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import type { KeyConcept } from '@app/contract'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { track } from '@/lib/analytics'
import { api, errorMessage } from '@/lib/api'
import { haptic } from '@/lib/haptics'

// Reading a long video can take a minute or more, far past the API default.
const READ_VIDEO_TIMEOUT_MS = 5 * 60 * 1000
const SECONDS_PER_MINUTE = 60

function formatTimestamp(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
	const seconds = String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0')
	return `${minutes}:${seconds}`
}

function ConceptCard({ concept }: { concept: KeyConcept }) {
	return (
		<Card>
			<View style={s.concept}>
				<Eyebrow tone="muted">{formatTimestamp(concept.start_seconds)}</Eyebrow>
				<Text variant="body" style={{ fontWeight: '600' }}>
					{concept.title}
				</Text>
				<Text variant="caption" tone="secondary">
					“{concept.quote}”
				</Text>
			</View>
		</Card>
	)
}

export default function HomeScreen() {
	const [url, setUrl] = useState('')
	const readVideo = useMutation({
		mutationFn: () =>
			api('readVideo', { body: { url }, timeoutMs: READ_VIDEO_TIMEOUT_MS }).then((r) => r.video),
		onSuccess: (video) => {
			haptic.success()
			track('video_read', { concept_count: video.concepts.length })
		},
		onError: () => haptic.error()
	})
	const video = readVideo.data

	return (
		<Screen tabs gap={14}>
			<FadeSlideIn index={0} style={s.masthead}>
				<Text variant="title" accessibilityRole="header">
					What did you learn today?
				</Text>
			</FadeSlideIn>

			<FadeSlideIn index={1} style={s.form}>
				<TextInputField
					label="YouTube link"
					placeholder="https://www.youtube.com/watch?v=…"
					value={url}
					onChangeText={setUrl}
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="url"
					error={readVideo.isError ? errorMessage(readVideo.error) : null}
				/>
				<Button
					label={readVideo.isPending ? 'Reading the video…' : 'Read the video'}
					loading={readVideo.isPending}
					disabled={!url.trim() || readVideo.isPending}
					fullWidth
					onPress={() => readVideo.mutate()}
				/>
			</FadeSlideIn>

			{video ? (
				<FadeSlideIn index={2} style={s.results}>
					<Eyebrow tone="muted">{`${video.concepts.length} key concepts`}</Eyebrow>
					<Text variant="h1">{video.title}</Text>
					{video.concepts.map((concept) => (
						<ConceptCard key={concept.quote} concept={concept} />
					))}
				</FadeSlideIn>
			) : null}
		</Screen>
	)
}

const s = StyleSheet.create({
	masthead: { gap: 4, paddingTop: 8 },
	form: { gap: 12 },
	results: { gap: 12, paddingTop: 8 },
	concept: { gap: 6 }
})
