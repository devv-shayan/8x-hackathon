const DAY_MS = 24 * 60 * 60 * 1000
/** A week out, a weekday name stops being clear: use the date. */
const WEEKDAY_WITHIN_DAYS = 6

/** When something comes back, as people say it: "today", "Wednesday", or "9 Nov". */
export function dueDay(iso: string, now = new Date()): string {
	const due = new Date(iso)
	const days = Math.ceil((due.getTime() - now.getTime()) / DAY_MS)
	if (days <= 0) return 'today'
	if (days <= WEEKDAY_WITHIN_DAYS) return due.toLocaleDateString(undefined, { weekday: 'long' })
	return due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
