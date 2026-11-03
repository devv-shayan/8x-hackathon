import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { flagNotInVideo } from '@/server/classroom/class-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/app/v1/classes/:id/not-in-video: drops one idea from the person's results. */
export const POST = createAppRoute(endpoints.flagNotInVideo, async ({ user, params, body }) => ({
	body: { class: await flagNotInVideo(user.id, params.id, body.concept) }
}))
