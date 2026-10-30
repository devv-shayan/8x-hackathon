/**
 * GET /api/dashboard/v1/summary
 *
 * Play Stats API — the headline counts the stats dashboard reads. This is the
 * data pipeline the Play Engineer playbook treats as a launch blocker: the
 * week-5 kill/scale decision reads from here.
 *
 * Auth: Authorization: Bearer <DASHBOARD_API_KEY> (see lib/dashboard-api-auth).
 *
 * Contract: 2026-08-14, MOBILE shape. A mobile play billing through the stores
 * via RevenueCat reports users and OMITS money entirely — RevenueCat connects to
 * the dashboard directly, and the dashboard ranks a play's own revenue copy
 * below a direct billing connection, so sending it is work that changes nothing.
 *
 * Before changing this file, get the current contract from your dashboard, e.g.:
 *   "get the latest play API docs for a mobile app play"
 *   "run integration_check on <play-slug>"
 *
 * Response:
 *   {
 *     play, users_total, users_by_plan, new_users_7d, new_users_30d,
 *     users_by_country?, paid_users_by_country?, trial_users_by_country?,
 *     retention?: { cohorts: [{ date, signups, d1?, d7?, d30? }] },
 *     generated_at
 *   }
 *
 * Optional fields are OMITTED when unanswerable — never zeroed and never
 * partial. A partial split is indistinguishable from a real answer, which is how
 * a 4% country tag sat unnoticed for months on a live play.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireDashboardKey } from '@/lib/dashboard-api-auth'
import { assertPartition, getRetentionCohorts, getSummaryCounts } from '@/lib/dashboard-stats'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLAY = process.env.PLAY_SLUG ?? 'app'

export async function GET(req: NextRequest) {
	const denied = requireDashboardKey(req)
	if (denied) return denied

	try {
		const now = new Date()
		const counts = await getSummaryCounts(now)

		const body: Record<string, unknown> = {
			play: PLAY,
			users_total: counts.usersTotal,
			users_by_plan: counts.byPlan,
			new_users_7d: counts.newUsers7d,
			new_users_30d: counts.newUsers30d,
			generated_at: now.toISOString()
		}

		// Every split is a partition of users_total. assertPartition drops one that
		// overshoots rather than letting the dashboard drop it silently.
		const byCountry = assertPartition('users_by_country', counts.byCountry, counts.usersTotal)
		if (byCountry) body.users_by_country = byCountry

		const paidByCountry = assertPartition(
			'paid_users_by_country',
			counts.paidByCountry,
			counts.usersTotal
		)
		// Without this field the dashboard falls back to enumerating the paying
		// roster at sync time, and that walk is capped at 2,000 users — past the cap
		// no per-market paid split is published at all.
		if (paidByCountry) body.paid_users_by_country = paidByCountry

		const trialByCountry = assertPartition(
			'trial_users_by_country',
			counts.trialByCountry,
			counts.usersTotal
		)
		if (trialByCountry) body.trial_users_by_country = trialByCountry

		// Retention is the expensive part of this endpoint. It is also the only
		// retention the dashboard can show for a play with no PostHog, so it is
		// worth the scan — but a failure here must not take the whole summary down
		// with it, since users_total and users_by_plan are the required fields.
		try {
			const cohorts = await getRetentionCohorts(now)
			if (cohorts.length > 0) body.retention = { cohorts }
		} catch (err) {
			log.error('retention omitted from the summary', { source: 'api/dashboard/v1/summary', err })
		}

		return NextResponse.json(body)
	} catch (err) {
		log.error('summary failed', { source: 'api/dashboard/v1/summary', err })
		return NextResponse.json({ error: 'Failed to compute summary' }, { status: 500 })
	}
}
