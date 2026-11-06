import type { ListedTopic } from '@app/contract'

/**
 * Offered to a person with no link of their own: short, so the first class is quick, and on a
 * topic anyone can explain.
 */
export const STARTER_VIDEO = {
	youtubeId: 'UNP03fDSj1U',
	title: 'Try something new for 30 days',
	by: 'Matt Cutts · TED',
	minutes: 3
} as const

export const STARTER_URL = `https://www.youtube.com/watch?v=${STARTER_VIDEO.youtubeId}`

/**
 * Home is in its first run until a class has finished: before that there is nothing in Class
 * memory or warm-ups to show. Unknown (still loading, or failed) is not a first run, so Home
 * falls back to how it always looks.
 */
export function isFirstRun(topics: readonly ListedTopic[] | undefined) {
	return topics !== undefined && topics.every((topic) => topic.idea_count === undefined)
}
