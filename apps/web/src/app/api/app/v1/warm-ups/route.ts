import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { startWarmUp } from '@/server/warm-ups/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/app/v1/warm-ups: asks one question, or returns the one already saved. */
export const POST = createAppRoute(endpoints.startWarmUp, async ({ user, body }) => {
	const { warmUp, created } = await startWarmUp({ userId: user.id, gapId: body.gap_id })
	return { body: { warm_up: warmUp }, status: created ? 201 : 200 }
})
