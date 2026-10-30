import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { decodeCursor, nextCursor } from '@/server/api/cursor'
import { toWireNotification } from '@/server/api/wire'
import { feedStore } from '@/server/db/feed'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The app's inbox showed the latest 50 before there were pages.
const DEFAULT_LIMIT = 50

/** GET /api/app/v1/notifications: a page of the person's notifications, newest first. */
export const GET = createAppRoute(endpoints.listNotifications, async ({ user, query }) => {
	const page = await feedStore.notifications(user.id, {
		limit: query.limit ?? DEFAULT_LIMIT,
		after: decodeCursor('notifications', query.cursor)
	})
	return {
		body: {
			notifications: page.rows.map(toWireNotification),
			next_cursor: nextCursor('notifications', page.nextAfter)
		}
	}
})
