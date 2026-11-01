import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { answerWarmUp } from '@/server/warm-ups/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/app/v1/warm-ups/:id/answer: judges the answer and moves the gap. */
export const POST = createAppRoute(endpoints.answerWarmUp, async ({ user, params, body }) => ({
	body: await answerWarmUp({ userId: user.id, warmUpId: params.id, answer: body.answer })
}))
