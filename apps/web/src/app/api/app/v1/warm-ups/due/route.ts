import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { listDueWarmUps } from '@/server/warm-ups/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/app/v1/warm-ups/due: open gaps that are due, oldest first. */
export const GET = createAppRoute(endpoints.listDueWarmUps, async ({ user }) => ({
	body: { warm_ups: await listDueWarmUps(user.id) }
}))
