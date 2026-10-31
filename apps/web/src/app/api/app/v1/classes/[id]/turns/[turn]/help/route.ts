import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { helpWithTurn } from '@/server/classroom/class-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/app/v1/classes/:id/turns/:turn/help: explains a question privately, from the video. */
export const POST = createAppRoute(endpoints.getClassHelp, async ({ req, user, params }) => ({
	body: { help: await helpWithTurn(user.id, params.id, params.turn, req.signal) }
}))
