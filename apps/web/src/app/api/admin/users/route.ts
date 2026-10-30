import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createSecretKeyClient } from '@/lib/supabase/secret-key'
import { profileStore } from '@/server/db/profiles'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users?page=1&perPage=50
 * Admin-only. Lists auth users joined with their profile (plan + admin flag).
 */
export async function GET(req: NextRequest) {
	const auth = await requireAdmin()
	if ('response' in auth) return auth.response

	const url = new URL(req.url)
	const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
	const perPage = Math.min(200, Math.max(1, Number(url.searchParams.get('perPage') ?? '50') || 50))

	try {
		const supabase = createSecretKeyClient()
		const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
		if (error) throw error

		// A failed profile read is a 500, rather than a list with everyone free.
		const profiles = await profileStore.adminRows(data.users.map((u) => u.id))
		const profileById = new Map(profiles.map((p) => [p.id, p]))

		const users = data.users.map((u) => {
			const p = profileById.get(u.id)
			return {
				id: u.id,
				email: u.email ?? null,
				created_at: u.created_at,
				last_sign_in_at: u.last_sign_in_at ?? null,
				plan_type: p?.plan_type ?? 'free',
				is_admin: p?.is_admin ?? false,
				region: p?.region ?? null
			}
		})

		return NextResponse.json({ page, perPage, users })
	} catch (err) {
		log.error('admin user list failed', { source: 'api/admin/users', err })
		return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
	}
}
