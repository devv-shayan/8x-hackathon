import type { PrismaClient } from '@prisma/client'
import { db, Prisma } from './client'
import { postgrestTime, type PostgrestTimestamp } from './postgrest-time'

// The per-person table (prisma/schema/accounts.prisma). Every read and write of `profiles`
// outside the Play Stats API goes through here; the Play Stats API's own reads are in
// ./play-stats.
//
// Money and entitlement (AGENTS.md, non-negotiable 3): `applyEntitlement` is the only
// writer of plan_type and premium_*, and its only caller is the RevenueCat webhook.
// `recordSession` writes last_seen_at and region, from the lifecycle route. Both are server
// routes that verified their caller first; nothing here is reachable from a browser or the
// app. Review a diff to either twice. The one write the app reaches, through PATCH
// /api/app/v1/profile, is `updateOwnSettings`: the person's own display name, avatar, locale
// and marketing consent, by name, and nothing else.
//
// Reads throw on a database error, and a missing row is null: never an error dressed as an
// empty answer (docs/rules/database.md). Writes by id use updateMany, which matches zero
// rows without throwing, as the PostgREST update they replace did: a webhook for an app user
// id with no profile is not an error.

/** The fields of a profile the lifecycle route and its Play Event need. */
export type SessionProfile = {
	region: string | null
	displayName: string | null
	locale: string | null
	marketingConsent: boolean
	planType: string
}

/** The fields of a profile a RevenueCat Play Event is sent with. */
export type PlayEventProfile = Omit<SessionProfile, 'displayName'>

/** The person's own profile, as GET /api/app/v1/profile shows it. */
export type AppProfile = {
	displayName: string | null
	/** A path in the user-uploads bucket, or an absolute URL (src/server/storage/avatars.ts). */
	avatarUrl: string | null
	planType: string
	locale: string | null
	marketingConsent: boolean
	createdAt: Date | null
}

/**
 * What a person may change about their own profile, from PATCH /api/app/v1/profile, and
 * nothing else. Money (see the note at the top): no field here reaches plan_type, premium_*,
 * is_admin, region or last_seen_at, and `updateOwnSettings` copies these four by name, so an
 * object carrying more writes no more. undefined leaves a field as it is; null clears it.
 */
export type OwnSettings = {
	displayName?: string | null
	avatarUrl?: string | null
	locale?: string | null
	marketingConsent?: boolean
}

/** What the RevenueCat webhook writes. Money: see the note at the top. */
export type EntitlementPatch = {
	planType: 'free' | 'premium'
	premiumSource: string | null
	premiumEnvironment: string | null
	premiumStatus: string
	premiumWillRenew: boolean
	premiumExpiresAt: Date | null
	premiumStore?: string | null
	premiumProduct?: string | null
	premiumStartedAt?: Date
}

/** One row of the admin user list: the profile half, joined to auth users by id. */
export type AdminProfileRow = {
	id: string
	plan_type: string
	is_admin: boolean
	region: string | null
}

/** A subscription ending soon without renewal (the lifecycle cron). */
export type ExpiringProfile = {
	id: string
	plan_type: string
	locale: string | null
	region: string | null
	marketing_consent: boolean
	premium_expires_at: PostgrestTimestamp
	premium_product: string | null
}

/** Someone not seen since the cutoff (the lifecycle cron). */
export type InactiveProfile = {
	id: string
	plan_type: string
	locale: string | null
	region: string | null
	marketing_consent: boolean
	last_seen_at: PostgrestTimestamp
}

const APP_PROFILE = {
	displayName: true,
	avatarUrl: true,
	planType: true,
	locale: true,
	marketingConsent: true,
	createdAt: true
} as const satisfies Prisma.ProfileSelect

export function createProfileStore(client: PrismaClient) {
	// updateOwnSettings, in one transaction. Money: the four settings are copied by name.
	const writeOwnSettings = (userId: string, settings: OwnSettings) =>
		client.$transaction(async (tx) => {
			await tx.profile.createMany({ data: [{ id: userId }], skipDuplicates: true })
			let consentChanged = false
			if (settings.marketingConsent !== undefined) {
				const { count } = await tx.profile.updateMany({
					where: { id: userId, marketingConsent: !settings.marketingConsent },
					data: { marketingConsent: settings.marketingConsent }
				})
				consentChanged = count > 0
			}
			const profile = await tx.profile.update({
				where: { id: userId },
				data: {
					displayName: settings.displayName,
					avatarUrl: settings.avatarUrl,
					locale: settings.locale
				},
				select: APP_PROFILE
			})
			return { profile, consentChanged }
		})

	return {
		/** Whether this account may use the admin panel. False when there is no profile. */
		async isAdmin(userId: string): Promise<boolean> {
			const row = await client.profile.findUnique({
				where: { id: userId },
				select: { isAdmin: true }
			})
			return row?.isAdmin === true
		},

		async sessionProfile(userId: string): Promise<SessionProfile | null> {
			return client.profile.findUnique({
				where: { id: userId },
				select: {
					region: true,
					displayName: true,
					locale: true,
					marketingConsent: true,
					planType: true
				}
			})
		},

		/**
		 * Stamps the person as seen now, and sets their market when given one. The caller
		 * decides the market is written once (only while `region` is empty); this writes what it
		 * is told.
		 */
		async recordSession(
			userId: string,
			{ seenAt, region }: { seenAt: Date; region?: string }
		): Promise<void> {
			await client.profile.updateMany({
				where: { id: userId },
				data: { lastSeenAt: seenAt, ...(region ? { region } : {}) }
			})
		},

		/** The person's own profile. Null when the signup trigger never made one. */
		async appProfile(userId: string): Promise<AppProfile | null> {
			return client.profile.findUnique({ where: { id: userId }, select: APP_PROFILE })
		},

		/**
		 * Writes the person's own settings, and makes their profile row first if the signup
		 * trigger never did (the app's onboarding upserted it before /api/app/v1 existed).
		 *
		 * Null when the person has no auth user any more: a profile needs one, and the
		 * profiles_require_auth_user trigger refuses the row (20260924000400). That is an account
		 * deleted while its access token was still valid, so nothing is written for it.
		 *
		 * `consentChanged` is true only when this call flipped marketing_consent: the flip is its
		 * own conditional UPDATE, so of two requests toggling it at once, exactly one reports it.
		 */
		async updateOwnSettings(
			userId: string,
			settings: OwnSettings
		): Promise<{ profile: AppProfile; consentChanged: boolean } | null> {
			try {
				return await writeOwnSettings(userId, settings)
			} catch (err) {
				// The trigger raises SQLSTATE 23503, which Prisma reports as the foreign key it
				// stands in for.
				if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
					return null
				}
				throw err
			}
		},

		async playEventProfile(userId: string): Promise<PlayEventProfile | null> {
			return client.profile.findUnique({
				where: { id: userId },
				select: { region: true, locale: true, marketingConsent: true, planType: true }
			})
		},

		/**
		 * Writes a RevenueCat event's entitlement onto the profile whose id is the app user id.
		 * Returns how many profiles it changed: 0 when there is no such profile, which the
		 * webhook answers the same as 1, as it always has.
		 */
		async applyEntitlement(userId: string, patch: EntitlementPatch): Promise<number> {
			const { count } = await client.profile.updateMany({ where: { id: userId }, data: patch })
			return count
		},

		/** The person's stored market (ISO alpha-2), or null. */
		async regionOf(userId: string): Promise<string | null> {
			const row = await client.profile.findUnique({
				where: { id: userId },
				select: { region: true }
			})
			return row?.region ?? null
		},

		/** The profile half of the admin user list, for these auth user ids. */
		async adminRows(ids: string[]): Promise<AdminProfileRow[]> {
			const rows = await client.profile.findMany({
				where: { id: { in: ids } },
				select: { id: true, planType: true, isAdmin: true, region: true }
			})
			return rows.map((r) => ({
				id: r.id,
				plan_type: r.planType,
				is_admin: r.isAdmin,
				region: r.region
			}))
		},

		/**
		 * Subscriptions that end between `from` and `to` and will not renew. Every match: the
		 * window bounds it. Timestamps as PostgREST rendered them (./postgrest-time): the cron
		 * sends them to the Play Events API, and stamps the event id with their date.
		 */
		async expiringSubscriptions(from: Date, to: Date): Promise<ExpiringProfile[]> {
			return client.$queryRaw<ExpiringProfile[]>`
				select id::text as id, plan_type, locale, region, marketing_consent,
				       ${postgrestTime('premium_expires_at')} as premium_expires_at, premium_product
				from public.profiles
				where premium_expires_at is not null
				  and premium_will_renew = false
				  and premium_expires_at >= ${from}
				  and premium_expires_at <= ${to}`
		},

		/** Everyone last seen before `cutoff`. Timestamps as PostgREST rendered them. */
		async inactiveSince(cutoff: Date): Promise<InactiveProfile[]> {
			return client.$queryRaw<InactiveProfile[]>`
				select id::text as id, plan_type, locale, region, marketing_consent,
				       ${postgrestTime('last_seen_at')} as last_seen_at
				from public.profiles
				where last_seen_at is not null
				  and last_seen_at < ${cutoff}`
		}
	}
}

export type ProfileStore = ReturnType<typeof createProfileStore>

export const profileStore = createProfileStore(db)
