'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

type Status = 'idle' | 'loading' | 'done' | 'error'

/**
 * Submits an account-deletion request by email to /api/delete-account.
 * (In-app, a logged-in user hits the same route with a session and is deleted
 * immediately; this public form records a request for users who can't sign in.)
 */
export function DeleteAccountForm() {
	const [status, setStatus] = useState<Status>('idle')
	const [message, setMessage] = useState('')

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault()
		const form = new FormData(e.currentTarget)
		setStatus('loading')
		try {
			const res = await fetch('/api/delete-account', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: String(form.get('email') ?? ''), confirm: true })
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
			setStatus('done')
			setMessage(data.message ?? 'Your deletion request has been received.')
		} catch (err) {
			setStatus('error')
			setMessage(err instanceof Error ? err.message : 'Something went wrong')
		}
	}

	if (status === 'done') {
		return (
			<p className="flex items-center gap-2 rounded-input border border-brand-border bg-brand-dim px-5 py-4 text-sm font-medium text-ink">
				<Check className="h-4 w-4 text-brand-ink" /> {message}
			</p>
		)
	}

	return (
		<form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
			<input
				name="email"
				type="email"
				required
				placeholder="Email on your account"
				aria-label="Email"
				className="min-h-12 flex-1 rounded-input border border-line-soft bg-well px-4 py-3 text-ink transition-colors duration-fast hover:border-line-active focus-visible:border-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus/40"
			/>
			<button
				type="submit"
				disabled={status === 'loading'}
				className="inline-flex min-h-12 items-center justify-center rounded-button bg-error px-5 py-3 font-semibold text-on-error transition-[transform,opacity] duration-fast hover:opacity-90 active:scale-[0.96] disabled:opacity-60"
			>
				{status === 'loading' ? 'Submitting…' : 'Request deletion'}
			</button>
			{status === 'error' && <p className="text-sm text-error-text sm:hidden">{message}</p>}
		</form>
	)
}
