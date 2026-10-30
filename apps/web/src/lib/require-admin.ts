import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { profileStore } from '@/server/db/profiles'

export interface AdminUser {
	id: string
	email: string | null
}

/**
 * Guard for server-side admin API routes. Confirms there's a valid session AND
 * that the user's `profiles.is_admin = true`.
 *
 * Returns either { user } on success or { response } with the appropriate
 * NextResponse for the route to return directly.
 */
export async function requireAdmin(): Promise<{ user: AdminUser } | { response: NextResponse }> {
	const supabase = await createServerSupabaseClient()
	const {
		data: { user }
	} = await supabase.auth.getUser()

	if (!user) {
		return { response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
	}

	if (!(await profileStore.isAdmin(user.id))) {
		return { response: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) }
	}

	return { user: { id: user.id, email: user.email ?? null } }
}
