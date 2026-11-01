import { z } from 'zod'
import { uuid } from './common'

// /api/app/v1/classes: teaching a video to the AI students.
//
// POST classes                     → start a class from an explanation; each student raises
//                                    a hand with a question
// POST classes/{id}/turns/{turn} → answer or skip a question; that student raises a hand
//                                    again, until the class is finished
// POST classes/{id}/turns/{turn}/help → a private explanation of that question from the video
// GET classes/open?topic_id=       → the class left unfinished on a topic, or null
// POST classes/{id}/end            → end the class, dropping the questions nobody picked

export const MAX_CLASS_QUESTIONS = 4

/** Short enough that "hi" cannot start a class; long enough for a few sentences. */
export const MIN_EXPLANATION_LENGTH = 40

export const TURN_OUTCOMES = ['answered', 'needed_help', 'skipped'] as const
export const turnOutcomeSchema = z.enum(TURN_OUTCOMES)

export const classStudentSchema = z.object({
	id: uuid,
	name: z.string(),
	persona: z.string()
})

export const classTurnSchema = z.object({
	id: uuid,
	student_id: uuid,
	question: z.string(),
	answer: z.string().nullable(),
	outcome: turnOutcomeSchema.nullable()
})

export const CONCEPT_RESULTS = ['correct', 'missed', 'wrong'] as const
export const conceptResultSchema = z.object({
	concept: z.string(),
	result: z.enum(CONCEPT_RESULTS),
	/** From the stored key concept; null only if that concept no longer has a timestamp. */
	start_seconds: z.number().int().nonnegative().nullable()
})

export const classSchema = z.object({
	id: uuid,
	topic_id: uuid,
	students: z.array(classStudentSchema),
	turns: z.array(classTurnSchema),
	finished: z.boolean(),
	/**
	 * Null while the class is still open: scoring stays hidden until it ends.
	 * Filled on a finished class for the assessment screen.
	 */
	concept_results: z.array(conceptResultSchema).nullable()
})

export const classResponse = z.object({ class: classSchema })

export const openClassQuery = z.object({ topic_id: uuid })
export const openClassResponse = z.object({ class: classSchema.nullable() })

export const startClassBody = z
	.object({
		topic_id: uuid,
		explanation: z.string().trim().min(MIN_EXPLANATION_LENGTH).max(20000)
	})
	.strict()

export const classParams = z.object({ id: uuid })

export const classHelpBody = z.object({}).strict()

export const classHelpResponse = z.object({
	help: z.object({
		explanation: z.string(),
		start_seconds: z.number().int().nonnegative().nullable()
	})
})

export const endClassBody = z.object({}).strict()

export const classTurnParams = z.object({ id: uuid, turn: uuid })

export const answerTurnBody = z
	.object({ outcome: turnOutcomeSchema, answer: z.string().trim().min(1).max(5000).optional() })
	.strict()
	.refine((body) => body.outcome === 'skipped' || body.answer !== undefined, {
		message: 'An answer is needed unless the question is skipped.',
		path: ['answer']
	})

export type ClassHelp = z.infer<typeof classHelpResponse>['help']
export type ClassSession = z.infer<typeof classSchema>
export type ClassTurn = z.infer<typeof classTurnSchema>
export type ClassStudent = z.infer<typeof classStudentSchema>
export type ConceptResult = z.infer<typeof conceptResultSchema>
export type TurnOutcome = z.infer<typeof turnOutcomeSchema>
