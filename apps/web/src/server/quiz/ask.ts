import 'server-only'
import { z } from 'zod'
import type { DailyQuiz } from '@app/contract'
import { generateContent } from '@/server/ai/gemini'
import { ApiError } from '@/server/api/app-errors'
import { topicStore } from '@/server/db/topics'
import { AI_BUSY, toVideoError } from '@/server/video/read-video'
import {
	QUIZ_INSTRUCTION,
	QUIZ_RESPONSE_JSON_SCHEMA,
	assembleQuiz,
	buildQuizPrompt,
	enoughForQuiz,
	pickIdeas,
	planQuiz,
	shimmerWords,
	type PlannedQuestion
} from './quiz'

const QUIZ_MODEL = 'gemini-3.5-flash-lite'
const QUIZ_TEMPERATURE = 0.7
const QUIZ_FAILED = "We couldn't write today's quiz. Try again."

async function writeQuiz(planned: readonly PlannedQuestion[]): Promise<string | undefined> {
	try {
		const response = await generateContent(
			{ feature: 'daily_quiz', model: QUIZ_MODEL, meta: { questions: planned.length } },
			{
				contents: buildQuizPrompt(planned),
				systemInstruction: QUIZ_INSTRUCTION,
				temperature: QUIZ_TEMPERATURE,
				responseMimeType: 'application/json',
				responseJsonSchema: QUIZ_RESPONSE_JSON_SCHEMA
			}
		)
		return response.text
	} catch (error) {
		throw toVideoError(error, AI_BUSY)
	}
}

/** A quiz on the person's own ideas, or none when they have taught too little for one. */
export async function buildDailyQuiz(userId: string): Promise<DailyQuiz> {
	const ideas = pickIdeas(await topicStore.listConcepts(userId), Math.random)
	if (!enoughForQuiz(ideas.length)) return { questions: [], shimmer_words: [] }

	const planned = planQuiz(ideas, Math.random)
	const raw = await writeQuiz(planned)
	try {
		const questions = assembleQuiz(planned, raw, Math.random)
		if (!enoughForQuiz(questions.length)) throw new ApiError('unavailable', QUIZ_FAILED)
		return { questions, shimmer_words: shimmerWords(ideas) }
	} catch (error) {
		if (error instanceof SyntaxError || error instanceof z.ZodError) {
			throw new ApiError('unavailable', QUIZ_FAILED, { cause: error })
		}
		throw error
	}
}
