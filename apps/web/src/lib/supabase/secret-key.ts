import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { AuthOnlySupabaseClient } from './auth-only'

// A network error reaching Supabase Auth, as opposed to Auth answering "no". Re-exported so
// callers can tell the two apart without importing the SDK (ESLint bans that outside
// src/lib/supabase/).
export { isAuthRetryableFetchError } from '@supabase/supabase-js'

let cached: AuthOnlySupabaseClient | null = null

/**
 * Supabase with the secret key (sb_secret_…, the replacement for the legacy service_role
 * JWT). Server-only, for Auth's admin API: verifying an app's bearer token, looking up a
 * user's email, listing and deleting users. Never call it from anything reachable by a
 * request that has not already been verified as trusted (a session, a bearer token, a
 * webhook secret, a cron secret, the dashboard key). From template-web.
 *
 * It has no business touching application data either way, which is Prisma's job, and the
 * return type makes a data call a compile error (docs/rules/auth.md).
 *
 * Accepts either URL name (SUPABASE_URL, or the NEXT_PUBLIC_SUPABASE_URL Vercel usually has)
 * and the legacy SUPABASE_SERVICE_ROLE_KEY as a fallback. Throws when unset.
 */
export function createSecretKeyClient(): AuthOnlySupabaseClient {
	if (cached) return cached

	const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
	// Legacy fallback goes once the host sets SUPABASE_SECRET_KEY.
	const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

	if (!url || !secretKey) {
		throw new Error(
			'Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Check apps/web/.env.local (or Vercel env vars).'
		)
	}

	cached = createClient(url, secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	})
	return cached
}
