import { env } from './env'
import { supabase } from './supabase'

/**
 * Tell the web backend there is an authenticated session.
 *
 * In a monorepo play, signup happens HERE, in the app — not on the marketing
 * site. So without this call three things never happen, all of them silently:
 *
 *   1. `user_signed_up` is never emitted, and it is the Tier 1 event the
 *      platform's welcome series is triggered by. No event, no welcome email,
 *      ever, and nothing anywhere reports an error.
 *   2. `profiles.last_seen_at` is never written, so the daily lifecycle cron
 *      finds nobody and the win-back flow never fires either.
 *   3. `profiles.region` stays null, and it is the source of every per-market
 *      number the stats dashboard shows.
 *
 * The route verifies the access token server-side, so nothing here is trusted
 * beyond "this device holds a valid session".
 *
 * Idempotent and fire-and-forget: the route dedupes forever, so calling it on
 * every cold start costs one query and sends nothing twice. Failures are
 * swallowed — bookkeeping must never block the app from opening.
 */
const SITE_URL = env.EXPO_PUBLIC_SITE_URL ?? ''

export async function announceSession(): Promise<void> {
	if (!SITE_URL) return
	try {
		const {
			data: { session }
		} = await supabase.auth.getSession()
		if (!session?.access_token) return

		await fetch(`${SITE_URL}/api/lifecycle/session`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${session.access_token}` }
		})
	} catch {
		// intentionally silent
	}
}
