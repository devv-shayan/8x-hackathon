/**
 * GET /api/dashboard/v1/users?limit=50&cursor=<opaque>&plan=<p>&stage=<s>
 *
 * Play Stats API — the play's user roster, and the list the dashboard walks when
 * a per-country field is absent from /summary.
 *
 * Auth: Authorization: Bearer <DASHBOARD_API_KEY> (see lib/dashboard-api-auth).
 * Contract: 2026-08-14. Check the dashboard's contract before changing this.
 *
 * User shape:
 *   { id, email, name, plan, granted, country, currency, created_at,
 *     last_seen_at, subscription? }
 *
 * `plan` reports PAYING status only. Comps (`grant`), RevenueCat promos, sandbox
 * purchases and trials all report a non-paying bucket, so none is ever counted
 * as a conversion. The bucketing lives in lib/dashboard-stats.ts and is shared
 * with /summary and the admin panel — one definition of "paid user".
 *
 * Pagination is page-based: `cursor` is an opaque string that is really a page
 * number. Pass `next_cursor` back verbatim; it is null on the last page. Bad
 * params fall back to defaults rather than erroring.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSecretKeyClient } from '@/lib/supabase/secret-key'
import { requireDashboardKey } from '@/lib/dashboard-api-auth'
import { bucketFor, isPaid, normalizeCountry } from '@/lib/dashboard-stats'
import { playStatsStore, type RosterFilter, type RosterProfile } from '@/server/db/play-stats'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

/**
 * The funnel stages this play can answer.
 *
 * A stage NOT implemented must return 400. The dashboard maps that to a friendly
 * "this play does not list users by funnel stage yet". Silently ignoring the
 * param and returning everyone makes the funnel bar list the wrong people, which
 * looks like data rather than a gap — a worse failure than an honest error.
 */
const SUPPORTED_STAGES = new Set(['checkout', 'purchase'])

/**
 * The plans the roster can be filtered to, each with the filter that lists it; `premium` means
 * paying, not plan_type. A plan is supported only if it is here, so any other value 400s, like
 * an unknown stage. `test` is a reserved non-paying bucket name in the contract (and /summary
 * reports it, always 0), but bucketFor puts nobody in it, so this play cannot list it.
 */
const PLAN_FILTERS = new Map<string, RosterFilter>([
	['free', 'free'],
	['granted', 'granted'],
	['promo', 'promo'],
	['sandbox', 'sandbox'],
	['trial', 'trial'],
	['premium', 'paying']
])
const SUPPORTED_PLANS = new Set(PLAN_FILTERS.keys())

/** Which accounts a request lists: `stage=purchase` wins over any `plan`. */
function rosterFilter(stage: string | null, plan: string | null): RosterFilter {
	if (stage === 'purchase') return 'paying'
	return (plan && PLAN_FILTERS.get(plan)) || 'all'
}

export async function GET(req: NextRequest) {
	const denied = requireDashboardKey(req)
	if (denied) return denied

	const params = req.nextUrl.searchParams
	const limit = clamp(Number.parseInt(params.get('limit') ?? '', 10) || DEFAULT_LIMIT, 1, MAX_LIMIT)
	const page = Math.max(1, Number.parseInt(params.get('cursor') ?? '', 10) || 1)
	const stage = params.get('stage')
	const plan = params.get('plan')

	if (stage && !SUPPORTED_STAGES.has(stage)) {
		return NextResponse.json(
			{
				error: `Unsupported stage "${stage}". This play answers: ${[...SUPPORTED_STAGES].join(', ')}`
			},
			{ status: 400 }
		)
	}
	if (plan && !SUPPORTED_PLANS.has(plan)) {
		return NextResponse.json(
			{ error: `Unknown plan "${plan}". This play answers: ${[...SUPPORTED_PLANS].join(', ')}` },
			{ status: 400 }
		)
	}

	// Emails come from Supabase Auth, below. Made first, outside the try, as before: a
	// deployment without Supabase configured fails the request rather than answering a
	// roster with no emails.
	const supabase = createSecretKeyClient()
	const from = (page - 1) * limit

	try {
		let profiles: RosterProfile[]

		if (stage === 'checkout') {
			// Everyone who reached checkout, from this play's own first-party events.
			// Anonymous rows are excluded by construction: a funnel-stage roster names
			// accounts, and a guest has no name to give.
			const userIds = await playStatsStore.userIdsForEvent('checkout_started', from, limit)
			const ids = [...new Set(userIds)]
			profiles = ids.length ? await playStatsStore.rosterByIds(ids) : []
		} else {
			// The plan filter is a set of column filters (src/server/db/play-stats.ts) rather
			// than post-filtering, so pagination counts the right rows.
			profiles = await playStatsStore.rosterPage(rosterFilter(stage, plan), from, limit)
		}

		// Email lives in auth.users, not profiles. One lookup per row on the page,
		// in parallel — a page is at most 100 rows, and there is no admin API to
		// fetch a set of users by id.
		const emails = await Promise.all(
			profiles.map(async (p) => {
				try {
					const { data } = await supabase.auth.admin.getUserById(p.id)
					return data?.user?.email ?? null
				} catch {
					return null
				}
			})
		)

		const users = profiles.map((p, i) => {
			const bucket = bucketFor(p)
			return {
				id: p.id,
				email: emails[i],
				name: p.display_name,
				plan: isPaid(p) ? 'premium' : bucket,
				granted: p.premium_source === 'grant',
				country: normalizeCountry(p.region),
				currency: null,
				created_at: p.created_at,
				last_seen_at: p.last_seen_at,
				...(p.premium_status
					? {
							subscription: {
								// The BILLING status, which outranks the period type. A trial
								// whose conversion charge failed keeps period_type 'trial' while
								// RevenueCat extends the expiry through payment recovery, so
								// period-type-first logic reports a failed conversion as a
								// healthy month-long trial. The webhook resolves this before
								// storing; see app/api/webhooks/revenuecat/route.ts.
								status: p.premium_status,
								started_at: p.premium_started_at,
								ends_at: p.premium_expires_at,
								will_renew: p.premium_will_renew,
								store: p.premium_store,
								// Without product, a monthly subscription and an annual trial
								// are indistinguishable on the trial roster.
								product: p.premium_product
							}
						}
					: {})
			}
		})

		return NextResponse.json({
			users,
			next_cursor: profiles.length === limit ? String(page + 1) : null
		})
	} catch (err) {
		log.error('user roster failed', { source: 'api/dashboard/v1/users', err })
		return NextResponse.json({ error: 'Failed to list users' }, { status: 502 })
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}
