// How far a video's read has got, estimated from the time since it started (8X-49). The server
// answers once, at the end, so the steps follow how long a read usually takes; progress never
// reaches the end until the video is actually ready.

export type ReadingStep = 'opening' | 'reading' | 'ideas'

/** When each step usually ends, in seconds from the start, and how long a read usually takes. */
const OPENING_ENDS = 2
const READING_ENDS = 30
export const USUAL_READ_SECONDS = 40
/** Past this, the wait is longer than usual and the screen says so. */
export const LONGER_AFTER_SECONDS = 75
/** Where each step starts and ends on the bar, and the most it shows before the video is ready. */
const OPENING_SHARE = 0.05
const READING_SHARE = 0.75
const MOST = 0.95
/** How quickly the last step creeps towards the most, in seconds. */
const IDEAS_EASE_SECONDS = 12

export type ReadingAt = {
	step: ReadingStep
	/** 0 to 1, never quite 1. */
	progress: number
	longer: boolean
}

export function readingAt(seconds: number): ReadingAt {
	const s = Math.max(0, seconds)
	const longer = s >= LONGER_AFTER_SECONDS
	if (s < OPENING_ENDS)
		return { step: 'opening', progress: (OPENING_SHARE * s) / OPENING_ENDS, longer }
	if (s < READING_ENDS) {
		const share = (s - OPENING_ENDS) / (READING_ENDS - OPENING_ENDS)
		return {
			step: 'reading',
			progress: OPENING_SHARE + (READING_SHARE - OPENING_SHARE) * share,
			longer
		}
	}
	const eased = 1 - Math.exp(-(s - READING_ENDS) / IDEAS_EASE_SECONDS)
	return { step: 'ideas', progress: READING_SHARE + (MOST - READING_SHARE) * eased, longer }
}

/** "0:21": minutes and seconds since the read started. */
export function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds))
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
