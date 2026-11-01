import { DEFAULT_STUDENTS } from '@/server/classroom/student-turn'
import { DAYS_UNTIL_FIRST_DUE, firstDueAt } from '@/server/gaps/schedule'

const DAY_MS = 24 * 60 * 60 * 1000

/** Stable id so running the seed again updates this class instead of adding another. */
export const SEED_YOUTUBE_ID = 'seed-due-gap'

const MAYA = DEFAULT_STUDENTS[0]

/**
 * A past class whose missed concept is already due.
 * The quote is taken from the transcript, and the due time uses the real schedule:
 * found three days ago, so the two-day gap is already due.
 */
export function pastClassSeed(now: Date) {
	const foundAt = new Date(now.getTime() - (DAYS_UNTIL_FIRST_DUE + 1) * DAY_MS)
	const concept = {
		title: 'Photosynthesis',
		quote: 'Plants make their own food',
		startSeconds: 12
	}
	return {
		youtubeId: SEED_YOUTUBE_ID,
		title: 'How plants eat',
		segments: [{ startSeconds: concept.startSeconds, text: `${concept.quote} using sunlight.` }],
		concepts: [concept],
		explanation: 'Plants get food from the soil they grow in.',
		conceptResults: [{ concept: concept.title, result: 'missed' as const }],
		foundAt,
		nextDueAt: firstDueAt(foundAt),
		student: MAYA,
		question: 'Where does a plant get its food?',
		answer: 'From the soil.'
	}
}
