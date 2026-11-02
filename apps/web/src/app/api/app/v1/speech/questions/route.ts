import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { speakQuestion, speechDeps } from '@/server/speech/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/app/v1/speech/questions: a class or warm-up question, spoken by the student who
 * asks it. The app names the question by id; the server finds its text, only among the
 * caller's own students, so this never speaks text the app sends.
 */
export const POST = createAppRoute(endpoints.speakQuestion, async ({ user, body }) => {
	return { body: await speakQuestion(speechDeps, user.id, body) }
})
