import { endpoints } from '@app/contract'
import { createAppRoute, idConflict } from '@/server/api/app-route'
import { decodeCursor, nextCursor } from '@/server/api/cursor'
import { toWireItem } from '@/server/api/wire'
import { itemStore } from '@/server/db/items'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Without ?limit=, as many as the app's list read before it had pages.
const DEFAULT_LIMIT = 50

/** GET /api/app/v1/items: a page of the person's items, most recently updated first. */
export const GET = createAppRoute(endpoints.listItems, async ({ user, query }) => {
	const page = await itemStore.list(user.id, {
		limit: query.limit ?? DEFAULT_LIMIT,
		after: decodeCursor('items', query.cursor)
	})
	return {
		body: {
			items: page.rows.map(toWireItem),
			next_cursor: nextCursor('items', page.nextAfter)
		}
	}
})

/**
 * POST /api/app/v1/items: a new item, owned by the caller. 201 when made now; 200 with the
 * same item when its `id` was made by an earlier try; 409 when the id is not the caller's.
 */
export const POST = createAppRoute(endpoints.createItem, async ({ user, body }) => {
	const result = await itemStore.create(user.id, {
		id: body.id,
		name: body.name,
		owner: body.owner,
		summary: body.summary,
		status: body.status
	})
	if (result.outcome === 'conflict') throw idConflict()
	return {
		body: { item: toWireItem(result.row) },
		status: result.outcome === 'created' ? 201 : 200
	}
})
