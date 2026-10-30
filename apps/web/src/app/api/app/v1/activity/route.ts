import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { decodeCursor, nextCursor } from '@/server/api/cursor'
import { toWireActivity } from '@/server/api/wire'
import { feedStore } from '@/server/db/feed'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The app's feed showed the latest 20 before there were pages.
const DEFAULT_LIMIT = 20

/** GET /api/app/v1/activity: a page of the person's activity, newest first, optionally for one item. */
export const GET = createAppRoute(endpoints.listActivity, async ({ user, query }) => {
	const page = await feedStore.activity(user.id, {
		itemId: query.item_id,
		limit: query.limit ?? DEFAULT_LIMIT,
		after: decodeCursor('activity', query.cursor)
	})
	return {
		body: {
			activity: page.rows.map(toWireActivity),
			next_cursor: nextCursor('activity', page.nextAfter)
		}
	}
})
