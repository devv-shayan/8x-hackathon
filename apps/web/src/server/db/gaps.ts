import type { PrismaClient } from '@prisma/client'
import type { ConceptResult } from '@/server/classroom/score-explanation'
import { conceptsNeedingGaps } from '@/server/gaps/open'
import { firstDueAt } from '@/server/gaps/schedule'
import { keyConceptSchema, type KeyConcept } from '@/server/video/key-concepts'
import type { StoredGap } from '@/server/topics/progress'
import { db } from './client'

// Gaps found while scoring an explanation. A warm-up later moves the same rows.

export function createGapStore(client: Pick<PrismaClient, 'gap'>) {
	return {
		/** One open gap per missed or wrong concept. Due two days after it is found. */
		async saveFromResults(input: {
			userId: string
			topicId: string
			concepts: readonly KeyConcept[]
			results: readonly ConceptResult[]
			foundAt: Date
		}) {
			const existing = await client.gap.findMany({
				where: { userId: input.userId, topicId: input.topicId, closedAt: null },
				select: { concept: true }
			})
			const needed = conceptsNeedingGaps({
				concepts: input.concepts,
				results: input.results,
				openTitles: existing.map((row) => keyConceptSchema.parse(row.concept).title)
			})
			if (needed.length === 0) return
			await client.gap.createMany({
				data: needed.map((concept) => ({
					userId: input.userId,
					topicId: input.topicId,
					concept,
					nextDueAt: firstDueAt(input.foundAt)
				}))
			})
		},

		/** Every gap, open or closed, on these of the person's topics, by topic. */
		async listForTopics(userId: string, topicIds: string[]): Promise<Map<string, StoredGap[]>> {
			const byTopic = new Map<string, StoredGap[]>()
			if (topicIds.length === 0) return byTopic
			const rows = await client.gap.findMany({
				where: { userId, topicId: { in: topicIds } },
				select: { id: true, topicId: true, concept: true, nextDueAt: true, closedAt: true }
			})
			for (const row of rows) {
				const list = byTopic.get(row.topicId) ?? []
				list.push({
					id: row.id,
					concept: keyConceptSchema.parse(row.concept),
					nextDueAt: row.nextDueAt,
					closedAt: row.closedAt
				})
				byTopic.set(row.topicId, list)
			}
			return byTopic
		}
	}
}

export type GapStore = ReturnType<typeof createGapStore>

export const gapStore = createGapStore(db)
