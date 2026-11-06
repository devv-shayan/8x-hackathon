import { endpoints } from '@app/contract'
import { QUIZ_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { createAppRoute } from '@/server/api/app-route'
import { buildDailyQuiz } from '@/server/quiz/ask'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** One model call, which can take a while when Gemini is busy. */
export const maxDuration = 60

/**
 * GET /api/app/v1/quiz: today's quiz on ideas from the caller's own videos. Nothing is saved:
 * the app holds the quiz and the person's score.
 */
export const GET = createAppRoute(endpoints.getDailyQuiz, async ({ user }) => {
	const quiz = await buildDailyQuiz(user.id)
	if (quiz.questions.length > 0) {
		await recordUserEvent(user.id, QUIZ_EVENTS.served, {
			path: '/api/app/v1/quiz',
			metadata: { question_count: quiz.questions.length }
		})
	}
	return { body: quiz }
})
