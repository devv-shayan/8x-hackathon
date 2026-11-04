import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { getClass } from '@/server/classroom/class-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/classes/:id: one of the person's classes as it stands now, open or finished.
 * The app reads it when an answer timed out, to see whether the server recorded it after all.
 * Anyone else's class is a 404.
 */
export const GET = createAppRoute(endpoints.getClass, async ({ user, params }) => ({
	body: { class: await getClass(user.id, params.id) }
}))
