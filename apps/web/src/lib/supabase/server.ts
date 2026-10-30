import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { AuthOnlySupabaseClient } from './auth-only'

/**
 * The signed-in person's Supabase session, from the request's cookies. Auth only: this
 * project's data goes through Prisma (the stores in `src/server/db/`), and the return type
 * makes a data call a compile error (docs/rules/auth.md). From template-web.
 *
 * Use it in Server Components, route handlers and server actions that need to know who is
 * signed in. It reads the session but cannot refresh an expired one from a Server Component
 * (those cannot set cookies); src/middleware.ts refreshes it on every request first.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL plus NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, falling back to
 * the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY. Throws when either is unset; every caller treats
 * that as "nobody is signed in".
 */
export async function createServerSupabaseClient(): Promise<AuthOnlySupabaseClient> {
	const cookieStore = await cookies()
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	// Legacy fallback goes once the host sets NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
	const key =
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	if (!url || !key) {
		throw new Error(
			'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Check apps/web/.env.local (or Vercel env vars).'
		)
	}
	return createServerClient(url, key, {
		cookies: {
			getAll() {
				return cookieStore.getAll()
			},
			setAll(items) {
				try {
					for (const { name, value, options } of items) {
						cookieStore.set(name, value, options)
					}
				} catch {
					// Server Components can't set cookies, only route handlers and actions can.
					// Reading the user for a read is fine; the refresh that wants to set cookies
					// happens in middleware.
				}
			}
		}
	})
}
