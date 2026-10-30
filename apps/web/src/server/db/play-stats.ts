import type { PrismaClient } from '@prisma/client'
import { db, Prisma } from './client'
import { postgrestTime, type PostgrestTimestamp } from './postgrest-time'

// The reads behind the Play Stats API (src/app/api/dashboard/v1/) and the admin screens that
// show the same numbers. What the rows MEAN (who is paid, what a cohort is) is decided in
// src/lib/dashboard-stats.ts, one definition in one place; this file only fetches them.
//
// The API's contract is the stats dashboard's (AGENTS.md, non-negotiable 2): these queries
// return exactly the rows the PostgREST calls they replaced returned, in the same order, and
// the roster renders its timestamps the way PostgREST did (./postgrest-time).
//
// analytics_events.user_id is nullable (guests); nothing here inner-joins it to profiles.

/** The profile columns the summary buckets by (dashboard-stats' ProfileRow). */
export type StatsProfile = {
	id: string
	created_at: Date | null
	plan_type: string
	premium_source: string | null
	premium_environment: string | null
	premium_status: string | null
	region: string | null
}

/** One signed-in event: who, and when. */
export type AccountActivity = { userId: string; createdAt: Date }

/**
 * Which accounts the roster lists. Each is a filter on profile columns, so pagination counts
 * the right rows:
 *  - paying: a production purchase that is not a comp, a promo or a trial;
 *  - trial, granted, promo, sandbox, free: those buckets;
 *  - all: everyone.
 * NULL compares as unknown, as it did in the PostgREST filters: a premium profile with no
 * premium_environment, premium_source or premium_status is not in `paying`.
 */
export type RosterFilter = 'all' | 'paying' | 'trial' | 'granted' | 'promo' | 'sandbox' | 'free'

/** A roster row, in the shape and the text PostgREST returned it. */
export type RosterProfile = {
	id: string
	display_name: string | null
	created_at: PostgrestTimestamp | null
	plan_type: string
	premium_source: string | null
	premium_environment: string | null
	premium_status: string | null
	premium_started_at: PostgrestTimestamp | null
	premium_expires_at: PostgrestTimestamp | null
	premium_will_renew: boolean | null
	premium_store: string | null
	premium_product: string | null
	region: string | null
	last_seen_at: PostgrestTimestamp | null
}

/** Rows fetched per round trip when walking the event log. */
const ACTIVITY_BATCH = 5000

/** The roster's columns, as the PostgREST select named them. */
const ROSTER_SELECT = Prisma.sql`
	select p.id::text as id, p.display_name, ${postgrestTime('p.created_at')} as created_at,
	       p.plan_type, p.premium_source, p.premium_environment, p.premium_status,
	       ${postgrestTime('p.premium_started_at')} as premium_started_at,
	       ${postgrestTime('p.premium_expires_at')} as premium_expires_at,
	       p.premium_will_renew, p.premium_store, p.premium_product, p.region,
	       ${postgrestTime('p.last_seen_at')} as last_seen_at
	from public.profiles p`

export function createPlayStatsStore(client: PrismaClient) {
	return {
		/**
		 * Every profile, in id order. All of them: users_total is their count, and every split
		 * is a partition of it. No page cap to work around, unlike PostgREST's 1,000 rows.
		 */
		async statsProfiles(): Promise<StatsProfile[]> {
			const rows = await client.profile.findMany({
				select: {
					id: true,
					createdAt: true,
					planType: true,
					premiumSource: true,
					premiumEnvironment: true,
					premiumStatus: true,
					region: true
				},
				orderBy: { id: 'asc' }
			})
			return rows.map((r) => ({
				id: r.id,
				created_at: r.createdAt,
				plan_type: r.planType,
				premium_source: r.premiumSource,
				premium_environment: r.premiumEnvironment,
				premium_status: r.premiumStatus,
				region: r.region
			}))
		},

		/**
		 * Every signed-in event since `since`, a batch at a time (keyset on id), so a long window
		 * is never held in memory at once. Anonymous rows are excluded: this is for account
		 * cohorts, and a guest is not in one.
		 */
		async *accountActivitySince(since: Date): AsyncGenerator<AccountActivity[]> {
			let after: string | undefined
			for (;;) {
				const batch = await client.analyticsEvent.findMany({
					where: {
						userId: { not: null },
						createdAt: { gte: since },
						...(after ? { id: { gt: after } } : {})
					},
					select: { id: true, userId: true, createdAt: true },
					orderBy: { id: 'asc' },
					take: ACTIVITY_BATCH
				})
				if (batch.length > 0) {
					yield batch.map((e) => ({ userId: e.userId as string, createdAt: e.createdAt }))
				}
				if (batch.length < ACTIVITY_BATCH) return
				after = batch[batch.length - 1]!.id
			}
		},

		/**
		 * The user ids of the newest events with this name, signed-in only, one page of them
		 * (a user repeats if they fired it twice). Anonymous rows are excluded by construction:
		 * a funnel-stage roster names accounts.
		 */
		async userIdsForEvent(name: string, offset: number, limit: number): Promise<string[]> {
			const rows = await client.analyticsEvent.findMany({
				where: { name, userId: { not: null } },
				select: { userId: true },
				orderBy: { createdAt: 'desc' },
				skip: offset,
				take: limit
			})
			return rows.map((r) => r.userId as string)
		},

		/** One page of the roster, newest account first. */
		async rosterPage(
			filter: RosterFilter,
			offset: number,
			limit: number
		): Promise<RosterProfile[]> {
			return client.$queryRaw<RosterProfile[]>`
				${ROSTER_SELECT}
				where case ${filter}::text
				  when 'all' then true
				  when 'paying' then p.plan_type = 'premium'
				                 and p.premium_environment <> 'sandbox'
				                 and not (p.premium_source in ('grant', 'promo'))
				                 and p.premium_status <> 'trialing'
				  when 'trial' then p.plan_type = 'premium' and p.premium_status = 'trialing'
				  when 'granted' then p.premium_source = 'grant'
				  when 'promo' then p.premium_source = 'promo'
				  when 'sandbox' then p.premium_environment = 'sandbox'
				  when 'free' then p.plan_type <> 'premium'
				end
				order by p.created_at desc
				limit ${limit} offset ${offset}`
		},

		/** These accounts' roster rows, in no particular order (as before). */
		async rosterByIds(ids: string[]): Promise<RosterProfile[]> {
			return client.$queryRaw<RosterProfile[]>`
				${ROSTER_SELECT}
				where p.id = any(${ids}::uuid[])`
		}
	}
}

export type PlayStatsStore = ReturnType<typeof createPlayStatsStore>

export const playStatsStore = createPlayStatsStore(db)
