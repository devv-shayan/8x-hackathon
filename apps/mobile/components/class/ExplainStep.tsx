import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { MIN_EXPLANATION_LENGTH } from '@app/contract'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { track } from '@/lib/analytics'

/** Explain the video in your own words; "I'm done" starts the class. */
export function ExplainStep({
	topicId,
	title,
	onStart,
	pending,
	error
}: {
	topicId: string
	title: string | null
	onStart: (explanation: string) => void
	pending: boolean
	error: string | null
}) {
	const [explanation, setExplanation] = useState('')
	const ready = explanation.trim().length >= MIN_EXPLANATION_LENGTH

	useEffect(() => {
		track('explain_viewed', { topic_id: topicId })
	}, [topicId])

	return (
		<View style={s.explain}>
			{title ? (
				<Text variant="h1" accessibilityRole="header">
					{title}
				</Text>
			) : null}
			<Text variant="lead" tone="secondary">
				The source stays hidden. Your score stays hidden until the class ends.
			</Text>
			<TextInputField
				label="Your explanation"
				placeholder="What’s the main idea, and how does it work?"
				multiline
				numberOfLines={8}
				value={explanation}
				onChangeText={setExplanation}
				error={error}
				hint={
					!ready && explanation.trim().length > 0
						? `A few more words — at least ${MIN_EXPLANATION_LENGTH} characters.`
						: undefined
				}
			/>
			<Button
				label={pending ? 'Students are thinking…' : 'I’m done'}
				loading={pending}
				disabled={!ready || pending}
				fullWidth
				onPress={() => onStart(explanation)}
			/>
		</View>
	)
}

const s = StyleSheet.create({ explain: { gap: 14 } })
