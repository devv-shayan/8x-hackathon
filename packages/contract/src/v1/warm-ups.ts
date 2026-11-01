import { z } from 'zod'
import { isoDateTime, uuid } from './common'

// /api/app/v1/warm-ups: one in-character question about a due gap.
//
// GET  warm-ups/due        → open gaps that are due, oldest first
// POST warm-ups            → start one (or return the question already saved)
// POST warm-ups/{id}/answer → judge the person's own words and move the gap

export const MAX_WARM_UP_ANSWER_CHARS = 5000

const openWarmUpSchema = z.object({
	id: uuid,
	question: z.string(),
	student_name: z.string()
})

export const dueWarmUpSchema = z.object({
	gap_id: uuid,
	topic_title: z.string(),
	concept_title: z.string(),
	start_seconds: z.number().int().nonnegative(),
	/** Set when a question was already saved and is still unanswered. */
	open_warm_up: openWarmUpSchema.nullable()
})

export const dueWarmUpsResponse = z.object({
	warm_ups: z.array(dueWarmUpSchema)
})

export const startWarmUpBody = z.object({ gap_id: uuid }).strict()

export const warmUpSchema = z.object({
	id: uuid,
	gap_id: uuid,
	question: z.string(),
	student_name: z.string()
})

export const warmUpResponse = z.object({ warm_up: warmUpSchema })

export const warmUpParams = z.object({ id: uuid })

export const answerWarmUpBody = z
	.object({
		answer: z.string().trim().min(1).max(MAX_WARM_UP_ANSWER_CHARS)
	})
	.strict()

export const answerWarmUpResponse = z.object({
	is_right: z.boolean(),
	closed: z.boolean(),
	/** Null once the gap is closed. */
	next_due_at: isoDateTime.nullable()
})

export type DueWarmUp = z.infer<typeof dueWarmUpSchema>
export type WarmUp = z.infer<typeof warmUpSchema>
export type AnswerWarmUpResult = z.infer<typeof answerWarmUpResponse>
