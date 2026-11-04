// Which fading idea gets today's reminder. Pure: the cron and the tests share it.
// A day is 24 hours, same as the gap schedule, so the mark does not depend on a timezone.

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** The faintest mark. Anything later than five days has not reached a mark yet. */
export const FIRST_MARK = 5

/** Days left until `dueAt`, or 0 once that moment has arrived. */
export function dayMark(dueAt: Date, now: Date): number {
	const remaining = dueAt.getTime() - now.getTime()
	if (remaining <= 0) return 0
	return Math.ceil(remaining / MS_PER_DAY)
}

/** 'due' once it is due, otherwise the days left, for the note and the event. */
export function stageLabel(stage: number): '5' | '4' | '3' | '2' | '1' | 'due' {
	if (stage <= 0) return 'due'
	if (stage === 1) return '1'
	if (stage === 2) return '2'
	if (stage === 3) return '3'
	if (stage === 4) return '4'
	return '5'
}

export type ReminderCandidate = {
	gapId: string
	userId: string
	conceptTitle: string
	dueAt: Date
	/** Stages already recorded for this due date, sent or skipped. */
	handledStages: readonly number[]
	/** This person already got a reminder today. */
	sentToday: boolean
	tokens: readonly string[]
}

export type ReminderToSend = {
	gapId: string
	userId: string
	conceptTitle: string
	dueAt: Date
	/** The most urgent mark that has not been sent. */
	stage: number
	/** That mark, plus any louder days the job never ran for. All get recorded. */
	stagesToRecord: number[]
	tokens: string[]
}

/**
 * One note per person. The most urgent unsent mark wins; a tie goes to the idea
 * that was due first. No token, or a note already sent today, sends nothing.
 * Marks later than five days are not due a note yet.
 */
export function chooseReminders(rows: readonly ReminderCandidate[], now: Date): ReminderToSend[] {
	const best = new Map<string, ReminderToSend>()
	for (const row of rows) {
		if (row.sentToday || row.tokens.length === 0) continue
		const current = dayMark(row.dueAt, now)
		if (current > FIRST_MARK) continue
		const handled = new Set(row.handledStages)
		// A schedule starts at the mark recorded when the due date was set
		// (2 for a new gap, 5 after a right answer). Days above that never happened.
		const start = row.handledStages.length > 0 ? Math.max(...row.handledStages) : current
		const unhandled: number[] = []
		for (let stage = Math.min(start, FIRST_MARK); stage >= current; stage--) {
			if (!handled.has(stage)) unhandled.push(stage)
		}
		if (unhandled.length === 0) continue
		const stage = Math.min(...unhandled)
		const next: ReminderToSend = {
			gapId: row.gapId,
			userId: row.userId,
			conceptTitle: row.conceptTitle,
			dueAt: row.dueAt,
			stage,
			stagesToRecord: unhandled,
			tokens: [...row.tokens]
		}
		const prev = best.get(row.userId)
		if (
			!prev ||
			stage < prev.stage ||
			(stage === prev.stage && row.dueAt.getTime() < prev.dueAt.getTime())
		) {
			best.set(row.userId, next)
		}
	}
	return [...best.values()]
}
