import { z } from 'zod'
import { isoDateTime, nextCursor, pageQuery, uuid } from './common'

// GET /api/app/v1/activity: the person's activity feed, newest first,
// optionally for one of their items.

export const ACTIVITY_KINDS = ['milestone', 'comment', 'alert', 'review'] as const
export const activityKindSchema = z.enum(ACTIVITY_KINDS)

export const activityEntrySchema = z.object({
	id: uuid,
	item_id: uuid,
	kind: activityKindSchema,
	title: z.string(),
	detail: z.string().nullable(),
	created_at: isoDateTime
})

export const listActivityQuery = pageQuery.extend({ item_id: uuid.optional() })

export const listActivityResponse = z.object({
	activity: z.array(activityEntrySchema),
	next_cursor: nextCursor
})

export type ActivityEntry = z.infer<typeof activityEntrySchema>
