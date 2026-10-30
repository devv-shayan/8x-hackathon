import { endpoints, type Profile } from '@app/contract'
import { LIFECYCLE_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { trackPlayEvent } from '@/lib/plays/events'
import { ApiError } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { unauthorized, type AppUser } from '@/server/auth/require-user'
import { profileStore, type AppProfile } from '@/server/db/profiles'
import { log } from '@/server/lib/logger'
import { avatarUrlFor, isOwnAvatarPath, removeAvatars } from '@/server/storage/avatars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/app/v1/profile: the signed-in person's own profile. */
export const GET = createAppRoute(endpoints.getProfile, async ({ user }) => {
	const profile = await profileStore.appProfile(user.id)
	return { body: { profile: await toWireProfile(user, profile) } }
})

/**
 * PATCH /api/app/v1/profile: the person's own settings, and only those four (the contract
 * refuses any other key with a 400, so plan_type and premium_* can't even be sent: AGENTS.md,
 * non-negotiable 3). Answers with the whole profile as it now is.
 *
 * - `avatar_path` must be an upload of the caller's own (POST /api/app/v1/uploads); their
 *   other avatar files, the one replaced and uploads never saved, are removed after.
 * - `marketing_consent`: a change fires `marketing_consent_changed`, first-party and to the
 *   Play Events API, so the platform's email automation follows the person's choice. Sending
 *   the value it already has fires nothing.
 */
export const PATCH = createAppRoute(endpoints.updateProfile, async ({ user, body }) => {
	if (body.avatar_path && !isOwnAvatarPath(user.id, body.avatar_path)) {
		throw new ApiError('invalid_request', 'Some of what was sent is not valid.', {
			issues: [{ path: 'avatar_path', message: 'Not an upload of yours. Upload the file first.' }]
		})
	}

	const saved = await profileStore.updateOwnSettings(user.id, {
		displayName: body.display_name,
		avatarUrl: body.avatar_path,
		locale: body.locale,
		marketingConsent: body.marketing_consent
	})
	// The account was deleted after requireUser() checked the token: nothing was written.
	if (!saved) throw unauthorized()
	const { profile, consentChanged } = saved

	if (consentChanged) await reportConsentChange(user, profile)
	if (body.avatar_path !== undefined) await tidyAvatars(user.id, body.avatar_path)

	return { body: { profile: await toWireProfile(user, profile) } }
})

async function toWireProfile(user: AppUser, row: AppProfile | null): Promise<Profile> {
	return {
		id: user.id,
		email: user.email,
		display_name: row?.displayName || user.fullName,
		avatar_url: await avatarUrl(user.id, row?.avatarUrl ?? null),
		// Read-only, decided by the RevenueCat webhook alone.
		plan: row?.planType === 'premium' ? 'premium' : 'free',
		locale: row?.locale ?? null,
		marketing_consent: row?.marketingConsent ?? false,
		created_at: row?.createdAt?.toISOString() ?? null
	}
}

// A storage failure costs the picture, not the profile: the person still gets their name,
// plan and settings (the app shows initials), and the failure is logged.
async function avatarUrl(userId: string, stored: string | null): Promise<string | null> {
	try {
		return await avatarUrlFor(userId, stored)
	} catch (err) {
		log.error('avatar not signed; sent the profile without it', {
			source: 'api/app/v1/profile',
			err
		})
		return null
	}
}

// Never throws: both senders swallow and log their own failures.
async function reportConsentChange(user: AppUser, profile: AppProfile) {
	const subscribed = profile.marketingConsent
	await recordUserEvent(user.id, LIFECYCLE_EVENTS.marketingConsentChanged, {
		path: '/api/app/v1/profile',
		metadata: { subscribed },
		// Every change is a row: on, then off, the same day is two decisions.
		dedupeDaily: false
	})
	await trackPlayEvent(
		'marketing_consent_changed',
		{
			id: user.id,
			email: user.email ?? undefined,
			locale: profile.locale ?? undefined,
			marketing_consent: subscribed
		},
		{ subscribed, source: 'app' }
	)
}

// Best effort: a leftover file is private and unreachable, not worth failing the save for.
async function tidyAvatars(userId: string, keep: string | null) {
	try {
		await removeAvatars(userId, { keep: keep ?? undefined })
	} catch (err) {
		log.warn('old avatar files not removed', { source: 'api/app/v1/profile', err })
	}
}
