'use client'

import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'

type Status = 'idle' | 'loading' | 'done' | 'error'

/**
 * Email capture that POSTs to /api/waitlist. The route upserts into the
 * `waitlist` table (see supabase migrations). Fully functional once Supabase
 * env vars are set; degrades to an error message otherwise.
 */
export function WaitlistForm() {
	const [email, setEmail] = useState('')
	const [status, setStatus] = useState<Status>('idle')
	const [message, setMessage] = useState('')

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!email) return
		setStatus('loading')
		try {
			const res = await fetch('/api/waitlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
			// Fired on success only. Firing on submit would count failed attempts as
			// signups and quietly inflate the top of the funnel.
			gaEvent(FUNNEL_EVENTS.waitlistJoined)
			setStatus('done')
			setMessage("You're on the list — we'll be in touch.")
		} catch (err) {
			setStatus('error')
			setMessage(err instanceof Error ? err.message : 'Something went wrong')
		}
	}

	if (status === 'done') {
		return (
			<p
				role="status"
				className="flex items-center gap-2 rounded-[1.75rem] border border-line-soft bg-surface px-5 py-3.5 text-sm font-medium text-ink sm:rounded-pill"
			>
				<Check className="h-4 w-4 text-brand-ink" aria-hidden="true" /> {message}
			</p>
		)
	}

	return (
		<form onSubmit={onSubmit} className="w-full max-w-md">
			<div className="flex flex-col gap-1.5 rounded-[1.75rem] border border-line-soft bg-surface p-1.5 text-ink shadow-soft focus-within:ring-2 focus-within:ring-line-focus sm:flex-row sm:rounded-pill">
				<input
					type="email"
					required
					autoComplete="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="you@email.com"
					aria-label="Email address"
					aria-invalid={status === 'error' || undefined}
					aria-describedby={status === 'error' ? 'waitlist-error' : undefined}
					className="min-h-11 flex-1 rounded-[1.375rem] bg-transparent px-4 text-ink focus-visible:outline-none sm:rounded-pill"
				/>
				<button
					type="submit"
					disabled={status === 'loading'}
					className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[1.375rem] bg-ink px-5 font-semibold text-ink-inverse transition-[transform,background-color] duration-fast hover:bg-ink/90 active:scale-[0.96] disabled:opacity-60 sm:rounded-pill"
				>
					{status === 'loading' ? 'Joining…' : 'Tell me at launch'}
					{status !== 'loading' && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
				</button>
			</div>
			{status === 'error' && (
				<p id="waitlist-error" role="alert" className="mt-2 text-sm font-medium">
					{message}
				</p>
			)}
		</form>
	)
}
