import type { PrismaClient } from '@prisma/client'
import { ApiError } from '@/server/api/app-errors'
import { keyConceptSchema, type KeyConcept } from '@/server/video/key-concepts'
import { transcriptSegmentSchema, type TranscriptSegment } from '@/server/video/transcript'
import type { ScheduledGap } from '@/server/gaps/schedule'
import { db } from './client'
import { rememberOpeningMark } from './memory-reminders'

// The person's due gaps and the warm-ups asked about them. Every method takes
// the user id the route verified. A failed query throws; an empty due list is
// only what the database returned.

const PAST_EXCHANGE_LIMIT = 4

const WARM_UP = {
	id: true,
	gapId: true,
	question: true,
	student: { select: { name: true } }
} as const

export type StoredWarmUp = {
	id: string
	gapId: string
	question: string
	studentName: string
}

export type DueGapRecord = {
	id: string
	topicId: string
	topicTitle: string
	concept: KeyConcept
	openWarmUp: StoredWarmUp | null
}

export type GapForWarmUp = {
	id: string
	topicId: string
	rightStreak: number
	nextDueAt: Date
	closedAt: Date | null
	concept: KeyConcept
	segments: TranscriptSegment[]
}

export type WarmUpForAnswer = {
	id: string
	gapId: string
	question: string
	answer: string | null
	isRight: boolean | null
	rightStreak: number
	closedAt: Date | null
	concept: KeyConcept
	segments: TranscriptSegment[]
}

type WarmUpRow = {
	id: string
	gapId: string
	question: string
	student: { name: string }
}

function toWarmUp(row: WarmUpRow): StoredWarmUp {
	return {
		id: row.id,
		gapId: row.gapId,
		question: row.question,
		studentName: row.student.name
	}
}

export function createWarmUpStore(client: PrismaClient) {
	return {
		/** Open gaps whose due time has arrived, oldest first. */
		async listDue(userId: string, now: Date): Promise<DueGapRecord[]> {
			const rows = await client.gap.findMany({
				where: { userId, closedAt: null, nextDueAt: { lte: now } },
				orderBy: [{ nextDueAt: 'asc' }, { createdAt: 'asc' }],
				select: {
					id: true,
					topicId: true,
					concept: true,
					topic: { select: { title: true } },
					warmUps: {
						where: { answer: null, isRight: null },
						orderBy: { createdAt: 'asc' },
						take: 1,
						select: WARM_UP
					}
				}
			})
			return rows.map((row) => ({
				id: row.id,
				topicId: row.topicId,
				topicTitle: row.topic.title,
				concept: keyConceptSchema.parse(row.concept),
				openWarmUp: row.warmUps[0] ? toWarmUp(row.warmUps[0]) : null
			}))
		},

		/** One of the person's gaps, with the transcript the question is written from. */
		async findGap(userId: string, gapId: string): Promise<GapForWarmUp | null> {
			const row = await client.gap.findFirst({
				where: { id: gapId, userId },
				select: {
					id: true,
					topicId: true,
					rightStreak: true,
					nextDueAt: true,
					closedAt: true,
					concept: true,
					topic: { select: { segments: true } }
				}
			})
			if (!row) return null
			return {
				id: row.id,
				topicId: row.topicId,
				rightStreak: row.rightStreak,
				nextDueAt: row.nextDueAt,
				closedAt: row.closedAt,
				concept: keyConceptSchema.parse(row.concept),
				segments: transcriptSegmentSchema.array().parse(row.topic.segments)
			}
		},

		/** The unanswered question already saved for this gap, if there is one. */
		async findOpen(gapId: string): Promise<StoredWarmUp | null> {
			const row = await client.warmUp.findFirst({
				where: { gapId, answer: null, isRight: null },
				orderBy: { createdAt: 'asc' },
				select: WARM_UP
			})
			return row ? toWarmUp(row) : null
		},

		/**
		 * Saves the question, unless an unanswered one was saved while this was
		 * being written. The loser keeps the one already stored.
		 */
		async saveQuestion(input: {
			gapId: string
			studentId: string
			question: string
		}): Promise<{ warmUp: StoredWarmUp; created: boolean }> {
			return client.$transaction(async (tx) => {
				const existing = await tx.warmUp.findFirst({
					where: { gapId: input.gapId, answer: null, isRight: null },
					orderBy: { createdAt: 'asc' },
					select: WARM_UP
				})
				if (existing) return { warmUp: toWarmUp(existing), created: false }
				const row = await tx.warmUp.create({
					data: {
						gapId: input.gapId,
						studentId: input.studentId,
						question: input.question
					},
					select: WARM_UP
				})
				return { warmUp: toWarmUp(row), created: true }
			})
		},

		/** The student who last spoke in a class on this topic, or null. */
		async rememberedStudent(userId: string, topicId: string) {
			const turn = await client.classTurn.findFirst({
				where: {
					outcome: { not: null },
					student: { userId },
					class: { topicId, topic: { userId } }
				},
				orderBy: { createdAt: 'desc' },
				select: { student: { select: { id: true, name: true, persona: true } } }
			})
			return turn?.student ?? null
		},

		/** What this student and the person already said about this video, oldest last-few first. */
		async pastExchanges(studentId: string, topicId: string) {
			const turns = await client.classTurn.findMany({
				where: { studentId, outcome: { not: null }, class: { topicId } },
				orderBy: { createdAt: 'desc' },
				take: PAST_EXCHANGE_LIMIT,
				select: { question: true, answer: true }
			})
			return turns.reverse()
		},

		async findForAnswer(userId: string, warmUpId: string): Promise<WarmUpForAnswer | null> {
			const row = await client.warmUp.findFirst({
				where: { id: warmUpId, gap: { userId } },
				select: {
					id: true,
					question: true,
					answer: true,
					isRight: true,
					gap: {
						select: {
							id: true,
							rightStreak: true,
							closedAt: true,
							concept: true,
							topic: { select: { segments: true } }
						}
					}
				}
			})
			if (!row) return null
			return {
				id: row.id,
				gapId: row.gap.id,
				question: row.question,
				answer: row.answer,
				isRight: row.isRight,
				rightStreak: row.gap.rightStreak,
				closedAt: row.gap.closedAt,
				concept: keyConceptSchema.parse(row.gap.concept),
				segments: transcriptSegmentSchema.array().parse(row.gap.topic.segments)
			}
		},

		/**
		 * Writes the judgment and moves the gap together. A concurrent answer
		 * or a gap that closed in between leaves the row unchanged.
		 */
		async saveJudgment(input: {
			userId: string
			warmUpId: string
			answer: string
			isRight: boolean
			schedule: ScheduledGap
		}): Promise<'saved' | 'missing' | 'answered'> {
			const { userId, warmUpId, answer, isRight, schedule } = input
			let openingGapId: string | null = null
			const outcome = await client.$transaction(async (tx) => {
				const row = await tx.warmUp.findFirst({
					where: { id: warmUpId, gap: { userId } },
					select: {
						id: true,
						answer: true,
						isRight: true,
						gapId: true,
						gap: { select: { closedAt: true } }
					}
				})
				if (!row) return 'missing'
				if (row.answer != null || row.isRight != null) return 'answered'
				if (row.gap.closedAt) {
					throw new ApiError('conflict', 'That gap is already closed.')
				}
				const claimed = await tx.warmUp.updateMany({
					where: { id: row.id, answer: null, isRight: null },
					data: { answer, isRight }
				})
				if (claimed.count === 0) return 'answered'
				const moved = await tx.gap.updateMany({
					where: { id: row.gapId, userId, closedAt: null },
					data: {
						rightStreak: schedule.rightStreak,
						nextDueAt: schedule.nextDueAt,
						closedAt: schedule.closedAt
					}
				})
				if (moved.count === 0) {
					throw new ApiError('conflict', 'That gap is already closed.')
				}
				// A closed gap is done. An open one starts full: that mark is the answer
				// they just gave, so it is not a reminder.
				if (schedule.closedAt == null) openingGapId = row.gapId
				return 'saved' as const
			})
			if (outcome === 'saved' && openingGapId) {
				await rememberOpeningMark(client, {
					gapId: openingGapId,
					userId,
					dueAt: schedule.nextDueAt,
					at: new Date()
				})
			}
			return outcome
		}
	}
}

export type WarmUpStore = ReturnType<typeof createWarmUpStore>

export const warmUpStore = createWarmUpStore(db)
