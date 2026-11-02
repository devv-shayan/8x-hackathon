import { z } from 'zod'
import { isoDateTime, uuid } from './common'

// /api/app/v1/videos: reading a YouTube video.
//
// POST videos → the video's title, its transcript with timestamps, and the key
//               concepts everything later is measured against. The first read
//               takes up to a minute or so; adding the same video again returns
//               the stored one. A video the app can't use answers 422
//               `video_unreadable`, with a message to show.

export const transcriptSegmentSchema = z.object({
	start_seconds: z.number().int().min(0),
	text: z.string()
})

export const keyConceptSchema = z.object({
	title: z.string(),
	quote: z.string(),
	start_seconds: z.number().int().min(0)
})

export const videoSchema = z.object({
	/** The stored topic. Later steps refer to it by this id. */
	id: uuid,
	youtube_id: z.string(),
	title: z.string(),
	segments: z.array(transcriptSegmentSchema),
	concepts: z.array(keyConceptSchema)
})

export const readVideoBody = z.object({ url: z.string().trim().min(1).max(500) }).strict()

export const readVideoResponse = z.object({ video: videoSchema })

/** Long enough for a few ideas, short of a whole book. */
export const MAX_PASTE_CHARS = 20_000

/**
 * A topic saved from pasted text, not a YouTube id. YouTube ids are 11
 * characters, so this prefix never collides with one, and the same text for
 * the same person resolves to the same topic.
 */
export const PASTE_TOPIC_PREFIX = 'text-'

export function isPastedTopic(youtubeId: string): boolean {
	return youtubeId.startsWith(PASTE_TOPIC_PREFIX)
}

export const pasteTextBody = z
	.object({ text: z.string().trim().min(1).max(MAX_PASTE_CHARS) })
	.strict()

/** Title (and id) for Explain — no transcript, so the source stays off the screen. */
export const topicParams = z.object({ id: uuid })
export const topicSummarySchema = z.object({
	id: uuid,
	title: z.string()
})
export const getTopicResponse = z.object({ topic: topicSummarySchema })

/**
 * A row on Home's recent-topics list. No transcript or concepts — those stay
 * off Home until the class ends. `open_class_id` is the unfinished class on
 * this topic, when there is one (so the app never calls openClass once per row).
 */
export const listedTopicSchema = z.object({
	id: uuid,
	youtube_id: z.string(),
	title: z.string(),
	open_class_id: uuid.nullable(),
	/** How many ideas the latest finished class checked. Absent before one has finished. */
	idea_count: z.number().int().nonnegative().optional(),
	/** Of those, how many were taught by the end of that class. */
	ideas_taught: z.number().int().nonnegative().optional(),
	/** Ideas missed and not yet closed by warm-ups. */
	open_gaps: z.number().int().nonnegative().optional(),
	/** When the next of those comes back as a warm-up. Absent with none open. */
	next_due_at: isoDateTime.optional()
})
export const listTopicsResponse = z.object({
	topics: z.array(listedTopicSchema)
})

/** Two scores from one class: the explanation, and where the class left it. */
const scoreSchema = z.object({
	correct: z.number().int().nonnegative(),
	total: z.number().int().nonnegative()
})

/** An idea the person missed in this video, and where it stands on the warm-up schedule. */
export const topicGapSchema = z.object({
	id: uuid,
	concept_title: z.string(),
	/** Null when the idea came from pasted text and has no moment in a video. */
	start_seconds: z.number().int().nonnegative().nullable(),
	closed: z.boolean(),
	/** When it comes back as a warm-up; null once closed. */
	next_due_at: isoDateTime.nullable(),
	/**
	 * Taught in the latest class, in the explanation or when a student asked: still open
	 * until warm-ups show it stuck.
	 */
	taught_last_class: z.boolean()
})

/** One video's page: its scores and its gaps, open ones first, soonest due first. */
export const getTopicGapsResponse = z.object({
	topic: z.object({ id: uuid, title: z.string(), youtube_id: z.string() }),
	/** When the latest finished class on it started; null before one has finished. */
	taught_at: isoDateTime.nullable(),
	explanation_score: scoreSchema.nullable(),
	/** Null until a class has been scored after it ended. */
	after_class_score: scoreSchema.nullable(),
	gaps: z.array(topicGapSchema)
})

export type Video = z.infer<typeof videoSchema>
export type KeyConcept = z.infer<typeof keyConceptSchema>
export type TopicSummary = z.infer<typeof topicSummarySchema>
export type ListedTopic = z.infer<typeof listedTopicSchema>
export type TopicGap = z.infer<typeof topicGapSchema>
export type TopicGaps = z.infer<typeof getTopicGapsResponse>
