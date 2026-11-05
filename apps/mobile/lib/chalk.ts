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

/**
 * Where an open idea is on its way to due, in whole days. `window` is its ruler (two days for
 * a gap nobody has answered, five after a judged warm-up), `daysLeft` matches the server's day
 * mark, and `daysPassed` is how far along the ruler it has come. Closed ideas have no stage.
 */
export function fadeStage(
	idea: Pick<MemoryIdea, 'closed' | 'next_due_at' | 'judged'>,
	now: Date
): { window: number; daysLeft: number; daysPassed: number } | null {
	if (idea.closed || idea.next_due_at == null) return null
	const window = (idea.judged ? JUDGED_WINDOW_MS : FRESH_WINDOW_MS) / MS_PER_DAY
	const remaining = new Date(idea.next_due_at).getTime() - now.getTime()
	const daysLeft = remaining <= 0 ? 0 : Math.min(window, Math.ceil(remaining / MS_PER_DAY))
	return { window, daysLeft, daysPassed: window - daysLeft }
}

/** The reminder job's daily run, in UTC (apps/web/vercel.json, /api/cron/memory). */
export const REMINDER_HOUR_UTC = 9
/** The job sends nothing for an idea more than this many days from due (FIRST_MARK). */
const REMINDER_FIRST_MARK = 5

/**
 * The idea the next run of the reminder job will most likely name: the most urgent day mark,
 * a tie going to the one due first, as the server chooses. A guess on the phone, which cannot
 * see the marks already sent; null when no open idea is close enough to get a note.
 */
export function nextReminder(
	ideas: readonly MemoryIdea[],
	now: Date
): { idea: MemoryIdea; at: Date } | null {
	const at = new Date(now)
	at.setUTCHours(REMINDER_HOUR_UTC, 0, 0, 0)
	if (at.getTime() <= now.getTime()) at.setUTCDate(at.getUTCDate() + 1)
	const before = at.getTime() - MS_PER_DAY
	const markAt = (due: number, run: number) =>
		due - run <= 0 ? 0 : Math.ceil((due - run) / MS_PER_DAY)
	let best: { idea: MemoryIdea; mark: number; due: number } | null = null
	for (const idea of ideas) {
		if (idea.closed || idea.next_due_at == null) continue
		const due = new Date(idea.next_due_at).getTime()
		const mark = markAt(due, at.getTime())
		// Each run sends a mark the idea has newly reached. One already due at the run before
		// has had its last note.
		if (mark > REMINDER_FIRST_MARK || mark >= markAt(due, before)) continue
		if (!best || mark < best.mark || (mark === best.mark && due < best.due)) {
			best = { idea, mark, due }
		}
	}
	return best ? { idea: best.idea, at } : null
}
