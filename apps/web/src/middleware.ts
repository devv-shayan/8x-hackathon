import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Refreshes the Supabase auth session on every request and forwards the rotated
 * cookies to both the browser and downstream Server Components. This is the
 * standard @supabase/ssr middleware: without it, server-side getUser() calls
 * can see a stale/expired session.
 *
 * No-ops cleanly when Supabase env vars are absent (e.g. a fresh clone), so the
 * marketing site still renders before the backend is wired up.
 */
export async function middleware(request: NextRequest) {
	const response = NextResponse.next({ request })

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL
	// Legacy fallback goes once the host sets NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
	const key =
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	if (!url || !key) return response

	const supabase = createServerClient(url, key, {
		cookies: {
			getAll() {
				return request.cookies.getAll()
			},
			setAll(items) {
				for (const { name, value } of items) request.cookies.set(name, value)
				for (const { name, value, options } of items) {
					response.cookies.set(name, value, options)
				}
			}
		}
	})

	// Touching getUser() triggers the token refresh + cookie rotation.
	await supabase.auth.getUser()

	return response
}

export const config = {
	// Run on everything except static assets and image files.
	matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
}
