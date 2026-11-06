import { z } from 'zod'

// /api/app/v1/quiz: a day's quiz on ideas from videos the person has already taught.
//
// GET quiz → up to 5 questions in mixed formats, or none when they have taught too little.
//
// Every question carries the video's own line, shown after the answer, so a false statement
// or a wrong option never has the last word.

export const MAX_QUIZ_QUESTIONS = 5
export const MIN_QUIZ_QUESTIONS = 3

const questionFields = {
	id: z.string().min(1),
	topic_title: z.string(),
	concept_title: z.string(),
	/** The video's line for this idea, from the stored concept, never from the model. */
	quote: z.string(),
	/** Null when the idea came from pasted text and has no moment in a video. */
	start_seconds: z.number().int().nonnegative().nullable(),
	options: z.array(z.string().min(1)).min(2),
	right_index: z.number().int().nonnegative()
}

export const quizQuestionSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('fill_blank'),
		/** The quote either side of the removed word. */
		before: z.string(),
		after: z.string(),
		...questionFields
	}),
	z.object({
		type: z.literal('multiple_choice'),
		question: z.string().min(1),
		...questionFields
	}),
	z.object({
		type: z.literal('true_false'),
		statement: z.string().min(1),
		...questionFields
	})
])

export const quizResponse = z.object({
	questions: z.array(quizQuestionSchema).max(MAX_QUIZ_QUESTIONS),
	/** Ideas from the person's own videos, for the screen's shimmering background. */
	shimmer_words: z.array(z.string())
})

export type QuizQuestion = z.infer<typeof quizQuestionSchema>
export type QuizQuestionType = QuizQuestion['type']
export type DailyQuiz = z.infer<typeof quizResponse>
