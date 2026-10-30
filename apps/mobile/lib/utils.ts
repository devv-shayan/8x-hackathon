/**
 * Shared utility helpers.
 */

/** Returns initials from a display name (up to 2 characters). */
export function getInitials(name: string): string {
	if (!name) return '?'
	const parts = name.trim().split(/\s+/)
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value))
}

/** Delay for N milliseconds. */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Returns true if the email looks valid. */
export function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * Format a date relative to now (Today, Yesterday, or locale date string).
 */
export function formatRelativeDate(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date
	const now = new Date()
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const yesterday = new Date(today)
	yesterday.setDate(yesterday.getDate() - 1)
	const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())

	if (target.getTime() === today.getTime()) return 'Today'
	if (target.getTime() === yesterday.getTime()) return 'Yesterday'
	return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Format a calendar date with no time zone (`2026-09-24`, as the API sends a
 * due date) as a short local date. Parsed by its parts: `new Date('2026-09-24')`
 * is midnight UTC, which is the day before anywhere west of Greenwich.
 */
export function formatCalendarDate(isoDate: string): string {
	const [year, month, day] = isoDate.split('-').map(Number)
	if (!year || !month || !day) return isoDate
	return new Date(year, month - 1, day).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric'
	})
}
