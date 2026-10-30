'use client'

/**
 * Client-side event emission. One call fans out to every sink that applies:
 *
 *   1. PostHog  — funnels, replay, and the stats dashboard's PostHog connection
 *   2. GA4      — the dashboard's GA4 connection, and ad-platform attribution
 *   3. /api/track — first-party persistence, for anything in TRACKED_EVENTS
 *
 * Call sites should not have to know which sinks a given event uses. They fire
 * once; this decides. The beacon is fire-and-forget and every sink is wrapped —
 * analytics must never break a render or a checkout.
 */

import posthog from 'posthog-js'
import type { AppEvent } from './events'
import { getSessionId } from './session'

type Props = Record<string, unknown>

/**
 * Fire an event everywhere it belongs.
 *
 * `name` is typed to the registry, so a typo is a compile error rather than a
 * 400 nobody notices.
 */
export function gaEvent(name: AppEvent, properties?: Props) {
	if (typeof window === 'undefined') return

	// 1. PostHog
	try {
		if (posthog.__loaded) posthog.capture(name, properties)
	} catch {
		// intentionally silent
	}

	// 2. GA4
	try {
		const w = window as unknown as { gtag?: (...args: unknown[]) => void }
		if (typeof w.gtag === 'function') w.gtag('event', name, properties ?? {})
	} catch {
		// intentionally silent
	}

	// 3. First-party. The route drops anything not whitelisted, so it is safe to
	// send everything and let the server decide what it persists.
	void beacon(name, properties)
}

/**
 * POST to /api/track without blocking. `keepalive` lets the request survive the
 * page unloading, which is exactly when the most interesting events fire (a
 * click that navigates away would otherwise be lost).
 */
async function beacon(name: string, metadata?: Props) {
	try {
		await fetch('/api/track', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			keepalive: true,
			body: JSON.stringify({
				name,
				path: window.location.pathname,
				sessionId: getSessionId(),
				metadata: metadata ?? {}
			})
		})
	} catch {
		// intentionally silent
	}
}

/** Identify the visitor in PostHog. Call after sign-in. */
export function identify(userId: string, properties?: Props) {
	try {
		if (posthog.__loaded) posthog.identify(userId, properties)
	} catch {
		// intentionally silent
	}
}

/** Clear the PostHog identity. Call after sign-out, or the next visitor on this
 *  browser inherits the last one's person profile. */
export function resetIdentity() {
	try {
		if (posthog.__loaded) posthog.reset()
	} catch {
		// intentionally silent
	}
}
