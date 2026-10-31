import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { endClass } from '@/server/classroom/class-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/app/v1/classes/:id/end: ends the class before every question is answered. */
export const POST = createAppRoute(endpoints.endClass, async ({ user, params }) => ({
	body: { class: await endClass(user.id, params.id) }
}))
