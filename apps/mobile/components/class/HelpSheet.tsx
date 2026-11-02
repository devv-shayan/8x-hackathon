import { Linking, StyleSheet, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play } from 'lucide-react-native'
import type { ClassSession, ClassTurn } from '@app/contract'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { Sheet } from '@/components/ui/Sheet'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { api, errorMessage } from '@/lib/api'
import { formatTimestamp } from '@/lib/formatTimestamp'
import { youtubeWatchUrl } from '@/lib/youtubeWatch'
import { CLASS_TIMEOUT_MS, studentName } from './shared'

/**
 * "I’ll be back": private help over the class. What the video says about the question, the
 * moment to rewatch, and the way back to answer. The student who asked can't see it.
 */
export function HelpSheet({
	session,
	turn,
	open,
	onClose
}: {
	session: ClassSession
	turn: ClassTurn
	open: boolean
	onClose: () => void
}) {
	const { colors: c, radii } = useTheme()
	const queryClient = useQueryClient()
	const queryKey = ['class-help', turn.id]
	const help = useQuery({
		queryKey,
		queryFn: ({ signal }) =>
			api('getClassHelp', {
				signal,
				params: { id: session.id, turn: turn.id },
				body: {},
				timeoutMs: CLASS_TIMEOUT_MS
			}).then((r) => r.help),
		enabled: open,
		staleTime: Infinity,
		retry: false
	})
	const name = studentName(session, turn)
	const start = help.data?.start_seconds ?? null
	const youtubeId = session.youtube_id

	// Cancelling tells the server the person didn't stay for the help, so it isn't counted.
	function close() {
		void queryClient.cancelQueries({ queryKey })
		onClose()
	}

	function rewatch() {
		if (!youtubeId || start === null) return
		track('class_help_clip_opened', { start_seconds: start })
		void Linking.openURL(youtubeWatchUrl(youtubeId, start))
	}

	return (
		<Sheet open={open} onClose={close}>
			<View style={s.body}>
				<MonoLabel>{`Private help · ${name} can’t see this`}</MonoLabel>
				<Text variant="h2" accessibilityRole="header">
					What the video says
				</Text>
				<View style={[s.quote, { backgroundColor: c.well, borderRadius: radii['2xl'] }]}>
					{help.isPending ? (
						<Text variant="body" tone="secondary">
							Looking in the video…
						</Text>
					) : help.isError ? (
						<View style={s.gap}>
							<Text variant="body">{errorMessage(help.error)}</Text>
							<Button
								label="Try again"
								variant="outline"
								size="sm"
								onPress={() => help.refetch()}
							/>
						</View>
					) : (
						<>
							<Text variant="lead" style={{ color: c.textPrimary }}>
								{help.data.explanation}
							</Text>
							{start !== null ? (
								<MonoLabel
									style={s.source}
								>{`From the video at ${formatTimestamp(start)}`}</MonoLabel>
							) : null}
						</>
					)}
				</View>
				{youtubeId && start !== null ? (
					<Button
						label={`Rewatch from ${formatTimestamp(start)}`}
						variant="outline"
						size="sm"
						icon={(color) => <Play size={14} color={color} fill={color} />}
						onPress={rewatch}
					/>
				) : null}
				<Button
					label={`I’m back, answer ${name}`}
					variant="ink"
					size="lg"
					fullWidth
					onPress={close}
				/>
			</View>
		</Sheet>
	)
}

const s = StyleSheet.create({
	body: { gap: 14 },
	gap: { gap: 10 },
	quote: { padding: 16 },
	source: { marginTop: 12 }
})
