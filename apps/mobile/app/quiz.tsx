import { useEffect, useRef, useState, type RefObject } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { BlurTargetView } from 'expo-blur'
import { StatusBar } from 'expo-status-bar'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PressableScale } from '@/components/motion/PressableScale'
import { QuizComeBack } from '@/components/quiz/QuizComeBack'
import { QuizPanel } from '@/components/quiz/QuizPanel'
import { QuizPlayer } from '@/components/quiz/QuizPlayer'
import { ShimmerField } from '@/components/quiz/ShimmerField'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { api, errorMessage } from '@/lib/api'
import {
	loadQuizRecord,
	localDay,
	nextRecord,
	playedToday,
	saveQuizRecord,
	type QuizRecord
} from '@/lib/quiz'

/** Writing a quiz is one model call, slower than most routes when Gemini is busy. */
const QUIZ_TIMEOUT_MS = 60_000
const FLASH_MS = 650
const MAX_WIDTH = 520

function leave() {
	if (router.canGoBack()) router.back()
	else router.replace('/(tabs)')
}

function Message({
	title,
	line,
	action,
	onAction,
	blurTarget
}: {
	title: string
	line?: string
	action?: string
	onAction?: () => void
	blurTarget: RefObject<View | null>
}) {
	const { colors: c } = useTheme()
	return (
		<View style={s.message} accessibilityLiveRegion="polite">
			<QuizPanel blurTarget={blurTarget}>
				<Text variant="h1" style={[s.center, { color: c.heroText }]}>
					{title}
				</Text>
				{line ? (
					<Text variant="body" style={[s.center, { color: c.heroTextSecondary }]}>
						{line}
					</Text>
				) : null}
				{action && onAction ? (
					<Button
						label={action}
						variant="primary"
						size="lg"
						style={s.messageAction}
						onPress={onAction}
					/>
				) : null}
			</QuizPanel>
		</View>
	)
}

/**
 * The daily quiz: a deck of cards on the person's own shimmering ideas. Played once a day, for
 * a score to beat tomorrow.
 */
export default function QuizScreen() {
	const { colors: c, radii, elevation } = useTheme()
	const insets = useSafeAreaInsets()
	const [day] = useState(() => localDay(new Date()))
	/** Undefined while it loads. What the person is playing against stays fixed for the quiz. */
	const [previous, setPrevious] = useState<QuizRecord | null | undefined>(undefined)
	const [finishedToday, setFinishedToday] = useState(false)
	const [flash, setFlash] = useState(false)
	const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const behindGlass = useRef<View>(null)

	useEffect(() => {
		void loadQuizRecord().then(setPrevious)
		return () => {
			if (flashTimer.current) clearTimeout(flashTimer.current)
		}
	}, [])

	const alreadyPlayed = previous !== undefined && playedToday(previous, new Date())
	const quiz = useQuery({
		queryKey: ['quiz', day],
		queryFn: () => api('getDailyQuiz', { timeoutMs: QUIZ_TIMEOUT_MS }),
		enabled: previous !== undefined && !alreadyPlayed,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false
	})

	function lightUp() {
		setFlash(true)
		if (flashTimer.current) clearTimeout(flashTimer.current)
		flashTimer.current = setTimeout(() => setFlash(false), FLASH_MS)
	}

	function finish(score: number, total: number) {
		if (previous === undefined) return
		setFinishedToday(true)
		void saveQuizRecord(nextRecord(previous, score, total, new Date()))
	}

	const questions = quiz.data?.questions ?? []
	let body
	if (previous === undefined || (quiz.isPending && !alreadyPlayed)) {
		body = <Message title="Maya’s sharpening the chalk…" blurTarget={behindGlass} />
	} else if (alreadyPlayed && !finishedToday && previous) {
		body = <QuizComeBack record={previous} onDone={leave} blurTarget={behindGlass} />
	} else if (quiz.isError) {
		body = (
			<Message
				blurTarget={behindGlass}
				title="The chalk snapped"
				line={errorMessage(quiz.error)}
				action="Try again"
				onAction={() => {
					void quiz.refetch()
				}}
			/>
		)
	} else if (questions.length === 0) {
		body = (
			<Message
				blurTarget={behindGlass}
				title="Teach a video first"
				line="The quiz is made from ideas you’ve already taught."
				action="Back"
				onAction={leave}
			/>
		)
	} else {
		body = (
			<QuizPlayer
				questions={questions}
				previous={previous}
				onFinish={finish}
				onDone={leave}
				onRightAnswer={lightUp}
			/>
		)
	}

	return (
		<View style={[s.fill, s.clip, { backgroundColor: c.hero }]}>
			<StatusBar style="light" />
			<BlurTargetView ref={behindGlass} style={StyleSheet.absoluteFill}>
				<ShimmerField words={quiz.data?.shimmer_words ?? []} flash={flash} />
			</BlurTargetView>
			<View style={[s.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 14 }]}>
				{body}
			</View>
			<View style={[s.top, { top: insets.top + 8 }]} pointerEvents="box-none">
				<PressableScale
					onPress={leave}
					accessibilityLabel="Close the quiz"
					style={[
						s.close,
						{ backgroundColor: c.surface, borderRadius: radii.pill },
						elevation.soft
					]}
				>
					<X size={20} color={c.textPrimary} strokeWidth={2.4} />
				</PressableScale>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	// The glass's glow runs past the screen's edges.
	clip: { overflow: 'hidden' },
	content: {
		flex: 1,
		width: '100%',
		maxWidth: MAX_WIDTH,
		alignSelf: 'center',
		paddingHorizontal: 16
	},
	top: { position: 'absolute', left: 16, zIndex: 2 },
	close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
	message: { flex: 1, justifyContent: 'center' },
	messageAction: { alignSelf: 'center' },
	center: { textAlign: 'center' }
})
