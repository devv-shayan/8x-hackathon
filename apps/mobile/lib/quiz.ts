import AsyncStorage from '@react-native-async-storage/async-storage'
import { z } from 'zod'

// The daily quiz's rules on the phone: the score to beat, once a day, how Maya and Omar do,
// and the words around them. The score lives on this device, so it does not follow someone
// to a new phone.

const KEY = 'app:quiz:v1'
/** Omar has seen the video. Maya hasn't, and slips up. */
const OMAR_RIGHT_SHARE = 0.85
const MAYA_RIGHT_SHARE = 0.45
const REMINDER_MINUTES = 5
const REMINDER_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_MINUTE = 60 * 1000

const recordSchema = z.object({
	best: z.number().int().nonnegative(),
	lastScore: z.number().int().nonnegative(),
	lastTotal: z.number().int().nonnegative(),
	playedDay: z.string()
})

export type QuizRecord = z.infer<typeof recordSchema>

export type Random = () => number

export type ClassGuess = { maya: boolean; omar: boolean }

/** The person's own calendar day: the quiz turns over at their midnight. */
export function localDay(now: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function playedToday(record: QuizRecord | null, now: Date): boolean {
	return record?.playedDay === localDay(now)
}

/** The stored record, or null when there is none or it can't be read. Never throws. */
export async function loadQuizRecord(): Promise<QuizRecord | null> {
	try {
		const raw = await AsyncStorage.getItem(KEY)
		return raw ? recordSchema.parse(JSON.parse(raw)) : null
	} catch {
		return null
	}
}

export function nextRecord(
	previous: QuizRecord | null,
	score: number,
	total: number,
	now: Date
): QuizRecord {
	return {
		best: Math.max(previous?.best ?? 0, score),
		lastScore: score,
		lastTotal: total,
		playedDay: localDay(now)
	}
}

/** Saves the result. A write that fails still counts for this session. */
export async function saveQuizRecord(record: QuizRecord): Promise<void> {
	try {
		await AsyncStorage.setItem(KEY, JSON.stringify(record))
	} catch {
		// Non-fatal.
	}
}

export function isNewBest(previous: QuizRecord | null, score: number): boolean {
	return score > (previous?.best ?? 0)
}

/** How Maya and Omar answer each question, decided up front so a replay can't change it. */
export function classGuesses(count: number, random: Random): ClassGuess[] {
	return Array.from({ length: count }, () => ({
		maya: random() < MAYA_RIGHT_SHARE,
		omar: random() < OMAR_RIGHT_SHARE
	}))
}

/** The class's reaction to one answer. It teases, and never scolds. */
export function reactionLine(isRight: boolean, { maya, omar }: ClassGuess): string {
	if (isRight) {
		if (maya && omar) return 'All three of you got it.'
		if (omar) return 'You and Omar got it. Maya fell for it.'
		if (maya) return 'You and Maya got it. Omar slipped.'
		return 'Only you got it. The class is impressed.'
	}
	if (maya && omar) return 'Maya and Omar both got this one.'
	if (omar) return 'Omar knew it. Maya fell for it too.'
	if (maya) return 'Maya got it! Omar fell for it too.'
	return 'That one fooled the whole class.'
}

/** "On a roll!" from two right in a row, for this quiz only. */
export function rightInARow(results: readonly boolean[]): number {
	let run = 0
	for (let i = results.length - 1; i >= 0 && results[i]; i--) run++
	return run
}

/** The headline and the line under it on the end screen. */
export function endWords(
	previous: QuizRecord | null,
	score: number
): { headline: string; line: string } {
	const best = previous?.best ?? 0
	if (!previous) {
		return { headline: 'Your first score', line: 'Now you have one to beat tomorrow.' }
	}
	if (score > best) {
		return { headline: 'Your best yet', line: `Up from ${best}. Beat it tomorrow.` }
	}
	if (score === best) {
		return { headline: 'Matched your best', line: 'One more next time. Beat it tomorrow.' }
	}
	return { headline: 'So close', line: `Your best is ${best}. Beat it tomorrow.` }
}

/** How the person did against the class, in a few words. */
export function classLine(score: number, maya: number, omar: number): string {
	const against = (name: string, theirs: number) => {
		if (score > theirs) return `beat ${name}`
		if (score === theirs) return `tied ${name}`
		return `lost to ${name}`
	}
	return `You ${against('Maya', maya)} and ${against('Omar', omar)}.`
}

function calendarStamp(at: Date): string {
	return at
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '')
}

/** Google Calendar, filled in: tomorrow at this time, every day for a week. */
export function reminderUrl(now: Date): string {
	const start = new Date(now.getTime() + MS_PER_DAY)
	const end = new Date(start.getTime() + REMINDER_MINUTES * MS_PER_MINUTE)
	const params = [
		['action', 'TEMPLATE'],
		['text', 'Chalkback daily quiz: beat your score'],
		['details', 'One minute on what you have taught. Open Chalkback and beat your best.'],
		['dates', `${calendarStamp(start)}/${calendarStamp(end)}`],
		['recur', `RRULE:FREQ=DAILY;COUNT=${REMINDER_DAYS}`]
	]
	const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&')
	return `https://calendar.google.com/calendar/render?${query}`
}
