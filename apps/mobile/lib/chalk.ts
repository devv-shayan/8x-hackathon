import type { MemoryIdea } from '@app/contract'

/** Still readable. A due line sits here, on the white sheet and on a dark board. */
export const FAINT_CHALK = 0.3
const BRIGHT_CHALK = 1
const MS_PER_DAY = 24 * 60 * 60 * 1000
/** A gap nobody has answered yet fades across its first two days. */
const FRESH_WINDOW_MS = 2 * MS_PER_DAY
/**
 * After a warm-up is judged, the ruler is five days: a right answer starts full,
 * and a wrong one, due again in two days, sits part-way down that ruler.
 */
const JUDGED_WINDOW_MS = 5 * MS_PER_DAY

/** How solid a line of chalk is. Closed ideas stay full. Due ideas are the faintest. */
export function chalkOpacity(
	idea: Pick<MemoryIdea, 'closed' | 'next_due_at' | 'judged'>,
	now: Date
): number {
	if (idea.closed || idea.next_due_at == null) return BRIGHT_CHALK
	const remaining = new Date(idea.next_due_at).getTime() - now.getTime()
	if (remaining <= 0) return FAINT_CHALK
	const window = idea.judged ? JUDGED_WINDOW_MS : FRESH_WINDOW_MS
	const along = Math.min(1, remaining / window)
	// Squared, so the middle of a window is much fainter than a straight slide.
	// One day into a fresh gap is about 0.48, not 0.65.
	return FAINT_CHALK + (BRIGHT_CHALK - FAINT_CHALK) * along * along
}

/** The one due idea to practice: the oldest. Others wait. */
export function dueIdeaId(ideas: readonly MemoryIdea[], now: Date): string | null {
	const due = ideas.filter(
		(idea) =>
			!idea.closed &&
			idea.next_due_at != null &&
			new Date(idea.next_due_at).getTime() <= now.getTime()
	)
	due.sort(
		(a, b) => new Date(a.next_due_at ?? 0).getTime() - new Date(b.next_due_at ?? 0).getTime()
	)
	return due[0]?.gap_id ?? null
}
