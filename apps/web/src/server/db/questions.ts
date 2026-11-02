import type { PrismaClient } from '@prisma/client'
import { db } from './client'

// The text of a question a student asked, for speaking it aloud. Found by id and only among
// the caller's own students, so a question that isn't theirs reads as not there. A failed
// query throws.

export type SpokenQuestion = { question: string; studentName: string }

const QUESTION = { question: true, student: { select: { name: true } } } as const

type QuestionRow = { question: string; student: { name: string } }

function toQuestion(row: QuestionRow | null): SpokenQuestion | null {
	return row ? { question: row.question, studentName: row.student.name } : null
}

export function createQuestionStore(client: Pick<PrismaClient, 'classTurn' | 'warmUp'>) {
	return {
		async forTurn(userId: string, classId: string, turnId: string) {
			const row = await client.classTurn.findFirst({
				where: { id: turnId, classId, student: { userId } },
				select: QUESTION
			})
			return toQuestion(row)
		},

		async forWarmUp(userId: string, warmUpId: string) {
			const row = await client.warmUp.findFirst({
				where: { id: warmUpId, student: { userId } },
				select: QUESTION
			})
			return toQuestion(row)
		}
	}
}

export type QuestionStore = ReturnType<typeof createQuestionStore>

export const questionStore = createQuestionStore(db)
