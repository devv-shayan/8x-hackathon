import { endpoints } from '@app/contract'
import { createAppRoute, idConflict, notFound } from '@/server/api/app-route'
import { decodeCursor, nextCursor } from '@/server/api/cursor'
import { fromIsoDate, toTaskState, toWireTask } from '@/server/api/wire'
import { taskStore } from '@/server/db/tasks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// An item's tasks came in one read before there were pages: keep that for all but the
// longest lists.
const DEFAULT_LIMIT = 100

/**
 * GET /api/app/v1/tasks?item_id=: a page of one of the person's items' tasks, oldest first.
 * 404 when the item is not theirs, so an empty list always means "no tasks".
 */
export const GET = createAppRoute(endpoints.listTasks, async ({ user, query }) => {
	const page = await taskStore.list(user.id, query.item_id, {
		limit: query.limit ?? DEFAULT_LIMIT,
		after: decodeCursor('tasks', query.cursor)
	})
	if (!page) throw notFound()
	return {
		body: {
			tasks: page.rows.map(toWireTask),
			next_cursor: nextCursor('tasks', page.nextAfter)
		}
	}
})

/**
 * POST /api/app/v1/tasks: a new task on one of the person's items (404 otherwise). The same
 * `id` rules as POST items: 201 made now, 200 made by an earlier try, 409 not the caller's.
 */
export const POST = createAppRoute(endpoints.createTask, async ({ user, body }) => {
	const result = await taskStore.create(user.id, {
		id: body.id,
		itemId: body.item_id,
		title: body.title,
		state: body.state && toTaskState(body.state),
		priority: body.priority,
		dueDate: body.due_date == null ? body.due_date : fromIsoDate(body.due_date)
	})
	if (result.outcome === 'item_not_found') throw notFound()
	if (result.outcome === 'conflict') throw idConflict()
	return {
		body: { task: toWireTask(result.row) },
		status: result.outcome === 'created' ? 201 : 200
	}
})
