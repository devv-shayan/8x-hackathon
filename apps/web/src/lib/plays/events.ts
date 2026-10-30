/**
 * Play Events API client — pushes lifecycle events to an email/automation
 * platform (PLATFORM_BASE_URL), which runs this app's email marketing:
 * welcome series, abandoned checkout, trial-expiry reminders, win-back,
 * launch announcements.
 *
 * You emit canonical events; the platform owns the audiences, the flows, the
 * sending and the deliverability. This app never talks to an email provider
 * directly, so changing provider is not this app's problem.
 *
 * SERVER ONLY. `PLAY_INGEST_KEY` is a write-only key scoped to this play, and it
 * must never reach a browser or a mobile client. If a client needs to trigger an
 * event, call your own backend and let it emit.
 *
 * Full contract and the canonical catalog: docs/EVENTS.md
 */

import { randomUUID } from 'node:crypto'
import { log } from '@/server/lib/logger'

const BASE = process.env.PLATFORM_BASE_URL
const KEY = process.env.PLAY_INGEST_KEY

/** Emission is off unless both a platform URL and a key are set, so previews
 *  and local dev never write into a live audience or trigger a real send. */
export const isPlayEventsEnabled = !!KEY && !!BASE

export type PlayEventUser = {
	/** Your stable internal user id. Never changes for a user; not the email. */
	id: string
	email?: string
	name?: string
	/** BCP-47 (`en-US`, `pt-BR`). Drives the language of localized templates. */
	locale?: string
	/** ISO 3166-1 alpha-2. */
	country?: string
	market?: string
	/** Same reserved non-paying names as the Play Stats API: free, granted,
	 *  promo, sandbox, test, trial. Everything else counts as paid. */
	plan?: string
	marketing_consent?: boolean
	traits?: Record<string, unknown>
}

/**
 * The canonical event names. Tier 1 is required of every play; Tier 2 of any
 * play that monetizes; Tier 3 sharpens targeting.
 *
 * Use these names. The platform only offers flows for events it recognises, so
 * a local synonym means no flow ever fires — the failure is silent and looks
 * exactly like "we have no email automation yet".
 */
export type PlayEventName =
	// Tier 1 — required
	| 'user_signed_up'
	| 'account_deleted'
	// Tier 2 — monetization + retention
	| 'user_activated'
	| 'trial_started'
	| 'subscription_started'
	| 'subscription_renewed'
	| 'subscription_expiring'
	| 'subscription_cancelled'
	| 'subscription_expired'
	| 'purchase_completed'
	| 'user_inactive'
	// Tier 3 — leads, abandonment, engagement
	| 'waitlist_joined'
	| 'email_captured'
	| 'checkout_started'
	| 'checkout_completed'
	| 'feature_used'
	| 'marketing_consent_changed'
	| 'custom'

export type PlayEventEnvelope = {
	event: PlayEventName
	event_id: string
	occurred_at: string
	user: PlayEventUser
	properties?: Record<string, unknown>
}

/**
 * Emit one lifecycle event.
 *
 * Money in `properties` is **integer minor units** (cents) plus an ISO 4217
 * `currency` — never floats. Multiply major-unit prices by 100; pass Stripe
 * amounts through as-is.
 *
 * `eventId` is the idempotency key. The platform dedupes on (play, event_id) for
 * 30 days, so a retry never double-sends an email. Generate a fresh UUID per
 * real occurrence and reuse the SAME one when retrying that occurrence — which
 * is what the retry loop below does.
 *
 * Never throws into the caller: a failed marketing beacon must not fail a
 * signup or a checkout. Failures are logged; the platform's own inspector is
 * where you confirm arrival.
 */
export async function trackPlayEvent(
	event: PlayEventName,
	user: PlayEventUser,
	properties: Record<string, unknown> = {},
	opts: { eventId?: string; occurredAt?: string } = {}
): Promise<void> {
	if (!isPlayEventsEnabled) return

	const body: PlayEventEnvelope = {
		event,
		event_id: opts.eventId ?? randomUUID(),
		occurred_at: opts.occurredAt ?? new Date().toISOString(),
		user,
		properties
	}

	const backoff = [1000, 4000, 15000]
	for (let attempt = 0; ; attempt++) {
		try {
			const res = await fetch(`${BASE}/api/ingest/v1/events`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			})
			if (res.ok) return // 202
			// 4xx is our bug, not a transient failure — retrying cannot fix a bad
			// key or a validation error, so surface it instead of looping.
			if (res.status < 500 || attempt >= backoff.length) {
				log.error('play event rejected', {
					source: 'play-events',
					event,
					status: res.status,
					body: await res.text()
				})
				return
			}
		} catch (err) {
			if (attempt >= backoff.length) {
				log.error('play event failed', { source: 'play-events', event, err })
				return
			}
		}
		await new Promise((r) => setTimeout(r, backoff[attempt]))
	}
}

/** The batch endpoint's cap: it answers 413 above it. */
export const PLAY_EVENT_BATCH_LIMIT = 500

/**
 * Emit up to 500 events in one call. Use for backfills and the daily cron
 * sweeps — a per-user loop against the single endpoint will hit the rate limit
 * (1000 events/min/play) and take far longer.
 *
 * Give each envelope a STABLE `event_id` derived from the thing it describes
 * (e.g. `inactive:${userId}:${weekStamp}`) so re-running the sweep dedupes
 * instead of re-sending.
 */
export async function trackPlayEventBatch(events: PlayEventEnvelope[]): Promise<void> {
	if (!isPlayEventsEnabled || events.length === 0) return

	for (let i = 0; i < events.length; i += PLAY_EVENT_BATCH_LIMIT) {
		const chunk = events.slice(i, i + PLAY_EVENT_BATCH_LIMIT)
		try {
			const res = await fetch(`${BASE}/api/ingest/v1/events`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ events: chunk })
			})
			if (!res.ok) {
				log.error('play event batch rejected', {
					source: 'play-events',
					status: res.status,
					body: await res.text()
				})
			}
		} catch (err) {
			log.error('play event batch failed', { source: 'play-events', err })
		}
	}
}

/** Build an envelope for the batch endpoint without emitting it. */
export function playEvent(
	event: PlayEventName,
	user: PlayEventUser,
	properties: Record<string, unknown> = {},
	opts: { eventId?: string; occurredAt?: string } = {}
): PlayEventEnvelope {
	return {
		event,
		event_id: opts.eventId ?? randomUUID(),
		occurred_at: opts.occurredAt ?? new Date().toISOString(),
		user,
		properties
	}
}
