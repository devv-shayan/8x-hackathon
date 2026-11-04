import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { DueWarmUp, Video } from '@app/contract'
import type { Raised } from '@app/pixel'
import { PixelBackdrop } from '@/components/pixel/PixelBackdrop'
import { PixelBoard } from '@/components/pixel/PixelBoard'
import { Button } from '@/components/ui/Button'
import { MonoLabel } from '@/components/ui/MonoLabel'
import { SheetCard } from '@/components/ui/SheetCard'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { clock, readingAt, USUAL_READ_SECONDS } from '@/lib/readingProgress'
import { youtubeBoardUrl } from '@/lib/youtubeThumb'

/** Where the read stands: still going, done, a video we can't read, or a failure to retry. */
export type ReadingPhase =
	| { kind: 'reading'; seconds: number }
	| { kind: 'ready'; video: Video; seconds: number }
	| { kind: 'unreadable' }
	| { kind: 'failed'; message: string; busy: boolean }

/** The guesses on offer for how many key ideas a video has; the last means "or more". */
export const GUESSES = [3, 4, 5, 6] as const

/** The board's width on a phone, and its share of a narrow screen. */
const BOARD_MAX = 300
const BOARD_SIDE_ROOM = 100
const BEZEL = 8
/**
 * The bar's three steps, roughly as long as each usually takes; opening is really a second or
 * two, but drawn wide enough to hold its name.
 */
const STEP_WEIGHTS = [3, 10, 3]
/**
 * The sheet's least height, as a share of the screen. The class stands where the scene puts it,
 * just under the bubbles, so the sheet must reach up past their waists in every state.
 */
const SHEET_MIN_SHARE = 0.4
/** Past this percent, stopping throws away more than it saves. */
const HALFWAY = 50
const STEP_NAMES = ['Open', 'Read', 'Ideas']

function omarLine(phase: ReadingPhase): string {
	if (phase.kind === 'ready') {
		const n = phase.video.concepts.length
		return `Done. ${n} big ${n === 1 ? 'idea' : 'ideas'} in it.`
	}
	if (phase.kind === 'unreadable') return 'Hmm. I can’t open this one.'
	if (phase.kind === 'failed')
		return phase.busy ? 'Too many videos at once. Give me a minute.' : 'Hmm. That didn’t work.'
	const at = readingAt(phase.seconds)
	if (at.longer) return 'It’s a long one. Still going!'
	if (at.step === 'opening') return 'Ooh, a new one. Opening it…'
	if (at.step === 'reading') return 'Reading what it says. The slow bit.'
	return 'Picking out the big ideas now.'
}

function Bubble({ text, side }: { text: string; side: 'left' | 'right' }) {
	const { colors: c, elevation } = useTheme()
	return (
		<View
			style={[
				s.bubble,
				side === 'right' ? s.bubbleRight : s.bubbleLeft,
				{ backgroundColor: side === 'right' ? c.surface : c.well },
				elevation.soft
			]}
			accessibilityLiveRegion="polite"
		>
			<Text variant="bodySm" style={s.bubbleText}>
				{text}
			</Text>
		</View>
	)
}

function Chip({ text, tone }: { text: string; tone: 'ink' | 'lime' | 'error' }) {
	const { colors: c, radii } = useTheme()
	const bg = tone === 'lime' ? c.brandFill : tone === 'error' ? c.error : c.hero
	const fg = tone === 'lime' ? c.onBrand : tone === 'error' ? c.onError : c.brandFill
	return (
		<View style={[s.chip, { backgroundColor: bg, borderRadius: radii.sm }]}>
			<Text variant="eyebrow" style={{ color: fg }}>
				{text}
			</Text>
		</View>
	)
}

/** The bar: three steps, each as wide as it usually takes, the current one filling. */
function Steps({ seconds }: { seconds: number }) {
	const { colors: c } = useTheme()
	const at = readingAt(seconds)
	const current = ['opening', 'reading', 'ideas'].indexOf(at.step)
	// How far into the current step the bar is, from the overall estimate.
	const bounds = [0, 0.05, 0.75, 0.95]
	const within = Math.min(
		1,
		(at.progress - bounds[current]!) / (bounds[current + 1]! - bounds[current]!)
	)
	return (
		<View style={s.stepsWrap} accessible accessibilityLabel={`Step ${current + 1} of 3`}>
			<View style={s.steps}>
				{STEP_WEIGHTS.map((weight, i) => (
					<View key={i} style={[s.step, { flex: weight, backgroundColor: c.surface3 }]}>
						<View
							style={[
								s.stepFill,
								{
									backgroundColor: c.textPrimary,
									width: `${i < current ? 100 : i === current ? Math.round(within * 100) : 0}%`
								}
							]}
						/>
					</View>
				))}
			</View>
			<View style={s.steps}>
				{STEP_WEIGHTS.map((weight, i) => (
					<Text
						key={i}
						variant="eyebrow"
						tone={i === current ? 'primary' : 'secondary'}
						numberOfLines={1}
						style={[{ flex: weight }, i === 2 && s.right]}
					>
						{STEP_NAMES[i]}
					</Text>
				))}
			</View>
		</View>
	)
}

function WarmUpOffer({
	gap,
	lead,
	onAnswer,
	onLater
}: {
	gap: DueWarmUp
	lead: string
	onAnswer: () => void
	onLater?: () => void
}) {
	const { colors: c, radii } = useTheme()
	const student = gap.student_name ?? 'A student'
	return (
		<View style={[s.offer, { backgroundColor: c.well, borderRadius: radii['2xl'] }]}>
			<MonoLabel right="1 min">{`${student} · warm-up`}</MonoLabel>
			<Text variant="label" style={s.offerText}>
				{`${lead} ${student} has a question about ${gap.concept_title}.`}
			</Text>
			<View style={s.row}>
				<Button label="Answer" variant="ink" size="sm" onPress={onAnswer} />
				{onLater ? <Button label="Later" variant="secondary" size="sm" onPress={onLater} /> : null}
			</View>
		</View>
	)
}

function Link({ label, onPress, tone }: { label: string; onPress: () => void; tone?: 'error' }) {
	const { colors: c } = useTheme()
	return (
		<Pressable onPress={onPress} accessibilityRole="button" hitSlop={10} style={s.link}>
			<Text variant="label" style={{ color: tone === 'error' ? c.errorText : c.textSecondary }}>
				{label}
			</Text>
		</Pressable>
	)
}

/**
 * Reading a video (8X-49): the class watches it come in on a board above them, in the app's
 * pixel pattern built from the video's own main colour, while Omar says what's happening. The
 * sheet holds the steps, then a due warm-up to fill the wait (Maya's hand goes up) or, with
 * nothing due, a guess at how many key ideas it has. Ready, can't read, busy and cancel each
 * have their own words; `unreadable` is where the paste fallback goes.
 */
export function ReadingView({
	youtubeId,
	title,
	phase,
	warmUp,
	guess,
	onGuess,
	onAnswerWarmUp,
	onCancel,
	onBack,
	onTeach,
	onRetry,
	unreadable
}: {
	youtubeId: string | null
	title: string | null
	phase: ReadingPhase
	warmUp: DueWarmUp | null
	guess: number | null
	onGuess: (guess: number) => void
	onAnswerWarmUp: (gap: DueWarmUp) => void
	onCancel: () => void
	onBack: () => void
	onTeach: (video: Video) => void
	onRetry: () => void
	unreadable: ReactNode
}) {
	const { colors: c, radii } = useTheme()
	const insets = useSafeAreaInsets()
	const { width, height } = useWindowDimensions()
	const [later, setLater] = useState(false)
	const [confirming, setConfirming] = useState(false)

	const reading = phase.kind === 'reading' ? readingAt(phase.seconds) : null
	const offer = warmUp && !later ? warmUp : null
	const raised: Raised =
		phase.kind === 'ready'
			? { Maya: 1, Omar: 1 }
			: offer && phase.kind !== 'unreadable'
				? { Maya: 1 }
				: {}
	const boardWidth = Math.min(BOARD_MAX, width - BOARD_SIDE_ROOM)
	const boardHeight = (boardWidth * 9) / 16
	const boardTop = insets.top + 52
	const picture = phase.kind === 'reading' || phase.kind === 'ready'
	const percent = reading ? Math.round(reading.progress * 100) : 100
	const mayaLine =
		phase.kind === 'ready' ? 'Teach us!' : reading && !offer ? 'I bet it has 6 big ideas.' : null
	const shownTitle = phase.kind === 'ready' ? phase.video.title : (title ?? 'Reading your video')

	return (
		<View style={s.fill}>
			<PixelBackdrop scene="reading" raised={raised} />
			<View
				style={[
					s.board,
					{
						top: boardTop,
						width: boardWidth,
						height: boardHeight,
						backgroundColor: c.hero,
						borderRadius: radii.xl,
						marginLeft: -boardWidth / 2
					}
				]}
				accessible
				accessibilityLabel={
					phase.kind === 'ready'
						? 'Your video is ready'
						: reading
							? `Reading your video, ${percent} percent`
							: 'No picture'
				}
			>
				<View style={[s.screen, { borderRadius: radii.md }]}>
					{picture && youtubeId ? (
						<PixelBoard
							src={youtubeBoardUrl(youtubeId)}
							progress={reading?.progress ?? 1}
							ready={phase.kind === 'ready'}
						/>
					) : null}
				</View>
				<View style={s.chipTopRight}>
					{phase.kind === 'ready' ? (
						<Chip text="Ready" tone="lime" />
					) : reading?.step === 'opening' ? (
						<Chip text="Opening" tone="ink" />
					) : reading?.longer && phase.kind === 'reading' ? (
						<Chip text={clock(phase.seconds)} tone="ink" />
					) : null}
				</View>
				{reading ? (
					<View style={s.chipBottomLeft}>
						<Chip text={`${percent}%`} tone="ink" />
					</View>
				) : null}
				{phase.kind === 'unreadable' || phase.kind === 'failed' ? (
					<View style={s.chipCentre}>
						<Chip
							text={phase.kind === 'unreadable' ? 'No signal' : phase.busy ? 'Busy' : 'Off air'}
							tone={phase.kind === 'failed' && phase.busy ? 'ink' : 'error'}
						/>
					</View>
				) : null}
			</View>
			<View style={[s.bubbles, { top: boardTop + boardHeight + BEZEL + 14 }]} pointerEvents="none">
				{mayaLine ? <Bubble text={mayaLine} side="left" /> : <View />}
				<Bubble text={omarLine(phase)} side="right" />
			</View>
			<View style={s.fill} pointerEvents="none" />
			<SheetCard style={{ minHeight: height * SHEET_MIN_SHARE }}>
				{phase.kind === 'reading' ? (
					<>
						<MonoLabel
							right={
								readingAt(phase.seconds).longer
									? clock(phase.seconds)
									: readingAt(phase.seconds).step === 'ideas'
										? 'almost there'
										: `about ${Math.max(5, Math.round((USUAL_READ_SECONDS - phase.seconds) / 5) * 5)} s`
							}
						>
							{`Step ${['opening', 'reading', 'ideas'].indexOf(readingAt(phase.seconds).step) + 1} of 3`}
						</MonoLabel>
						<Text variant="label" numberOfLines={2} style={s.title}>
							{shownTitle}
						</Text>
						<Steps seconds={phase.seconds} />
						{readingAt(phase.seconds).longer ? (
							<View style={s.block}>
								<Text variant="label">Longer than usual.</Text>
								<Text variant="caption" tone="secondary">
									Long videos can take a few minutes. You can leave: it keeps reading.
								</Text>
								<Button
									label="Back to Home"
									variant="secondary"
									size="lg"
									fullWidth
									onPress={onBack}
								/>
							</View>
						) : offer ? (
							<WarmUpOffer
								gap={offer}
								lead="Hand up:"
								onAnswer={() => onAnswerWarmUp(offer)}
								onLater={() => setLater(true)}
							/>
						) : (
							<View style={s.block}>
								<MonoLabel>How many key ideas, do you think?</MonoLabel>
								<View style={s.row}>
									{GUESSES.map((n) => (
										<Pressable
											key={n}
											onPress={() => onGuess(n)}
											accessibilityRole="button"
											accessibilityState={{ selected: guess === n }}
											accessibilityLabel={n === 6 ? '6 or more' : String(n)}
											style={[
												s.guess,
												{
													borderRadius: radii.xl,
													backgroundColor: guess === n ? c.brandFill : c.well,
													borderColor: guess === n ? c.brandBorder : 'transparent'
												}
											]}
										>
											<Text variant="h3" style={guess === n ? { color: c.onBrand } : undefined}>
												{n === 6 ? '6+' : String(n)}
											</Text>
										</Pressable>
									))}
								</View>
							</View>
						)}
						<Link label="Cancel" onPress={() => setConfirming(true)} />
					</>
				) : phase.kind === 'ready' ? (
					<>
						<MonoLabel right={`read in ${clock(phase.seconds)}`}>Ready to teach</MonoLabel>
						<Text variant="label" numberOfLines={2} style={s.title}>
							{shownTitle}
						</Text>
						<View style={[s.row, s.ideas]}>
							{phase.video.concepts.map((concept) => (
								<View
									key={concept.title}
									style={[s.idea, { backgroundColor: c.brandFill, borderColor: c.brandBorder }]}
								/>
							))}
							<Text variant="label" style={s.ideasText}>
								{`${phase.video.concepts.length} key ideas${guess ? ` · you guessed ${guess === 6 ? '6+' : guess}` : ''}`}
							</Text>
						</View>
						<Button
							label="Teach it"
							variant="ink"
							size="lg"
							fullWidth
							onPress={() => onTeach(phase.video)}
							style={s.cta}
						/>
						<Link label="Back to Home" onPress={onBack} />
					</>
				) : phase.kind === 'unreadable' ? (
					<>
						<MonoLabel>Couldn’t read it</MonoLabel>
						<Text variant="h3" style={s.title}>
							We can’t read this video.
						</Text>
						<Text variant="caption" tone="secondary">
							It may be private or blocked. Paste what it says and teach that instead.
						</Text>
						<View style={s.block}>{unreadable}</View>
						<Link label="Try another link" onPress={onBack} />
					</>
				) : (
					<>
						<Text variant="h3">{phase.message}</Text>
						<Text variant="caption" tone="secondary" style={s.lede}>
							{phase.busy
								? 'Nothing’s lost. Try again in a minute.'
								: 'Try again, or try another link.'}
						</Text>
						<Button
							label="Try again"
							variant="ink"
							size="lg"
							fullWidth
							onPress={onRetry}
							style={s.cta}
						/>
						{offer ? (
							<WarmUpOffer gap={offer} lead="Meanwhile:" onAnswer={() => onAnswerWarmUp(offer)} />
						) : null}
						<Link label="Back to Home" onPress={onBack} />
					</>
				)}
			</SheetCard>
			{confirming ? (
				<View style={[StyleSheet.absoluteFill, s.scrim, { backgroundColor: c.overlay }]}>
					<View style={s.fill} />
					<SheetCard>
						<Text variant="h3">Stop reading this video?</Text>
						<Text variant="caption" tone="secondary" style={s.lede}>
							{`${percent >= HALFWAY ? 'Omar’s more than halfway.' : 'Omar’s only started.'} You can start again any time.`}
						</Text>
						<Button
							label="Keep reading"
							variant="ink"
							size="lg"
							fullWidth
							onPress={() => setConfirming(false)}
							style={s.cta}
						/>
						<Link
							label="Stop"
							tone="error"
							onPress={() => {
								setConfirming(false)
								onCancel()
							}}
						/>
					</SheetCard>
				</View>
			) : null}
		</View>
	)
}

const s = StyleSheet.create({
	fill: { flex: 1 },
	board: { position: 'absolute', left: '50%', padding: BEZEL, zIndex: 2 },
	screen: { flex: 1, overflow: 'hidden' },
	chipTopRight: { position: 'absolute', top: BEZEL + 6, right: BEZEL + 6 },
	chipBottomLeft: { position: 'absolute', bottom: BEZEL + 6, left: BEZEL + 6 },
	chipCentre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
	chip: { paddingHorizontal: 7, paddingVertical: 3 },
	bubbles: {
		position: 'absolute',
		left: 22,
		right: 22,
		zIndex: 2,
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12
	},
	bubble: { maxWidth: 170, paddingHorizontal: 12, paddingVertical: 9 },
	bubbleRight: { borderRadius: 18, borderBottomRightRadius: 6 },
	bubbleLeft: { borderRadius: 18, borderBottomLeftRadius: 6 },
	bubbleText: { fontWeight: '600' },
	title: { marginTop: 10 },
	lede: { marginTop: 6 },
	stepsWrap: { marginTop: 14, gap: 6 },
	steps: { flexDirection: 'row', gap: 4 },
	step: { height: 8, overflow: 'hidden' },
	stepFill: { height: 8 },
	right: { textAlign: 'right' },
	block: { marginTop: 16, gap: 10 },
	row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
	offer: { marginTop: 16, padding: 14, gap: 8 },
	offerText: { fontSize: 15, lineHeight: 20 },
	guess: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
	ideas: { marginTop: 14, flexWrap: 'wrap' },
	idea: { width: 20, height: 20, borderWidth: 1.5 },
	ideasText: { marginLeft: 6, fontSize: 14 },
	cta: { marginTop: 16 },
	link: { alignSelf: 'center', marginTop: 16, paddingVertical: 4 },
	scrim: { zIndex: 5 }
})
