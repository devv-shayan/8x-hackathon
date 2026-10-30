import type { Prisma, PrismaClient } from '@prisma/client'
import { db } from './client'

// The first-party event log (prisma/schema/analytics.prisma), written by
// src/lib/analytics/record.ts and counted by the admin panel. The Play Stats API's reads of
// it are in ./play-stats.
//
// user_id is nullable: guests are most of the funnel, identified by metadata->>'session_id'.
// Nothing here joins these tables to profiles.

/** Who a dedupe lookup is for: a signed-in account, or an anonymous session. */
export type Visitor = { userId: string } | { sessionId: string }

export type DuplicateQuery = {
	name: string
	visitor: Visitor
	/** Metadata fields that must also match, e.g. { plan: 'pro' }. Empty: any metadata. */
	match: Record<string, string>
	/** Only rows at or after this instant count; null for all time. */
	since: Date | null
}

export type NewEvent = {
	userId: string | null
	name: string
	path: string | null
	/** JSON-serialisable. Omitted, the column is NULL. */
	metadata?: Record<string, unknown>
}

export type NewPageview = {
	userId: string | null
	sessionId: string
	path: string
	dwellMs: number
}

export function createAnalyticsStore(client: PrismaClient) {
	return {
		/**
		 * Whether this visitor already has a matching event. Raw SQL on purpose, and the one
		 * query here that is: the session lookup must compare `metadata->>'session_id'` as text,
		 * the expression analytics_events_session_idx indexes (Prisma's JSON filter compares
		 * jsonb and would scan the day's events instead), and user lookups ride
		 * analytics_events_user_idx the same way. `match` is jsonb containment, which for the
		 * string values the callers pass is the text equality it replaced.
		 */
		async hasDuplicate({ name, visitor, match, since }: DuplicateQuery): Promise<boolean> {
			const matchJson = JSON.stringify(match)
			const rows =
				'userId' in visitor
					? await client.$queryRaw<{ found: boolean }[]>`
						select exists (
							select 1 from public.analytics_events
							where name = ${name}
							  and user_id = ${visitor.userId}::uuid
							  and (${matchJson}::jsonb = '{}'::jsonb or metadata @> ${matchJson}::jsonb)
							  and (${since}::timestamptz is null or created_at >= ${since}::timestamptz)
						) as found`
					: await client.$queryRaw<{ found: boolean }[]>`
						select exists (
							select 1 from public.analytics_events
							where name = ${name}
							  and user_id is null
							  and metadata->>'session_id' = ${visitor.sessionId}
							  and (${matchJson}::jsonb = '{}'::jsonb or metadata @> ${matchJson}::jsonb)
							  and (${since}::timestamptz is null or created_at >= ${since}::timestamptz)
						) as found`
			return rows[0]?.found === true
		},

		async insertEvent({ userId, name, path, metadata }: NewEvent): Promise<void> {
			await client.analyticsEvent.create({
				data: {
					userId,
					name,
					path,
					...(metadata ? { metadata: metadata as Prisma.InputJsonObject } : {})
				}
			})
		},

		async insertPageview({ userId, sessionId, path, dwellMs }: NewPageview): Promise<void> {
			await client.analyticsPageview.create({ data: { userId, sessionId, path, dwellMs } })
		},

		/** How many events with this name arrived at or after `since`. */
		async countSince(name: string, since: Date): Promise<number> {
			return client.analyticsEvent.count({ where: { name, createdAt: { gte: since } } })
		}
	}
}

export type AnalyticsStore = ReturnType<typeof createAnalyticsStore>

export const analyticsStore = createAnalyticsStore(db)
