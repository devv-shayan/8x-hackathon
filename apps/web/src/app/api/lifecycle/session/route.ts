import { NextResponse, type NextRequest } from 'next/server'
import { createSecretKeyClient } from '@/lib/supabase/secret-key'
import { recordUserEvent } from '@/lib/analytics/record'
import { LIFECYCLE_EVENTS } from '@/lib/analytics/events'
import { trackPlayEvent } from '@/lib/plays/events'
import { getRequestCountry } from '@/lib/geo'
import { profileStore } from '@/server/db/profiles'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Called by the MOBILE APP once whenever it has an authenticated session — on
 * sign-in and on cold start.
 *
 * This exists because in a monorepo play, signup happens in the Expo app, not on
 * this marketing site. Without it three things simply never happen:
 *
 *  1. **`user_signed_up` is never emitted.** It is a Tier 1 event, and it is
 *     what the platform's welcome series is triggered by. No event, no welcome
 *     email, ever — and nothing anywhere reports an error.
 *  2. **`profiles.last_seen_at` is never written.** The daily lifecycle cron
 *     selects on it, so `user_inactive` finds nobody and the win-back flow never
 *     fires either.
 *  3. **`profiles.region` stays null.** It is the source of every per-market
 *     number the stats dashboard shows, so the market filter has nothing to
 *     narrow and the play reports one whole-play total forever.
 *
 * Auth is the caller's own Supabase access token, verified here — NOT a trusted
 * user id in the body, which would let anyone fabricate signups for arbitrary
 * accounts. From the app:
 *
 *   const { data: { session } } = await supabase.auth.getSession()
 *   await fetch(`${SITE_URL}/api/lifecycle/session`, {
 *     method: 'POST',
 *     headers: { Authorization: `Bearer ${session.access_token}` },
 *   })
 *
 * Idempotent: `dedupeForever` plus a stable `event_id` mean calling it on every
 * launch costs one query and sends nothing twice.
 */
export async function POST(req: NextRequest) {
	const header = req.headers.get('authorization') ?? ''
	const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
	if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

	try {
		const supabase = createSecretKeyClient()

		// Resolve the caller from their token. The identity comes from Supabase,
		// never from the request body.
		const { data: authData, error: authError } = await supabase.auth.getUser(token)
		const user = authData?.user
		if (authError || !user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const country = await getRequestCountry()

		const profile = await profileStore.sessionProfile(user.id)

		// Region is written once and then left alone: it is the market the account
		// belongs to, not wherever they happen to be today. Overwriting it on every
		// launch would move a user's whole history between markets the first time
		// they opened the app abroad.
		await profileStore.recordSession(user.id, {
			seenAt: new Date(),
			...(country && !profile?.region ? { region: country } : {})
		})

		// Lifetime-once. A re-login, or a cold start, must never look like a second
		// signup.
		await recordUserEvent(user.id, LIFECYCLE_EVENTS.signupCompleted, {
			dedupeForever: true,
			country: country ?? profile?.region ?? null,
			metadata: { signup_method: user.app_metadata?.provider ?? 'email' }
		})

		if (user.email) {
			await trackPlayEvent(
				'user_signed_up',
				{
					id: user.id,
					email: user.email,
					name: profile?.displayName ?? undefined,
					country: country ?? profile?.region ?? undefined,
					locale: profile?.locale ?? undefined,
					plan: profile?.planType ?? 'free',
					marketing_consent: profile?.marketingConsent === true
				},
				{ signup_method: user.app_metadata?.provider ?? 'email' },
				// Stable per user: the platform dedupes on it, so the welcome series
				// fires once no matter how often the app calls this.
				{ eventId: `signup:${user.id}` }
			)
		}

		return NextResponse.json({ ok: true })
	} catch (err) {
		// Never fail the caller. This is bookkeeping, not the user's request.
		log.error('session bookkeeping failed', { source: 'api/lifecycle/session', err })
		return NextResponse.json({ ok: true })
	}
}
