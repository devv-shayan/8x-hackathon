/**
 * The class: nobody asks until the person calls on a student. With hands up and no pick, no
 * question shows; calling on a student puts their question in a speech bubble, shown word by
 * word as they say it, and a tap shows it all.
 */
import { StyleSheet } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ClassSession } from '@app/contract'
import { ClassStep } from '@/components/class/ClassStep'

jest.mock('@/lib/voice/recorder', () => ({
	canRecordVoice: false,
	RecorderError: Error,
	useRecorder: () => ({ streams: false, start: jest.fn() })
}))
jest.mock('@/lib/voice/playback', () => ({
	canPlayVoice: false,
	playWav: jest.fn(),
	speakWithDevice: jest.fn()
}))
jest.mock('react-native-safe-area-context', () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}))
jest.mock('@/components/pixel/PixelBackdrop', () => ({ PixelBackdrop: () => null }))
jest.mock('@/components/pixel/StudentTargets', () => ({ StudentTargets: () => null }))
jest.mock('@/components/class/HelpSheet', () => ({ HelpSheet: () => null }))
jest.mock('@/components/motion/PressableScale', () => ({
	PressableScale: jest.requireActual('react-native').Pressable
}))
jest.mock('@/lib/api', () => ({ api: jest.fn(), ApiError: Error }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/motion', () => ({ useReducedMotion: () => false }))
jest.mock('@/hooks/useQuestionVoice', () => ({
	usePrefetchQuestionVoices: () => {},
	useQuestionVoice: () => ({ state: 'off', replay: () => {}, progress: () => null, plays: 0 })
}))

const MAYA = '11111111-1111-4111-8111-111111111111'
const OMAR = '22222222-2222-4222-8222-222222222222'

const session: ClassSession = {
	id: '33333333-3333-4333-8333-333333333333',
	topic_id: '44444444-4444-4444-8444-444444444444',
	youtube_id: null,
	students: [
		{ id: MAYA, name: 'Maya', persona: 'curious' },
		{ id: OMAR, name: 'Omar', persona: 'sceptical' }
	],
	turns: [
		{
			id: '55555555-5555-4555-8555-555555555555',
			student_id: MAYA,
			question: 'Why a month?',
			answer: null,
			outcome: null
		},
		{
			id: '66666666-6666-4666-8666-666666666666',
			student_id: OMAR,
			question: 'What changed for him?',
			answer: null,
			outcome: null
		}
	],
	finished: false,
	concept_results: null,
	reactions: null
}

function renderClass(openTurn: ClassSession['turns'][number] | undefined, onPick = jest.fn()) {
	render(
		<ClassStep
			session={session}
			hands={session.turns}
			answeredCount={0}
			openTurn={openTurn}
			answer=""
			onAnswerChange={() => {}}
			onPick={onPick}
			onAnswer={() => {}}
			onSkip={() => {}}
			onEnd={() => {}}
			answering={false}
			ending={false}
			error={null}
			helpOpen={false}
			onHelp={() => {}}
			onCloseHelp={() => {}}
		/>
	)
	return onPick
}

it('shows no question until a student is called on', () => {
	const onPick = renderClass(undefined)
	expect(screen.getByText('Hands are up.')).toBeTruthy()
	expect(screen.getByText('Tap a student to let them ask.')).toBeTruthy()
	expect(screen.queryByText('Why a month?')).toBeNull()
	expect(screen.queryByText('What changed for him?')).toBeNull()
	fireEvent.press(screen.getByText('Let Omar ask'))
	expect(onPick).toHaveBeenCalledWith(session.turns[1])
})

/** Whether a word of the bubble is showing yet: words not said are laid out, but clear. */
function showing(word: string) {
	return StyleSheet.flatten(screen.getByText(word).props.style)?.color !== 'transparent'
}

it("puts the called-on student's question in the bubble, word by word", () => {
	renderClass(session.turns[1])
	// The whole question is laid out (and read by screen readers) from the start.
	expect(screen.getByRole('header', { name: 'What changed for him?' })).toBeTruthy()
	expect(showing('him?')).toBe(false)
	expect(screen.queryByText('Hands are up.')).toBeNull()
	// The sheet holds who's asking and the answer, not the question.
	expect(screen.getByText('Omar · Watched it twice')).toBeTruthy()
})

it('shows the whole question on a tap, and counts it', () => {
	const { track } = jest.requireMock('@/lib/analytics') as { track: jest.Mock }
	renderClass(session.turns[1])
	fireEvent.press(screen.getByText('What '))
	expect(showing('him?')).toBe(true)
	expect(track).toHaveBeenCalledWith('class_question_shown_all', { student: 'Omar' })
})
