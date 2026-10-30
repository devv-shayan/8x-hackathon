'use client'

/**
 * Per-tab visit id.
 *
 * This is the only identity an anonymous event has. Guests are most of the top
 * of funnel, so without it landing → pricing → signup conversion cannot be
 * computed at all, and dedupe has no way to bound how many rows one visitor can
 * write.
 *
 * Stored in sessionStorage, not localStorage: one id per tab-visit is the unit
 * that matches how the funnel is read. A guest who signs up mid-visit produces
 * one row on each side of the boundary (session id before, user id after)
 * rather than a gap.
 */

const KEY = 'app_session_id'

export function getSessionId(): string {
	if (typeof window === 'undefined') return ''
	try {
		const existing = window.sessionStorage.getItem(KEY)
		if (existing) return existing
		const id =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
		window.sessionStorage.setItem(KEY, id)
		return id
	} catch {
		// Private browsing / storage disabled. Returning '' means anonymous events
		// are dropped server-side rather than written unbounded, which is correct.
		return ''
	}
}
