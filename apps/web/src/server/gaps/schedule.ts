// When a gap comes back. A day is 24 hours: the due time does not depend on a timezone.

/** Due this long after the gap is found. */
export const DAYS_UNTIL_FIRST_DUE = 2
/** A right answer comes back this many days later. */
export const DAYS_AFTER_RIGHT = 5
/** A wrong answer comes back this many days later, and the streak resets. */
export const DAYS_AFTER_WRONG = 2
/** Right answers in a row that close a gap. */
export const RIGHTS_TO_CLOSE = 2

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type ScheduledGap = {
	rightStreak: number
	nextDueAt: Date
	closedAt: Date | null
}

function addDays(from: Date, days: number): Date {
	return new Date(from.getTime() + days * MS_PER_DAY)
}

/** When a gap found at `foundAt` is first due. */
export function firstDueAt(foundAt: Date): Date {
	return addDays(foundAt, DAYS_UNTIL_FIRST_DUE)
}

/**
 * The gap after a judged warm-up.
 * Right: due again 5 days later. A second right in a row closes it.
 * Wrong: due again in 2 days, and the streak goes back to 0.
 * A closed gap keeps a `nextDueAt` only because the column is required;
 * `isGapDue` treats any `closedAt` as not due.
 */
export function scheduleAfterJudgment(
	gap: { rightStreak: number },
	isRight: boolean,
	judgedAt: Date
): ScheduledGap {
	if (!isRight) {
		return {
			rightStreak: 0,
			nextDueAt: addDays(judgedAt, DAYS_AFTER_WRONG),
			closedAt: null
		}
	}
	const rightStreak = gap.rightStreak + 1
	if (rightStreak >= RIGHTS_TO_CLOSE) {
		return { rightStreak, nextDueAt: judgedAt, closedAt: judgedAt }
	}
	return {
		rightStreak,
		nextDueAt: addDays(judgedAt, DAYS_AFTER_RIGHT),
		closedAt: null
	}
}

/** Closed gaps are never due. An open gap is due once `nextDueAt` has arrived. */
export function isGapDue(gap: { closedAt: Date | null; nextDueAt: Date }, now: Date): boolean {
	return gap.closedAt == null && gap.nextDueAt.getTime() <= now.getTime()
}
