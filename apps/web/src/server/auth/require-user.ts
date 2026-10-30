import type { AuthOnlySupabaseClient } from '@/lib/supabase/auth-only'
import { createSecretKeyClient, isAuthRetryableFetchError } from '@/lib/supabase/secret-key'
import { ApiError } from '@/server/api/app-errors'

/** The person a verified access token belongs to. The only identity a route uses. */
export type AppUser = {
	id: string
	email: string | null
	/**
	 * `user_metadata.full_name`, which the app's onboarding saves. The person sets it, so it
	 * is for showing back to them, never for deciding anything.
	 */
	fullName: string | null
}

/**
 * The person calling an /api/app/v1 route, from `Authorization: Bearer <access
 * token>` and nothing else: no cookies, so no ambient credential a web page can
 * ride on, and never an id from the request (docs/rules/auth.md).
 *
 * Supabase Auth verifies the token server-side (`auth.getUser(token)`), the
 * authoritative check: it also refuses a token whose session was revoked or
 * whose user was deleted, which a local signature check would accept until the
 * token expires. Throws an ApiError:
 *
 *  - 401 `unauthorized`: no Bearer token, an empty one, or one Supabase refuses
 *    (malformed, expired, revoked, user gone)
 *  - 503 `unavailable`: Supabase couldn't be reached, so the token was never
 *    checked. Not a 401: the app must not sign out a session that may be fine.
 *  - 503 `not_configured`: this deployment has no Supabase credentials
 */
export async function requireUser(req: Request): Promise<AppUser> {
	const header = req.headers.get('authorization')?.trim() ?? ''
	const match = /^bearer\s+(.+)$/i.exec(header)
	// Checked before Supabase is asked: getUser('') does not verify an empty
	// token, it falls back to the client's own session.
	const token = match?.[1]?.trim()
	if (!token) throw unauthorized()

	let client: AuthOnlySupabaseClient
	try {
		client = createSecretKeyClient()
	} catch (cause) {
		throw new ApiError('not_configured', "Sign-in isn't set up on this server yet.", { cause })
	}

	let result: Awaited<ReturnType<AuthOnlySupabaseClient['auth']['getUser']>>
	try {
		result = await client.auth.getUser(token)
	} catch (cause) {
		throw unavailable(cause)
	}
	const { data, error } = result
	if (data?.user) {
		const fullName: unknown = data.user.user_metadata?.full_name
		return {
			id: data.user.id,
			email: data.user.email ?? null,
			fullName: typeof fullName === 'string' && fullName.trim() ? fullName.trim() : null
		}
	}
	if (isAuthRetryableFetchError(error)) throw unavailable(error)
	throw unauthorized(error)
}

/** The 401 for a session that no longer stands, from here or from a route that found out later. */
export function unauthorized(cause?: unknown) {
	return new ApiError('unauthorized', 'Your session has expired. Sign in again.', { cause })
}

function unavailable(cause: unknown) {
	return new ApiError('unavailable', "We couldn't check your session. Try again in a moment.", {
		cause
	})
}
