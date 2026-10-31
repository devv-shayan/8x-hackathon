import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { openClass } from '@/server/classroom/class-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/app/v1/classes/open: the class left unfinished on a topic, to go back to. */
export const GET = createAppRoute(endpoints.openClass, async ({ user, query }) => ({
	body: { class: await openClass(user.id, query.topic_id) }
}))
