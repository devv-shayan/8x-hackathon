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
 * Two rows are the same line on the board when they read the same. That happens when an
 * idea she kept is missed again (a new gap beside the closed one), or when the same lesson
 * is pasted twice with a small edit (a second topic with the same title and ideas).
 */
function boardKey(idea: MemoryIdea): string {
	const norm = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()
	return `${norm(idea.topic_title)}\n${norm(idea.concept_title)}`
}

/**
 * The board's order: due ideas first (oldest first, so the faintest is the one to tap),
 * then ideas still fading (soonest first), then ideas she keeps, by title. Each idea is
 * one line: the first in that order wins, so an open gap hides a closed copy of itself.
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
	const sorted = ideas.sort((a, b) => {
		const byRank = rank(a) - rank(b)
		if (byRank !== 0) return byRank
		if (a.closed && b.closed) return a.concept_title.localeCompare(b.concept_title)
		return new Date(a.next_due_at ?? 0).getTime() - new Date(b.next_due_at ?? 0).getTime()
	})
	const seen = new Set<string>()
	return sorted.filter((idea) => {
		const key = boardKey(idea)
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}
