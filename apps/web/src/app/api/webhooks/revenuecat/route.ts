import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSecretKeyClient } from '@/lib/supabase/secret-key'
import { trackPlayEvent, type PlayEventName } from '@/lib/plays/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { CHECKOUT_EVENTS } from '@/lib/analytics/events'
import { profileStore, type EntitlementPatch } from '@/server/db/profiles'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * RevenueCat webhook → mirrors subscription state into `profiles`, and emits the
 * matching lifecycle event to the Play Events API so the platform's revenue
 * email flows fire.
 *
 * Auth: RevenueCat sends `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`,
 * because its Authorization header field (RevenueCat → Integrations →
 * Webhooks) is set to exactly that: it sends the field as typed. The secret is
 * required: without it the route refuses every request (`requireWebhookSecret`).
 * We update the profile whose `id` equals the event's `app_user_id`, so the
 * mobile app must identify RevenueCat
 * users with their Supabase user id (`Purchases.logIn(session.user.id)`).
 *
 * Two rules here are load-bearing for what the stats dashboard reports, and both
 * fail silently when they are wrong:
 *
 *  1. SANDBOX PURCHASES FIRE THE SAME EVENTS AS REAL ONES. Deciding "paid" from
 *     the event type counts every TestFlight tester as a customer. The only
 *     reliable signal is `environment`, captured here and stored on the profile.
 *
 *  2. A BILLING ISSUE OUTRANKS THE PERIOD TYPE. When a trial's conversion charge
 *     fails, RevenueCat keeps `period_type: TRIAL` and extends `expiration_at_ms`
 *     through payment recovery — so period-type-first logic reports a failed
 *     conversion as a healthy month-long trial. `statusFor()` below checks the
 *     billing signals first, deliberately.
 */

const ACTIVE = new Set([
	'INITIAL_PURCHASE',
	'RENEWAL',
	'PRODUCT_CHANGE',
	'UNCANCELLATION',
	'NON_RENEWING_PURCHASE'
])
const INACTIVE = new Set(['CANCELLATION', 'EXPIRATION'])
/** Access continues during grace/dunning, so this is neither active nor gone. */
const BILLING = new Set(['BILLING_ISSUE', 'SUBSCRIPTION_PAUSED'])

type RcEvent = {
	type?: string
	app_user_id?: string
	environment?: string
	store?: string
	period_type?: string
	product_id?: string
	expiration_at_ms?: number
	purchased_at_ms?: number
	grace_period_expiration_at_ms?: number | null
	cancel_reason?: string
	is_trial_conversion?: boolean
	price_in_purchased_currency?: number
	currency?: string
}

/** Only 'purchase' counts as a sale. Comps and promos are premium in-app but
 *  are not revenue, and the dashboard's reserved bucket names depend on this. */
function sourceFor(store: string | undefined): 'purchase' | 'promo' {
	return store === 'promotional' ? 'promo' : 'purchase'
}

/**
 * Billing status. Checked in this order on purpose — see rule 2 above.
 * Returns the value stored in `profiles.premium_status`, which is what the Play
 * Stats API reports as the subscription status and what buckets a user as
 * `trial` rather than paid.
 */
function statusFor(e: RcEvent, type: string): string {
	if (type === 'BILLING_ISSUE' || e.grace_period_expiration_at_ms) return 'past_due'
	if (type === 'SUBSCRIPTION_PAUSED') return 'paused'
	if (type === 'EXPIRATION') return 'expired'
	if (type === 'CANCELLATION') return 'canceled'
	if ((e.period_type ?? '').toUpperCase() === 'TRIAL') return 'trialing'
	return 'active'
}

/**
 * The first-party event name for this webhook, or null.
 *
 * Recorded into `analytics_events` as well as sent to the platform, because the
 * admin panel's revenue screens and the play's own retention cohorts read that
 * table — a purchase that only exists in RevenueCat is invisible to both.
 */
function localEventFor(type: string, e: RcEvent): string | null {
	switch (type) {
		case 'INITIAL_PURCHASE':
			return (e.period_type ?? '').toUpperCase() === 'TRIAL'
				? CHECKOUT_EVENTS.trialStarted
				: CHECKOUT_EVENTS.purchase
		case 'RENEWAL':
		case 'NON_RENEWING_PURCHASE':
			return CHECKOUT_EVENTS.purchase
		case 'CANCELLATION':
			return CHECKOUT_EVENTS.subscriptionCancelled
		case 'EXPIRATION':
			return CHECKOUT_EVENTS.subscriptionExpired
		case 'BILLING_ISSUE':
			return CHECKOUT_EVENTS.paymentFailed
		default:
			return null
	}
}

/** The Play Events name for this webhook, or null when it maps to nothing. */
function playEventFor(type: string, e: RcEvent): PlayEventName | null {
	switch (type) {
		case 'INITIAL_PURCHASE':
			return (e.period_type ?? '').toUpperCase() === 'TRIAL'
				? 'trial_started'
				: 'subscription_started'
		case 'RENEWAL':
			// A trial converting is the play's first real sale, not a renewal — the
			// purchase-confirmation flow should fire, not the loyalty one.
			return e.is_trial_conversion ? 'subscription_started' : 'subscription_renewed'
		case 'NON_RENEWING_PURCHASE':
			return 'purchase_completed'
		case 'CANCELLATION':
			return 'subscription_cancelled'
		case 'EXPIRATION':
			return 'subscription_expired'
		default:
			return null
	}
}

/**
 * Fails closed. With no REVENUECAT_WEBHOOK_SECRET configured (unset, empty or
 * only whitespace), every request is refused with a 503 and never read: an
 * unset variable must not turn the money path into a public write endpoint.
 * RevenueCat retries a non-200 up to five times (after 5, 10, 20, 40 and 80
 * minutes, about 2.5 hours in all); an event still refused after that is not
 * delivered again. A missing or wrong Authorization header is a 401. The
 * comparison is constant-time.
 *
 * RevenueCat sends its Authorization header field exactly as typed, so that
 * field must hold the literal `Bearer <secret>`.
 *
 * Returns a response to short-circuit with, or null when authorized.
 */
function requireWebhookSecret(req: NextRequest): NextResponse | null {
	// Trimmed: a value pasted with a trailing newline must still match.
	const secret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim()
	if (!secret) {
		log.error('revenuecat webhook refused: REVENUECAT_WEBHOOK_SECRET is not set', {
			source: 'api/webhooks/revenuecat'
		})
		return NextResponse.json(
			{ error: 'RevenueCat webhook is not configured on this deployment' },
			{ status: 503 }
		)
	}

	const expected = Buffer.from(`Bearer ${secret}`)
	const provided = Buffer.from(req.headers.get('authorization') ?? '')
	// timingSafeEqual throws on unequal lengths, so a length mismatch is answered
	// before it is called.
	if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
		log.warn('revenuecat webhook refused: wrong or missing authorization', {
			source: 'api/webhooks/revenuecat'
		})
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}
	return null
}

export async function POST(req: NextRequest) {
	const denied = requireWebhookSecret(req)
	if (denied) return denied

	let e: RcEvent
	try {
		const body = await req.json()
		e = (body?.event ?? {}) as RcEvent
	} catch {
		return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
	}

	const type = String(e.type ?? '')
	const appUserId = String(e.app_user_id ?? '')
	const environment = String(e.environment ?? 'PRODUCTION').toLowerCase() // 'production' | 'sandbox'
	const store = e.store ? String(e.store).toLowerCase() : undefined

	if (!appUserId) return NextResponse.json({ ok: true, skipped: 'no app_user_id' })

	const isActive = ACTIVE.has(type)
	const isInactive = INACTIVE.has(type)
	const isBilling = BILLING.has(type)
	if (!isActive && !isInactive && !isBilling) {
		return NextResponse.json({ ok: true, skipped: type })
	}

	try {
		const supabase = createSecretKeyClient()
		const status = statusFor(e, type)
		const expiresAt = e.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null

		// Entitlement (`plan_type`) is separate from the reporting bucket. A user in
		// a trial or a grace period still HAS access, so plan_type stays 'premium';
		// whether they count as a paying customer is decided from
		// premium_status / premium_source / premium_environment when the Play Stats
		// API buckets them. Conflating the two is how trials get reported as sales.
		const update: EntitlementPatch = isInactive
			? {
					planType: 'free',
					premiumSource: null,
					premiumEnvironment: null,
					premiumStatus: status,
					premiumWillRenew: false,
					premiumExpiresAt: expiresAt ? new Date(expiresAt) : null
				}
			: {
					planType: 'premium',
					premiumSource: sourceFor(store),
					premiumEnvironment: environment,
					premiumStatus: status,
					premiumStore: store ?? null,
					// A text column: whatever RevenueCat sent, as text, as it was stored before.
					premiumProduct: e.product_id == null ? null : String(e.product_id),
					premiumExpiresAt: expiresAt ? new Date(expiresAt) : null,
					// Cancelled means auto-renew is off but access continues to period end.
					premiumWillRenew: type !== 'CANCELLATION' && status !== 'expired',
					...(e.purchased_at_ms ? { premiumStartedAt: new Date(e.purchased_at_ms) } : {})
				}

		// No profile with this id updates nothing and is not an error, as before.
		await profileStore.applyEntitlement(appUserId, update)

		// ── Record first-party, so the admin screens and cohorts can see it ──────
		// Sandbox is excluded here too: a TestFlight purchase in the revenue chart
		// is the same lie as a TestFlight tester in the paid-user count.
		const localEvent = localEventFor(type, e)
		if (localEvent && environment !== 'sandbox') {
			await recordUserEvent(appUserId, localEvent, {
				// Money is never deduped by day: a customer's second purchase must not
				// be merged into their first.
				dedupeDaily: false,
				metadata: {
					product_id: e.product_id ?? null,
					store: store ?? null,
					...(typeof e.price_in_purchased_currency === 'number' && e.currency
						? {
								price_cents: Math.round(e.price_in_purchased_currency * 100),
								currency: e.currency.toLowerCase()
							}
						: {})
				}
			})
		}

		// ── Tell the platform, so the matching email flow fires ──────────────────
		// Sandbox purchases are excluded: a TestFlight tester must not receive a
		// real purchase receipt, and they are not a customer to win back either.
		const playEvent = playEventFor(type, e)
		if (playEvent && environment !== 'sandbox') {
			// The entitlement above is written. This read only fills in the email event,
			// so a failure is logged and the event goes out with the defaults, as it
			// did before, rather than failing the webhook into a retry that would
			// record the purchase twice.
			const profile = await profileStore.playEventProfile(appUserId).catch((err: unknown) => {
				log.error('revenuecat webhook profile read failed', {
					source: 'api/webhooks/revenuecat',
					err
				})
				return null
			})
			const { data: authUser } = await supabase.auth.admin.getUserById(appUserId)

			await trackPlayEvent(
				playEvent,
				{
					id: appUserId,
					email: authUser?.user?.email ?? undefined,
					plan: status === 'trialing' ? 'trial' : (profile?.planType ?? 'free'),
					country: profile?.region ?? undefined,
					locale: profile?.locale ?? undefined,
					marketing_consent: profile?.marketingConsent === true
				},
				{
					plan: status === 'trialing' ? 'trial' : 'premium',
					product_id: e.product_id,
					// Integer minor units plus an ISO 4217 currency, never a float.
					...(typeof e.price_in_purchased_currency === 'number' && e.currency
						? {
								price_cents: Math.round(e.price_in_purchased_currency * 100),
								currency: e.currency.toLowerCase()
							}
						: {}),
					...(expiresAt ? { expires_at: expiresAt, access_until: expiresAt } : {}),
					...(e.is_trial_conversion ? { from_trial: true } : {}),
					...(e.cancel_reason ? { reason: e.cancel_reason } : {})
				},
				// RevenueCat retries deliveries. A stable id per (user, event, period)
				// means a redelivery dedupes instead of sending a second receipt.
				{ eventId: `rc:${appUserId}:${type}:${e.expiration_at_ms ?? e.purchased_at_ms ?? ''}` }
			)
		}

		return NextResponse.json({ ok: true, type, app_user_id: appUserId, status })
	} catch (err) {
		log.error('revenuecat webhook update failed', { source: 'api/webhooks/revenuecat', err })
		return NextResponse.json({ error: 'Update failed' }, { status: 500 })
	}
}
