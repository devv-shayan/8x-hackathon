import type { PrismaClient } from '@prisma/client'
import { keyConceptSchema } from '@/server/video/key-concepts'
import { pastClassSeed } from '@/server/gaps/seed'

// A past class with a gap that is already due, so a warm-up can be demoed
// without waiting two days. Running it again keeps the same topic and gap.

export async function seedDueGap(
	client: PrismaClient,
	input: { userId: string; now?: Date }
): Promise<{ topicId: string; gapId: string; created: boolean }> {
	const now = input.now ?? new Date()
	const plan = pastClassSeed(now)
	const { userId } = input

	return client.$transaction(async (tx) => {
		const profile = await tx.profile.findUnique({ where: { id: userId }, select: { id: true } })
		if (!profile) {
			throw new Error('No profile for that user. Sign in once, then run this again.')
		}

		const topic = await tx.topic.upsert({
			where: { userId_youtubeId: { userId, youtubeId: plan.youtubeId } },
			update: {},
			create: {
				userId,
				youtubeId: plan.youtubeId,
				title: plan.title,
				segments: plan.segments,
				concepts: plan.concepts
			},
			select: { id: true }
		})

		const existingStudent = await tx.student.findFirst({
			where: { userId, name: plan.student.name },
			select: { id: true }
		})
		const student =
			existingStudent ??
			(await tx.student.create({
				data: { userId, name: plan.student.name, persona: plan.student.persona },
				select: { id: true }
			}))

		const existingClass = await tx.class.findFirst({
			where: { topicId: topic.id },
			orderBy: { createdAt: 'asc' },
			select: { id: true }
		})
		const classRow =
			existingClass ??
			(await tx.class.create({
				data: {
					topicId: topic.id,
					explanation: plan.explanation,
					conceptResults: plan.conceptResults,
					createdAt: plan.foundAt
				},
				select: { id: true }
			}))

		const answered = await tx.classTurn.findFirst({
			where: { classId: classRow.id, outcome: { not: null } },
			select: { id: true }
		})
		if (!answered) {
			await tx.classTurn.create({
				data: {
					classId: classRow.id,
					studentId: student.id,
					question: plan.question,
					answer: plan.answer,
					outcome: 'answered',
					answeredAt: plan.foundAt,
					createdAt: plan.foundAt
				}
			})
		}

		const concept = plan.concepts[0]
		if (!concept) throw new Error('The seed concept is missing.')

		const open = await tx.gap.findFirst({
			where: { userId, topicId: topic.id, closedAt: null },
			select: { id: true, nextDueAt: true, concept: true }
		})
		if (open && keyConceptSchema.parse(open.concept).title === concept.title) {
			if (open.nextDueAt.getTime() > now.getTime()) {
				await tx.gap.update({
					where: { id: open.id },
					data: { nextDueAt: plan.nextDueAt }
				})
			}
			return { topicId: topic.id, gapId: open.id, created: false }
		}

		const gap = await tx.gap.create({
			data: {
				userId,
				topicId: topic.id,
				concept,
				nextDueAt: plan.nextDueAt,
				createdAt: plan.foundAt
			},
			select: { id: true }
		})
		return { topicId: topic.id, gapId: gap.id, created: true }
	})
}
