'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'

export default function AdminLoginPage() {
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError('')
		setLoading(true)
		try {
			const supabase = createBrowserSupabaseClient()
			const { error } = await supabase.auth.signInWithPassword({ email, password })
			if (error) throw error
			router.replace('/admin')
			router.refresh()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Sign-in failed')
			setLoading(false)
		}
	}

	const field =
		'w-full rounded-xl border border-border-active bg-surface px-4 py-3 text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none'

	return (
		<div className="grid min-h-screen place-items-center px-5">
			<div className="w-full max-w-sm">
				<div className="mb-8 text-center">
					<span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-accent text-background">
						A
					</span>
					<h1 className="mt-4 text-2xl font-bold">Admin sign in</h1>
					<p className="mt-1 text-sm text-ink-mute">Restricted to accounts with admin access.</p>
				</div>

				<form onSubmit={onSubmit} className="card space-y-4 p-7">
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="you@email.com"
						aria-label="Email"
						className={field}
					/>
					<input
						type="password"
						required
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Password"
						aria-label="Password"
						className={field}
					/>
					{error && <p className="text-sm text-danger">{error}</p>}
					<button
						type="submit"
						disabled={loading}
						className="btn-primary w-full disabled:opacity-60"
					>
						{loading ? 'Signing in…' : 'Sign in'}
					</button>
				</form>
			</div>
		</div>
	)
}
