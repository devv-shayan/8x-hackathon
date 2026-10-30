import { z } from 'zod'
import { uuid } from './common'

// /api/app/v1/classes: teaching a video to the AI students.
//
// POST classes                     → start a class from an explanation; the first student asks
// POST classes/{id}/turns/{turn} → answer or skip a question; the next student asks, until
//                                    the class is finished

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

export const classSchema = z.object({
	id: uuid,
	topic_id: uuid,
	students: z.array(classStudentSchema),
	turns: z.array(classTurnSchema),
	finished: z.boolean()
})

export const classResponse = z.object({ class: classSchema })

export const startClassBody = z
	.object({ topic_id: uuid, explanation: z.string().trim().min(1).max(20000) })
	.strict()

export const classTurnParams = z.object({ id: uuid, turn: uuid })

export const answerTurnBody = z
	.object({ outcome: turnOutcomeSchema, answer: z.string().trim().min(1).max(5000).optional() })
	.strict()
	.refine((body) => body.outcome === 'skipped' || body.answer !== undefined, {
		message: 'An answer is needed unless the question is skipped.',
		path: ['answer']
	})

export type ClassSession = z.infer<typeof classSchema>
export type ClassTurn = z.infer<typeof classTurnSchema>
export type ClassStudent = z.infer<typeof classStudentSchema>
export type TurnOutcome = z.infer<typeof turnOutcomeSchema>
