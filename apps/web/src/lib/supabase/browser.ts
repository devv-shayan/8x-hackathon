'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { AuthOnlySupabaseClient } from './auth-only'

let cached: AuthOnlySupabaseClient | null = null

/**
 * The browser's Supabase client (a singleton), for Client Components that sign a person in
 * or out, such as the admin login form. Auth only, like the server wrappers
 * (docs/rules/auth.md). Reads the public URL and the publishable key, falling back to the
 * legacy NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function createBrowserSupabaseClient(): AuthOnlySupabaseClient {
	if (cached) return cached
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	// Legacy fallback goes once the host sets NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
	const key =
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	if (!url || !key) {
		throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
	}
	cached = createBrowserClient(url, key)
	return cached
}
