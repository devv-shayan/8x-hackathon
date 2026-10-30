import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { profileStore } from '@/server/db/profiles'

export const dynamic = 'force-dynamic'

/**
 * Server-side guard for the whole protected admin area. Anyone without a
 * session, or whose profile isn't is_admin, is bounced to the login page.
 * Renders the admin shell (sidebar + header) around the page.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	// Resolve the signed-in admin. Any failure — including Supabase or the
	// database not yet configured on a fresh clone — is treated as "not an admin"
	// and bounced to the login page, so /admin never crashes with a raw stack
	// trace.
	let user: { id: string; email: string | null } | null = null
	try {
		const supabase = await createServerSupabaseClient()
		const {
			data: { user: authUser }
		} = await supabase.auth.getUser()
		if (authUser && (await profileStore.isAdmin(authUser.id))) {
			user = { id: authUser.id, email: authUser.email ?? null }
		}
	} catch {
		user = null
	}

	if (!user) redirect('/admin/login')

	const nav = [
		{ href: '/admin', label: 'Overview' },
		{ href: '/admin/users', label: 'Users' },
		{ href: '/admin/analytics', label: 'Analytics' }
	]

	return (
		<div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
			<aside className="border-b border-border-soft p-5 md:border-b-0 md:border-r">
				<Link href="/admin" className="flex items-center gap-2 font-bold">
					<span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-background">
						A
					</span>
					Admin
				</Link>
				<nav className="mt-8 flex gap-2 md:flex-col">
					{nav.map((n) => (
						<Link
							key={n.href}
							href={n.href}
							className="rounded-lg px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface2 hover:text-ink"
						>
							{n.label}
						</Link>
					))}
				</nav>
			</aside>

			<div>
				<header className="flex items-center justify-between border-b border-border-soft px-6 py-4">
					<span className="text-sm text-ink-mute">{user.email}</span>
					<Link href="/" className="text-sm text-ink-soft hover:text-ink">
						← Back to site
					</Link>
				</header>
				<main className="p-6">{children}</main>
			</div>
		</div>
	)
}
