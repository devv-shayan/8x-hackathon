import { NextResponse, type NextRequest } from 'next/server'
import type { AuthOnlySupabaseClient } from '@/lib/supabase/auth-only'
import { createSecretKeyClient } from '@/lib/supabase/secret-key'
import {
	PLAY_EVENT_BATCH_LIMIT,
	playEvent,
	trackPlayEventBatch,
	type PlayEventEnvelope
} from '@/lib/plays/events'
import { isCronAuthorized } from '@/server/api/cron-auth'
import { profileStore } from '@/server/db/profiles'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Seconds. The ceiling on Hobby and the default on Pro, with Fluid compute (on for every
// Vercel project created since April 2025). A Hobby project without Fluid compute caps
// functions at 60: lower this to 60 there. Next.js reads it
// statically, so it stays a literal.
export const maxDuration = 300

/**
 * Daily lifecycle sweep.
 *
 * `subscription_expiring` and `user_inactive` are the two canonical events that
 * are NOT reactions to a user action — they are states you detect on a schedule.
 * Nothing else will emit them, so without this route the pre-expiry reminder and
 * the win-back flow simply never fire, and that failure is silent: the platform
 * has the flows, they just never receive an entry event.
 *
 * Scheduled daily at 09:00 UTC by apps/web/vercel.json. Elsewhere, point a
 * daily scheduler at it with the same header.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this header
 * automatically when CRON_SECRET is set in the project's env. Unset, the route
 * answers 503 and runs nothing (src/server/api/cron-auth.ts).
 *
 * Long runs: each batch of 500 events is sent as soon as it fills, so a run cut
 * short keeps what it already sent, and the stable event ids make a re-run send
 * only the rest. Email lookups run LOOKUP_CONCURRENCY at a time. Near
 * maxDuration the sweep stops starting lookups, sends what it has, logs a
 * warning and answers with `complete: false`; a run that finishes answers
 * exactly as before.
 */

/** Days before a subscription lapses to send the reminder. */
const EXPIRING_IN_DAYS = 3
/** Days of no activity before a user counts as inactive. */
const INACTIVE_AFTER_DAYS = 14
/** Auth admin lookups (one per user, for the email) in flight at once. */
const LOOKUP_CONCURRENCY = 10
/** How long before maxDuration the sweep stops starting lookups, to send what it has. */
const DEADLINE_MARGIN_MS = 30_000

export async function GET(req: NextRequest) {
	const denied = requireCronSecret(req)
	if (denied) return denied

	try {
		const supabase = createSecretKeyClient()
		const now = new Date()
		const deadline = now.getTime() + maxDuration * 1000 - DEADLINE_MARGIN_MS
		// Stamped into the event ids so a re-run inside the same day dedupes rather
		// than re-sending, while tomorrow's sweep is genuinely a new occurrence.
		const day = now.toISOString().slice(0, 10)

		const outbox = createOutbox()
		let complete = true

		/** Looks up each row's email, LOOKUP_CONCURRENCY at a time, and queues an
		 *  envelope for each row that has one, in the rows' order. False when the
		 *  deadline stopped it before the last row. */
		async function sweep<Row extends { id: string }>(
			rows: Row[],
			envelope: (row: Row, email: string) => PlayEventEnvelope
		): Promise<boolean> {
			for (let i = 0; i < rows.length; i += LOOKUP_CONCURRENCY) {
				if (Date.now() >= deadline) {
					log.warn('lifecycle sweep stopped at its deadline', {
						source: 'api/cron/lifecycle',
						unswept: rows.length - i
					})
					return false
				}
				const chunk = rows.slice(i, i + LOOKUP_CONCURRENCY)
				const emails = await Promise.all(chunk.map((row) => emailFor(supabase, row.id)))
				for (const [j, row] of chunk.entries()) {
					const email = emails[j]
					if (email) await outbox.add(envelope(row, email))
				}
			}
			return true
		}

		// ── subscription_expiring ────────────────────────────────────────────────
		// Everyone whose access ends within the window and has not been renewed.
		// `will_renew = false` matters: a subscription set to auto-renew is not
		// expiring, and reminding those users reads as a dunning email to someone
		// whose card is fine.
		const windowEnd = new Date(now.getTime() + EXPIRING_IN_DAYS * 86_400_000)
		complete = await sweep(await profileStore.expiringSubscriptions(now, windowEnd), (r, email) =>
			playEvent(
				'subscription_expiring',
				{
					id: r.id,
					email,
					plan: r.plan_type ?? 'free',
					country: r.region ?? undefined,
					locale: r.locale ?? undefined,
					marketing_consent: r.marketing_consent === true
				},
				{
					plan: r.plan_type,
					// As PostgREST rendered it (src/server/db/postgrest-time.ts).
					expires_at: r.premium_expires_at,
					product_id: r.premium_product
				},
				// Stable per (user, expiry): re-running today, or tomorrow, cannot
				// send two reminders for the same subscription period.
				{ eventId: `expiring:${r.id}:${r.premium_expires_at.slice(0, 10)}` }
			)
		)

		// ── user_inactive ────────────────────────────────────────────────────────
		const cutoff = new Date(now.getTime() - INACTIVE_AFTER_DAYS * 86_400_000)
		// Weekly stamp, not daily: an inactive user stays inactive, so a daily id
		// would emit a re-engagement event every single day until they returned.
		const week = weekStamp(now)
		if (complete) {
			complete = await sweep(await profileStore.inactiveSince(cutoff), (r, email) =>
				playEvent(
					'user_inactive',
					{
						id: r.id,
						email,
						plan: r.plan_type ?? 'free',
						country: r.region ?? undefined,
						locale: r.locale ?? undefined,
						marketing_consent: r.marketing_consent === true
					},
					{
						// As PostgREST rendered it (src/server/db/postgrest-time.ts).
						last_active_at: r.last_seen_at,
						days_inactive: Math.floor(
							(now.getTime() - new Date(r.last_seen_at).getTime()) / 86_400_000
						)
					},
					{ eventId: `inactive:${r.id}:${week}` }
				)
			)
		}

		await outbox.flush()

		const { expiring, inactive } = outbox.counts
		return NextResponse.json({
			ok: true,
			day,
			emitted: expiring + inactive,
			expiring,
			inactive,
			...(complete ? {} : { complete: false })
		})
	} catch (err) {
		log.error('lifecycle sweep failed', { source: 'api/cron/lifecycle', err })
		return NextResponse.json({ error: 'Lifecycle sweep failed' }, { status: 500 })
	}
}

/** CRON_SECRET's bearer, compared in constant time (src/server/api/cron-auth.ts).
 *  503 when it is unset, so a deploy without the secret cannot be triggered by
 *  anyone who guesses the path; 401 for anything but the exact header. */
function requireCronSecret(req: NextRequest): NextResponse | null {
	const secret = process.env.CRON_SECRET
	if (!secret) {
		return NextResponse.json(
			{ error: 'Cron is not configured on this deployment' },
			{ status: 503 }
		)
	}
	if (!isCronAuthorized(req.headers.get('authorization'), secret)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}
	return null
}

/** Queues envelopes and sends each batch as soon as it fills, so the batches are
 *  the ones a single send at the end would have made, only earlier. */
function createOutbox() {
	const pending: PlayEventEnvelope[] = []
	const counts = { expiring: 0, inactive: 0 }
	return {
		counts,
		async add(envelope: PlayEventEnvelope) {
			pending.push(envelope)
			if (envelope.event === 'subscription_expiring') counts.expiring++
			else counts.inactive++
			if (pending.length >= PLAY_EVENT_BATCH_LIMIT) {
				await trackPlayEventBatch(pending.splice(0, PLAY_EVENT_BATCH_LIMIT))
			}
		},
		async flush() {
			if (pending.length > 0) await trackPlayEventBatch(pending.splice(0))
		}
	}
}

/** Emails live in auth.users, not profiles. */
async function emailFor(supabase: AuthOnlySupabaseClient, userId: string): Promise<string | null> {
	const { data } = await supabase.auth.admin.getUserById(userId)
	return data?.user?.email ?? null
}

/** ISO year + week, so an inactive user produces one event per week rather than
 *  one per day for as long as they stay away. */
function weekStamp(d: Date): string {
	const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
	const dayNum = (t.getUTCDay() + 6) % 7
	t.setUTCDate(t.getUTCDate() - dayNum + 3)
	const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
	const week = 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3) / 7)
	return `${t.getUTCFullYear()}W${String(week).padStart(2, '0')}`
}
