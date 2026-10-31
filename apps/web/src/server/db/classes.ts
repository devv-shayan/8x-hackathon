import type { PrismaClient, TurnOutcome } from '@prisma/client'
import { db } from './client'

// The person's classes and students (prisma/schema/learning.prisma). Every method takes the
// user id the route verified (requireUser), and a class belongs to them through its topic.

const PAST_TURNS_LIMIT = 6

const CLASS = {
	id: true,
	topicId: true,
	explanation: true,
	conceptResults: true,
	turns: { orderBy: { createdAt: 'asc' } }
} as const

export function createClassStore(client: Pick<PrismaClient, 'class' | 'classTurn' | 'student'>) {
	return {
		/** The person's students, created the first time they teach. */
		async studentsFor(userId: string, defaults: { name: string; persona: string }[]) {
			const students = await client.student.findMany({
				where: { userId },
				orderBy: { createdAt: 'asc' }
			})
			if (students.length > 0) return students
			await client.student.createMany({ data: defaults.map((d) => ({ userId, ...d })) })
			return client.student.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
		},

		create(topicId: string, explanation: string) {
			return client.class.create({
				data: { topicId, explanation, conceptResults: [] },
				select: CLASS
			})
		},

		find(userId: string, classId: string) {
			return client.class.findFirst({
				where: { id: classId, topic: { userId } },
				select: CLASS
			})
		},

		addTurn(classId: string, studentId: string, question: string) {
			return client.classTurn.create({ data: { classId, studentId, question } })
		},

		/** False when the turn isn't an unanswered question in this class. */
		async answerTurn(
			classId: string,
			turnId: string,
			answer: { answer: string | null; outcome: TurnOutcome }
		) {
			const { count } = await client.classTurn.updateMany({
				where: { id: turnId, classId, outcome: null },
				data: answer
			})
			return count > 0
		},

		/** What these students last talked about with the person, in earlier classes. */
		pastTurns(studentIds: string[], classId: string) {
			return client.classTurn.findMany({
				where: { studentId: { in: studentIds }, classId: { not: classId } },
				orderBy: { createdAt: 'desc' },
				take: PAST_TURNS_LIMIT
			})
		}
	}
}

export type ClassStore = ReturnType<typeof createClassStore>

export const classStore = createClassStore(db)
