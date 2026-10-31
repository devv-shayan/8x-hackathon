import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { startClass } from '@/server/classroom/class-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/app/v1/classes: starts a class, and the first student asks. */
export const POST = createAppRoute(endpoints.startClass, async ({ user, body }) => ({
	body: { class: await startClass(user.id, body.topic_id, body.explanation) },
	status: 201
}))
