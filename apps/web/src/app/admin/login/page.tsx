'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrandMark } from '@/components/BrandMark'
import { ERROR_NOTE, FIELD, PRIMARY_BUTTON } from '@/components/formStyles'
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

	return (
		<div className="l-sans grid min-h-screen place-items-center bg-[rgb(var(--l-paper))] px-5 text-[rgb(var(--l-ink))]">
			<div className="w-full max-w-sm">
				<div className="mb-8">
					<p className="flex items-center gap-2 text-[17px] font-semibold">
						<BrandMark />
						chalkback
					</p>
					<p className="l-mono mt-8 flex items-center gap-2.5">
						<span aria-hidden="true" className="h-3 w-0.5 bg-[rgb(var(--l-lime-tick))]" />
						Admin
					</p>
					<h1 className="mt-3 text-3xl font-medium tracking-[-0.03em]">Admin sign in</h1>
					<p className="mt-2 text-sm text-[rgb(var(--l-muted))]">
						Restricted to accounts with admin access.
					</p>
				</div>

				<form
					onSubmit={onSubmit}
					className="space-y-3 border border-[rgb(var(--l-hair))] p-6 sm:p-7"
				>
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="you@email.com"
						aria-label="Email"
						className={FIELD}
					/>
					<input
						type="password"
						required
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Password"
						aria-label="Password"
						className={FIELD}
					/>
					{error && (
						<p role="alert" className={ERROR_NOTE}>
							{error}
						</p>
					)}
					<button type="submit" disabled={loading} className={`${PRIMARY_BUTTON} w-full`}>
						<span aria-hidden="true">&gt;</span>
						{loading ? 'Signing in…' : 'Sign in'}
					</button>
				</form>
			</div>
		</div>
	)
}
