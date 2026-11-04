import type { Prisma, PrismaClient } from '@prisma/client'
import { keyConceptSchema } from '@/server/video/key-concepts'
import { dayMark } from '@/server/memory/reminders'
import type { ReminderCandidate } from '@/server/memory/reminders'
import { log } from '@/server/lib/logger'
import { db } from './client'

// Opening marks and the rows the daily reminder job reads. Every write stays
// in this folder (docs/rules/database.md).

type MarkDb = Pick<PrismaClient, 'memoryMark'> | Prisma.TransactionClient

function utcDay(date: Date): string {
	return date.toISOString().slice(0, 10)
}

/** Records the mark that exists the moment a due date is set, so it is not pushed. */
export async function recordOpeningMark(
	client: MarkDb,
	input: { gapId: string; userId: string; dueAt: Date; at: Date }
): Promise<void> {
	const stage = dayMark(input.dueAt, input.at)
	if (stage > 5) return
	await client.memoryMark.upsert({
		where: {
			gapId_dueAt_stage: { gapId: input.gapId, dueAt: input.dueAt, stage }
		},
		create: {
			gapId: input.gapId,
			userId: input.userId,
			dueAt: input.dueAt,
			stage,
			sentAt: null
		},
		update: {}
	})
}

/**
 * Records the opening mark after the gap itself has been saved. A failure here
 * is logged and dropped: teaching a class and answering a warm-up must succeed
 * even when the reminder tables are not in this database yet.
 */
export async function rememberOpeningMark(
	client: MarkDb,
	input: { gapId: string; userId: string; dueAt: Date; at: Date }
): Promise<void> {
	try {
		await recordOpeningMark(client, input)
	} catch (err) {
		log.error('could not record the opening memory mark', {
			source: 'memory-reminders',
			err
		})
	}
}

export type ReminderSend = {
	gapId: string
	userId: string
	dueAt: Date
	stage: number
	stagesToRecord: readonly number[]
}

export function createMemoryReminderStore(client: PrismaClient) {
	return {
		/** Keeps one token per device. A phone that signs into another account moves with it. */
		async saveToken(input: { userId: string; token: string; platform: 'ios' | 'android' }) {
			await client.pushToken.upsert({
				where: { token: input.token },
				create: input,
				update: { userId: input.userId, platform: input.platform }
			})
		},

		async deleteTokens(tokens: readonly string[]) {
			if (tokens.length === 0) return
			await client.pushToken.deleteMany({ where: { token: { in: [...tokens] } } })
		},

		/** Open gaps, with the marks for their current due date and the person's tokens. */
		async candidates(now: Date): Promise<ReminderCandidate[]> {
			const today = utcDay(now)
			const gaps = await client.gap.findMany({
				where: { closedAt: null },
				select: {
					id: true,
					userId: true,
					nextDueAt: true,
					concept: true,
					memoryMarks: { select: { dueAt: true, stage: true, sentAt: true } },
					profile: { select: { pushTokens: { select: { token: true } } } }
				}
			})
			const sentToday = new Set<string>()
			for (const gap of gaps) {
				if (gap.memoryMarks.some((mark) => mark.sentAt && utcDay(mark.sentAt) === today)) {
					sentToday.add(gap.userId)
				}
			}
			const rows: ReminderCandidate[] = []
			for (const gap of gaps) {
				const concept = keyConceptSchema.safeParse(gap.concept)
				if (!concept.success) continue
				rows.push({
					gapId: gap.id,
					userId: gap.userId,
					conceptTitle: concept.data.title,
					dueAt: gap.nextDueAt,
					handledStages: gap.memoryMarks
						.filter((mark) => mark.dueAt.getTime() === gap.nextDueAt.getTime())
						.map((mark) => mark.stage),
					sentToday: sentToday.has(gap.userId),
					tokens: gap.profile.pushTokens.map((push) => push.token)
				})
			}
			return rows
		},

		/** Records the mark that was sent, and the days a missed run skipped past. */
		async recordSends(sends: readonly ReminderSend[], sentAt: Date) {
			if (sends.length === 0) return
			await client.memoryMark.createMany({
				data: sends.flatMap((send) =>
					send.stagesToRecord.map((stage) => ({
						gapId: send.gapId,
						userId: send.userId,
						dueAt: send.dueAt,
						stage,
						sentAt: stage === send.stage ? sentAt : null
					}))
				),
				skipDuplicates: true
			})
		}
	}
}

export type MemoryReminderStore = ReturnType<typeof createMemoryReminderStore>

export const memoryReminderStore = createMemoryReminderStore(db)
