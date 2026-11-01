import type { PrismaClient, TurnOutcome } from '@prisma/client'
import { parseStoredConceptResults, type ConceptResult } from '@/server/classroom/score-explanation'
import { demoMemory, isLocalDemoUser } from '@/server/demo/local-demo'
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

function withResults<T extends { conceptResults: unknown }>(row: T) {
	return { ...row, conceptResults: parseStoredConceptResults(row.conceptResults) }
}

export function createClassStore(client: Pick<PrismaClient, 'class' | 'classTurn' | 'student'>) {
	return {
		/** The person's students, created the first time they teach. */
		async studentsFor(userId: string, defaults: { name: string; persona: string }[]) {
			if (isLocalDemoUser(userId)) return demoMemory.studentsFor(userId, defaults)
			const students = await client.student.findMany({
				where: { userId },
				orderBy: { createdAt: 'asc' }
			})
			if (students.length > 0) return students
			await client.student.createMany({ data: defaults.map((d) => ({ userId, ...d })) })
			return client.student.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
		},

		async create(topicId: string, explanation: string, conceptResults: ConceptResult[]) {
			if (demoMemory.hasTopic(topicId)) {
				return demoMemory.createClass(topicId, explanation, conceptResults)
			}
			const row = await client.class.create({
				data: { topicId, explanation, conceptResults },
				select: CLASS
			})
			return withResults(row)
		},

		/** For a class that couldn't be scored when it started. */
		async saveConceptResults(classId: string, conceptResults: ConceptResult[]) {
			await client.class.update({ where: { id: classId }, data: { conceptResults } })
		},

		async find(userId: string, classId: string) {
			if (isLocalDemoUser(userId)) return demoMemory.findClass(userId, classId)
			const row = await client.class.findFirst({
				where: { id: classId, topic: { userId } },
				select: CLASS
			})
			return row && withResults(row)
		},

		/** The newest class on this topic still waiting on an answer, or null. */
		async findOpen(userId: string, topicId: string) {
			if (isLocalDemoUser(userId)) return demoMemory.findOpenClass(userId, topicId)
			const row = await client.class.findFirst({
				where: { topicId, topic: { userId }, turns: { some: { outcome: null } } },
				orderBy: { createdAt: 'desc' },
				select: CLASS
			})
			return row && withResults(row)
		},

		addTurn(classId: string, studentId: string, question: string) {
			if (demoMemory.hasClass(classId)) {
				demoMemory.addTurn(classId, studentId, question)
				return
			}
			return client.classTurn.create({ data: { classId, studentId, question } })
		},

		/** Changes a question the person hasn't dealt with yet. */
		async updateQuestion(turnId: string, question: string) {
			if (demoMemory.updateQuestion(turnId, question)) return
			await client.classTurn.updateMany({
				where: { id: turnId, outcome: null },
				data: { question }
			})
		},

		/** False when the turn isn't an unanswered question in this class. */
		async answerTurn(
			classId: string,
			turnId: string,
			answer: { answer: string | null; outcome: TurnOutcome }
		) {
			if (demoMemory.hasClass(classId)) {
				return demoMemory.answerTurn(classId, turnId, answer)
			}
			const { count } = await client.classTurn.updateMany({
				where: { id: turnId, classId, outcome: null },
				data: { ...answer, answeredAt: new Date() }
			})
			return count > 0
		},

		/** Records that the person was given help on a question still waiting on an answer. */
		async markHelpUsed(classId: string, turnId: string) {
			if (demoMemory.hasClass(classId)) {
				demoMemory.markHelpUsed(classId, turnId)
				return
			}
			await client.classTurn.updateMany({
				where: { id: turnId, classId, outcome: null },
				data: { helpUsedAt: new Date() }
			})
		},

		/** Removes the questions the person never picked. */
		async dropOpenTurns(classId: string) {
			if (demoMemory.hasClass(classId)) {
				demoMemory.dropOpenTurns(classId)
				return
			}
			await client.classTurn.deleteMany({ where: { classId, outcome: null } })
		},

		/**
		 * What these students last talked about with the person, in earlier classes on this topic.
		 * A question nobody picked was never heard, so it isn't part of that.
		 */
		pastTurns(studentIds: string[], classId: string, topicId: string) {
			if (demoMemory.hasClass(classId) || demoMemory.hasTopic(topicId)) {
				return demoMemory.pastTurns()
			}
			return client.classTurn.findMany({
				where: {
					studentId: { in: studentIds },
					classId: { not: classId },
					class: { topicId },
					outcome: { not: null }
				},
				orderBy: { createdAt: 'desc' },
				take: PAST_TURNS_LIMIT
			})
		}
	}
}

export type ClassStore = ReturnType<typeof createClassStore>

export const classStore = createClassStore(db)
