/**
 * Server-only first-party event logging, into `analytics_events`.
 *
 * This is the sink that answers questions PostHog cannot: retention cohorts for
 * the Play Stats API, admin segments, and any number that has to survive an ad
 * blocker. PostHog only sees forward from the day it was installed; this table
 * is your own history.
 *
 * Never throws into the caller. Analytics must not break a checkout or a render.
 */

import { analyticsStore } from '@/server/db/analytics'
import { profileStore } from '@/server/db/profiles'
import { log } from '@/server/lib/logger'
import { ALL_EVENT_NAMES } from './events'

/**
 * The events persisted first-party. A NAME NOT IN THIS LIST IS DROPPED — by
 * `recordUserEvent` below and by /api/track with a 400 — with no error anywhere
 * a person would see.
 *
 * It is built from the registry rather than hand-listed, so adding an event in
 * `events.ts` cannot leave the whitelist behind. Narrow it deliberately (a
 * filter here) if some events should be PostHog-only; do not hand-maintain a
 * parallel list, which is precisely the drift that loses funnel steps.
 */
export const TRACKED_EVENTS = ALL_EVENT_NAMES

const ALLOWED = new Set<string>(TRACKED_EVENTS)

// A fresh clone with no database yet records nothing, quietly, rather than
// logging a connection error on every page view.
const isConfigured = () => !!process.env.DATABASE_URL

/**
 * Record a funnel event for a visitor — signed in (pass `userId`) or anonymous
 * (pass `userId: null` plus `opts.sessionId`).
 *
 * Dedupe behaviour, pick at most one:
 *  - `dedupeDaily` (default true): once per visitor/event/UTC day. Right for
 *    chatty page views, so they don't flood the table.
 *  - `dedupeForever`: once per visitor/event for all time. Right for
 *    lifetime-once milestones (signup, onboarding) where a redelivery or a
 *    re-login must never create a second row. Overrides `dedupeDaily`.
 *  - `dedupeDaily: false`: record every occurrence. Right for purchases,
 *    refunds, per-item completions.
 *
 * `dedupeMatch` widens the dedupe key with metadata fields. Without it the key
 * is (visitor, name, day) ALONE — so an event fired once per item would record
 * the first item a visitor opened that day and silently drop every other one.
 * Any event carrying a discriminator MUST pass that field here, or its per-item
 * counts are fiction.
 *
 * "Visitor" is the user id when signed in, else the session id. Both are scoped
 * the same way, so a guest who signs up mid-visit produces one row on each side
 * of the boundary rather than a gap.
 */
export async function recordUserEvent(
	userId: string | null,
	name: string,
	opts?: {
		path?: string
		metadata?: Record<string, unknown>
		/** Visitor country (ISO alpha-2). Falls back to the user's stored profile
		 *  region, so every event is segmentable by market with no schema change. */
		country?: string | null
		/** Per-tab visit id. REQUIRED when `userId` is null — it is the only
		 *  identity an anonymous row has, and without it dedupe cannot bound how
		 *  many rows one visitor can write. */
		sessionId?: string
		/** Metadata fields that must ALSO match for a row to count as a duplicate,
		 *  e.g. `{ plan: 'pro' }` so each plan gets its own daily row. */
		dedupeMatch?: Record<string, string>
		dedupeDaily?: boolean
		dedupeForever?: boolean
	}
): Promise<void> {
	if (!ALLOWED.has(name) || !isConfigured()) return

	// An anonymous event with no session id is unbounded — one visitor could
	// write a row per render — and joins to nothing. Drop it.
	const sessionId = opts?.sessionId?.slice(0, 64) || null
	if (!userId && !sessionId) return

	try {
		const dedupeForever = opts?.dedupeForever ?? false
		if (dedupeForever || (opts?.dedupeDaily ?? true)) {
			let since: Date | null = null
			if (!dedupeForever) {
				since = new Date()
				since.setUTCHours(0, 0, 0, 0)
			}
			const duplicate = await analyticsStore.hasDuplicate({
				name,
				visitor: userId ? { userId } : { sessionId: sessionId! },
				match: opts?.dedupeMatch ?? {},
				since
			})
			if (duplicate) return
		}

		// Resolve country. Caller override wins, else the user's stored region.
		// Looked up only here, past the dedupe short-circuit, so repeat events
		// don't pay for the read. Anonymous visitors have no profile, so the edge
		// header is all there is.
		let country = opts?.country ?? null
		if (!country && userId) {
			country = await profileStore.regionOf(userId)
		}

		const metadata: Record<string, unknown> = { ...(opts?.metadata ?? {}) }
		if (country != null) metadata.country = country
		if (sessionId) metadata.session_id = sessionId

		await analyticsStore.insertEvent({
			userId,
			name,
			path: opts?.path ?? null,
			...(Object.keys(metadata).length > 0 ? { metadata } : {})
		})
	} catch (err) {
		log.error('recordUserEvent failed', { source: 'analytics', event: name, err })
	}
}

/** Largest single dwell delta we'll trust (30 min). Guards against a tab left
 *  open, or clock skew, inflating one row. */
export const MAX_DWELL_MS = 30 * 60 * 1000

/**
 * Record one engagement "dwell delta": how many focused, visible milliseconds
 * were just spent on `path`. Appended raw (no dedupe) and summed later for
 * time-on-screen.
 *
 * `userId` is nullable because the marketing pages are mostly GUESTS. Dropping
 * anonymous dwell would leave the landing and pricing pages with no
 * time-on-page at all.
 */
export async function recordPageview(
	userId: string | null,
	params: { sessionId: string; path: string; dwellMs: number }
): Promise<void> {
	if (!isConfigured()) return
	const dwell = Math.round(params.dwellMs)
	if (!Number.isFinite(dwell) || dwell <= 0) return
	try {
		await analyticsStore.insertPageview({
			userId,
			sessionId: params.sessionId.slice(0, 64),
			path: params.path.slice(0, 200),
			dwellMs: Math.min(dwell, MAX_DWELL_MS)
		})
	} catch (err) {
		log.error('recordPageview failed', { source: 'analytics', err })
	}
}
