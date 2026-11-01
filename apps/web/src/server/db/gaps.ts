import type { PrismaClient } from '@prisma/client'
import type { ConceptResult } from '@/server/classroom/score-explanation'
import { conceptsNeedingGaps } from '@/server/gaps/open'
import { firstDueAt } from '@/server/gaps/schedule'
import { keyConceptSchema, type KeyConcept } from '@/server/video/key-concepts'
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
		}
	}
}

export type GapStore = ReturnType<typeof createGapStore>

export const gapStore = createGapStore(db)
