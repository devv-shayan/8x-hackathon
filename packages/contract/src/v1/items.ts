import { z } from 'zod'
import { isoDateTime, nextCursor, pageQuery, uuid } from './common'

// /api/app/v1/items: the person's own items, never another's.
//
// GET items          → a page, newest update first
// GET items/{id}     → one item; 404 when it isn't the person's or is deleted
// POST items         → create one. An `id` the device generated makes a retry
//                      safe: the same id again returns the row it created (200),
//                      and an id that belongs to someone else is a 409.

export const ITEM_STATUSES = ['active', 'pending', 'archived'] as const
export const itemStatusSchema = z.enum(ITEM_STATUSES)

export const itemSchema = z.object({
	id: uuid,
	name: z.string(),
	owner: z.string(),
	status: itemStatusSchema,
	completion: z.number().int().min(0).max(100),
	health: z.number().int().min(0).max(100),
	active_users: z.number().int().min(0),
	summary: z.string().nullable(),
	created_at: isoDateTime,
	updated_at: isoDateTime
})

export const listItemsQuery = pageQuery

export const listItemsResponse = z.object({
	items: z.array(itemSchema),
	next_cursor: nextCursor
})

export const itemParams = z.object({ id: uuid })

export const itemResponse = z.object({ item: itemSchema })

export const createItemBody = z
	.object({
		id: uuid.optional(),
		name: z.string().trim().min(1).max(120),
		owner: z.string().trim().max(80).optional(),
		summary: z.string().trim().max(2000).nullable().optional(),
		status: itemStatusSchema.optional()
	})
	.strict()

export type Item = z.infer<typeof itemSchema>
export type CreateItemBody = z.infer<typeof createItemBody>
