import type { PrismaClient, TurnOutcome } from '@prisma/client'
import { parseStoredReactions, type StoredReaction } from '@/server/classroom/reactions'
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
	reactions: true,
	turns: { orderBy: { createdAt: 'asc' } }
} as const

function withResults<T extends { conceptResults: unknown; reactions: unknown }>(row: T) {
	return {
		...row,
		conceptResults: parseStoredConceptResults(row.conceptResults),
		reactions: parseStoredReactions(row.reactions)
	}
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

		/** Closing lines after the class. Best effort: only write once. */
		async saveReactions(classId: string, reactions: StoredReaction[]) {
			if (demoMemory.hasClass(classId)) {
				demoMemory.saveReactions(classId, reactions)
				return
			}
			await client.class.update({
				where: { id: classId },
				data: { reactions }
			})
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

		/**
		 * Newest unfinished class id per topic, for Home's recent list.
		 * One query for the whole list — never N× findOpen.
		 */
		/**
		 * The latest finished class on each of these topics (no question left open), with its
		 * results and when it started. Topics with none are left out.
		 */
		async latestFinishedForTopics(
			userId: string,
			topicIds: string[]
		): Promise<Map<string, { conceptResults: ConceptResult[]; createdAt: Date }>> {
			const latest = new Map<string, { conceptResults: ConceptResult[]; createdAt: Date }>()
			if (topicIds.length === 0 || isLocalDemoUser(userId)) return latest
			const rows = await client.class.findMany({
				where: {
					topicId: { in: topicIds },
					topic: { userId },
					turns: { none: { outcome: null } }
				},
				orderBy: { createdAt: 'desc' },
				select: { topicId: true, conceptResults: true, createdAt: true }
			})
			for (const row of rows) {
				if (latest.has(row.topicId)) continue
				latest.set(row.topicId, {
					conceptResults: parseStoredConceptResults(row.conceptResults),
					createdAt: row.createdAt
				})
			}
			return latest
		},

		async findOpenIdsForTopics(userId: string, topicIds: string[]): Promise<Map<string, string>> {
			const open = new Map<string, string>()
			if (topicIds.length === 0) return open
			if (isLocalDemoUser(userId)) {
				for (const topicId of topicIds) {
					const row = demoMemory.findOpenClass(userId, topicId)
					if (row) open.set(topicId, row.id)
				}
				return open
			}
			const rows = await client.class.findMany({
				where: {
					topicId: { in: topicIds },
					topic: { userId },
					turns: { some: { outcome: null } }
				},
				orderBy: { createdAt: 'desc' },
				select: { id: true, topicId: true }
			})
			for (const row of rows) {
				if (!open.has(row.topicId)) open.set(row.topicId, row.id)
			}
			return open
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
