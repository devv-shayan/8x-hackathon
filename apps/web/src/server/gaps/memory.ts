import type { MemoryIdea } from '@app/contract'

export type MemoryRow = {
	gapId: string
	topicId: string
	topicTitle: string
	conceptTitle: string
	closedAt: Date | null
	nextDueAt: Date
	judged: boolean
}

/**
 * The board's order: due ideas first (oldest first, so the faintest is the one to tap),
 * then ideas still fading (soonest first), then ideas she keeps, by title.
 */
export function memoryIdeas(rows: readonly MemoryRow[], now: Date): MemoryIdea[] {
	const ideas = rows.map((row) => ({
		gap_id: row.gapId,
		topic_id: row.topicId,
		topic_title: row.topicTitle,
		concept_title: row.conceptTitle,
		closed: row.closedAt != null,
		next_due_at: row.closedAt == null ? row.nextDueAt.toISOString() : null,
		judged: row.judged
	}))
	const rank = (idea: MemoryIdea) => {
		if (idea.closed) return 2
		return new Date(idea.next_due_at ?? 0).getTime() <= now.getTime() ? 0 : 1
	}
	return ideas.sort((a, b) => {
		const byRank = rank(a) - rank(b)
		if (byRank !== 0) return byRank
		if (a.closed && b.closed) return a.concept_title.localeCompare(b.concept_title)
		return new Date(a.next_due_at ?? 0).getTime() - new Date(b.next_due_at ?? 0).getTime()
	})
}
