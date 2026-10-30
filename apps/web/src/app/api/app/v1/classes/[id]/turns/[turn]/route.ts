import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { answerTurn } from '@/server/classroom/class-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/app/v1/classes/:id/turns/:turn: answers a question, and the next student asks. */
export const POST = createAppRoute(endpoints.answerTurn, async ({ user, params, body }) => ({
	body: {
		class: await answerTurn(user.id, params.id, params.turn, body.outcome, body.answer)
	}
}))
