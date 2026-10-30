import { createClient, isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
import { env } from './env'
import { log } from './logger'

/**
 * Supabase on the device is sign-in and nothing else (docs/rules/mobile-data.md,
 * docs/rules/auth.md). Data goes through the API (lib/api.ts), which sends the
 * session's access token; the server decides what the person may read.
 *
 * The client is typed to its auth surface, so `supabase.from()` and `.rpc()` are
 * type errors, and this is the only file that may import `@supabase/*` (ESLint
 * bans it everywhere else). A play that adopts Supabase realtime widens the type
 * here, deliberately, to add 'channel' | 'removeChannel'; never 'from' or 'rpc'.
 */
export type AuthOnlySupabaseClient = Pick<SupabaseClient, 'auth'>

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY =
	env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * True when Supabase credentials are present. When false, nothing may call the
 * client: every sign-in path checks this first and says sign-in isn't set up,
 * and the API client reports "not configured" instead of sending a request.
 */
export const isSupabaseEnabled = !!SUPABASE_URL && !!SUPABASE_KEY

if (!isSupabaseEnabled) {
	log.warn(
		'Supabase is not configured (EXPO_PUBLIC_SUPABASE_URL or its publishable key is unset); ' +
			'sign-in is off. See "Environment variables" in apps/mobile/README.md.'
	)
}

// createClient needs a URL and a key to construct at all. Unconfigured, it gets
// inert ones and no session is ever stored; the isSupabaseEnabled checks keep
// every call away from them.
export const supabase: AuthOnlySupabaseClient = createClient(
	SUPABASE_URL || 'https://not-configured.invalid',
	SUPABASE_KEY || 'not-configured',
	{
		auth: {
			storage: AsyncStorage,
			autoRefreshToken: isSupabaseEnabled,
			persistSession: isSupabaseEnabled,
			detectSessionInUrl: false
		}
	}
)

// Refresh tokens while the app is in the foreground only.
if (isSupabaseEnabled) {
	AppState.addEventListener('change', (state) => {
		if (state === 'active') {
			supabase.auth.startAutoRefresh()
		} else {
			supabase.auth.stopAutoRefresh()
		}
	})
}

// ─── The access token, for the API client ─────────────────────────────────────
// lib/api.ts sends it as `Authorization: Bearer …`. These keep the SDK's error
// types in this file, so nothing else needs to import them.

export type AccessToken =
	| { token: string }
	/** No session on this device. */
	| { failure: 'signed_out' }
	/** A session exists, but refreshing its token couldn't reach Supabase. */
	| { failure: 'offline' }

/**
 * The current session's access token. getSession() refreshes one that has
 * expired (or is about to) first. A refresh that couldn't reach Supabase is
 * `offline`, not `signed_out`: the session may be fine, and the person must
 * not be signed out for a dropped connection.
 */
export async function currentAccessToken(): Promise<AccessToken> {
	const { data, error } = await supabase.auth.getSession()
	if (data.session?.access_token) return { token: data.session.access_token }
	if (error && isAuthRetryableFetchError(error)) return { failure: 'offline' }
	return { failure: 'signed_out' }
}

/**
 * A new access token, after the server refused the current one (a 401). It can
 * be a token that expired between the check and the request, or a clock that
 * is off; a refresh settles which. A refused refresh means the session is over.
 */
export async function refreshedAccessToken(): Promise<AccessToken> {
	const { data, error } = await supabase.auth.refreshSession()
	if (data.session?.access_token) return { token: data.session.access_token }
	if (error && isAuthRetryableFetchError(error)) return { failure: 'offline' }
	return { failure: 'signed_out' }
}

/**
 * End a session the server no longer accepts, on this device only (the server
 * already ended it). The auth listener in app/_layout.tsx sees SIGNED_OUT and
 * routes to the signed-out screens.
 */
export async function endRejectedSession(): Promise<void> {
	const { error } = await supabase.auth.signOut({ scope: 'local' })
	if (error) log.warn('Could not end a session the server refused', { error })
}
