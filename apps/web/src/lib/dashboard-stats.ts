/**
 * The numbers behind the Play Stats API and the admin panel: what each one
 * means, computed from rows the Play Stats store fetches.
 *
 * ONE definition of "paid user", in one place. When the admin screen and the
 * dashboard disagree on a number, nobody knows which to trust and both stop
 * being used — so both read from here.
 *
 * Contract this implements: Play Stats API, 2026-08-14. Ask the dashboard
 * for the current version before changing anything here;
 * the contract moves and this file is a snapshot of it.
 */

import { playStatsStore, type StatsProfile } from '@/server/db/play-stats'
import { log } from '@/server/lib/logger'

/**
 * Every scan here reads EVERY row, never a first page.
 *
 * This is THE trap on this endpoint. Two plays shipped `users_by_country` as a
 * single scan capped at PostgREST's 1,000 rows and reported 4% and 9% country
 * coverage against real figures near 82% and 87% — a split that thin reads as
 * "this play cannot answer per-market", and nothing on screen looked broken.
 * The reads come from the Play Stats store (src/server/db/play-stats.ts), which
 * has no cap. If a scan cannot finish, it throws, and the caller OMITS the
 * field rather than publishing a partial one.
 */

/**
 * The reserved non-paying plan buckets. Every other key in `users_by_plan`
 * counts as PAID by the dashboard, so a bucket name that is not on this list is
 * revenue as far as the platform is concerned.
 */
export const NON_PAYING_BUCKETS = ['free', 'granted', 'promo', 'sandbox', 'test', 'trial'] as const

export type ProfileRow = StatsProfile

/**
 * Which bucket a profile belongs in. Mutually exclusive; the buckets sum to
 * users_total.
 *
 * Order is deliberate and each step encodes a way this has gone wrong before:
 *  - sandbox FIRST, because a sandbox purchase fires the same lifecycle events
 *    as a real one and would otherwise be counted as a sale;
 *  - comps and promos next, because they are premium in-app but are not revenue;
 *  - trial before paid, because a trial user has access without having paid, and
 *    `trial` is a reserved non-paying bucket in the contract.
 */
export function bucketFor(p: {
	plan_type: string | null
	premium_source: string | null
	premium_environment: string | null
	premium_status: string | null
}): string {
	if (p.plan_type !== 'premium') return 'free'
	if (p.premium_environment === 'sandbox') return 'sandbox'
	if (p.premium_source === 'grant') return 'granted'
	if (p.premium_source === 'promo') return 'promo'
	if (p.premium_status === 'trialing') return 'trial'
	return 'premium'
}

/** True when this profile is a real paying customer. */
export function isPaid(p: Parameters<typeof bucketFor>[0]): boolean {
	return !(NON_PAYING_BUCKETS as readonly string[]).includes(bucketFor(p))
}

export interface SummaryCounts {
	usersTotal: number
	byPlan: Record<string, number>
	byCountry: Record<string, number>
	paidByCountry: Record<string, number>
	trialByCountry: Record<string, number>
	newUsers7d: number
	newUsers30d: number
	/** Share of accounts carrying a country. Below ~50% usually means the app
	 *  isn't capturing region at signup, not that the query is wrong. */
	countryCoverage: number
}

/**
 * One full scan of profiles → every count the summary endpoint reports.
 *
 * A single pass rather than one query per field: at these volumes the scan is
 * cheap and it guarantees the splits are internally consistent — computed from
 * the same rows at the same moment, so a split can never exceed its own total
 * because a user changed plan between two queries.
 */
export async function getSummaryCounts(now = new Date()): Promise<SummaryCounts> {
	const rows = await playStatsStore.statsProfiles()

	const byPlan: Record<string, number> = {}
	const byCountry: Record<string, number> = {}
	const paidByCountry: Record<string, number> = {}
	const trialByCountry: Record<string, number> = {}
	let newUsers7d = 0
	let newUsers30d = 0
	let withCountry = 0

	const ms = now.getTime()
	const DAY = 86_400_000

	for (const r of rows) {
		const bucket = bucketFor(r)
		byPlan[bucket] = (byPlan[bucket] ?? 0) + 1

		const country = normalizeCountry(r.region)
		if (country) {
			withCountry++
			byCountry[country] = (byCountry[country] ?? 0) + 1
			if (isPaid(r)) paidByCountry[country] = (paidByCountry[country] ?? 0) + 1
			if (bucket === 'trial') trialByCountry[country] = (trialByCountry[country] ?? 0) + 1
		}

		if (r.created_at) {
			const age = ms - new Date(r.created_at).getTime()
			if (age <= 7 * DAY) newUsers7d++
			if (age <= 30 * DAY) newUsers30d++
		}
	}

	// Guarantee every reserved bucket exists, so a play with no trials reports
	// trial: 0 rather than omitting the key and looking like it cannot answer.
	for (const b of NON_PAYING_BUCKETS) byPlan[b] ??= 0
	byPlan.premium ??= 0

	return {
		usersTotal: rows.length,
		byPlan,
		byCountry,
		paidByCountry,
		trialByCountry,
		newUsers7d,
		newUsers30d,
		countryCoverage: rows.length > 0 ? withCountry / rows.length : 0
	}
}

export interface RetentionCohort {
	date: string
	signups: number
	d1?: number
	d7?: number
	d30?: number
}

/**
 * Retention cohorts: for each signup day, how many of that day's accounts were
 * active again on EXACTLY day 1, 7 and 30 afterwards.
 *
 * For a play with no PostHog this is the only way the dashboard can show
 * retention at all — GA4 reports aggregates with no per-person data, so there
 * are no cohorts in it to count.
 *
 * Three rules the contract is strict about, each of which silently corrupts the
 * numbers when broken:
 *
 *  - EXACTLY day N, not "within N days". A rolling definition reads
 *    considerably higher and is not comparable to the benchmarks.
 *  - `signups` is the denominator and must be the same population the retained
 *    counts came from. The dashboard's other signup figure counts analytics
 *    VISITORS; dividing account-based retained counts by that would publish a
 *    rate under half the truth with nothing on screen looking wrong.
 *  - An immature `d7`/`d30` is OMITTED, never sent as 0. A cohort from
 *    yesterday has not had 7 days to come back; reporting 0 says nobody
 *    returned, which is a different claim from "we don't know yet".
 *
 * Send the whole history on the first sync: unlike PostHog, which only sees
 * forward from install, your database already knows what happened last quarter,
 * and the dashboard keeps rows older than its 60-day window permanently.
 */
export async function getRetentionCohorts(
	now = new Date(),
	windowDays = 180
): Promise<RetentionCohort[]> {
	const since = new Date(now.getTime() - windowDays * 86_400_000)

	const rows = await playStatsStore.statsProfiles()
	const cohortOf = new Map<string, string>() // userId → signup UTC day
	const signups = new Map<string, number>()

	for (const r of rows) {
		if (!r.created_at) continue
		const created = new Date(r.created_at)
		if (created < since) continue
		const day = created.toISOString().slice(0, 10)
		cohortOf.set(r.id, day)
		signups.set(day, (signups.get(day) ?? 0) + 1)
	}
	if (cohortOf.size === 0) return []

	// Activity comes from first-party events. Anything the user did counts;
	// anonymous rows (user_id null) are irrelevant here because a cohort member is
	// by definition an account.
	const active = new Map<string, Set<number>>() // userId → set of day-offsets seen
	for await (const batch of playStatsStore.accountActivitySince(since)) {
		for (const e of batch) {
			const cohort = cohortOf.get(e.userId)
			if (!cohort) continue
			// The event's UTC day, as the cohort's is.
			const offset = Math.floor(
				(Date.parse(e.createdAt.toISOString().slice(0, 10)) - Date.parse(cohort)) / 86_400_000
			)
			if (offset <= 0) continue
			let set = active.get(e.userId)
			if (!set) active.set(e.userId, (set = new Set()))
			set.add(offset)
		}
	}

	const retained: Record<string, { d1: number; d7: number; d30: number }> = {}
	for (const [userId, cohort] of cohortOf) {
		const offsets = active.get(userId)
		if (!offsets) continue
		const r = (retained[cohort] ??= { d1: 0, d7: 0, d30: 0 })
		if (offsets.has(1)) r.d1++
		if (offsets.has(7)) r.d7++
		if (offsets.has(30)) r.d30++
	}

	const today = Date.parse(now.toISOString().slice(0, 10))
	const out: RetentionCohort[] = []
	for (const [date, count] of [...signups].sort(([a], [b]) => a.localeCompare(b))) {
		const ageDays = Math.floor((today - Date.parse(date)) / 86_400_000)
		const r = retained[date]
		const cohort: RetentionCohort = { date, signups: count }
		// Only include a window the cohort has actually had time to complete.
		if (ageDays >= 1) cohort.d1 = r?.d1 ?? 0
		if (ageDays >= 7) cohort.d7 = r?.d7 ?? 0
		if (ageDays >= 30) cohort.d30 = r?.d30 ?? 0
		out.push(cohort)
	}
	return out
}

/**
 * Drop any bucket set that overshoots its total.
 *
 * A split is a PARTITION: covering less than the total is fine and shows as
 * unattributed, but covering more is the play contradicting itself. The
 * dashboard drops such a split silently, which is indistinguishable from never
 * having sent it — so catch it here, where it can be logged.
 */
export function assertPartition(
	label: string,
	buckets: Record<string, number>,
	total: number
): Record<string, number> | undefined {
	const sum = Object.values(buckets).reduce((a, b) => a + b, 0)
	if (sum === 0) return undefined
	if (sum > total) {
		// Omitted: the dashboard drops an over-covering split silently, and an
		// absent field is at least honest about being absent.
		log.error('split omitted: it sums to more than the total', {
			source: 'dashboard-stats',
			split: label,
			sum,
			total
		})
		return undefined
	}
	return buckets
}

/** ISO 3166-1 alpha-2, or null. Anything else folds into the unattributed
 *  remainder rather than being guessed at. */
export function normalizeCountry(raw: string | null | undefined): string | null {
	const v = (raw ?? '').trim().toUpperCase()
	return /^[A-Z]{2}$/.test(v) ? v : null
}
