'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { DANGER_BUTTON, ERROR_NOTE, FIELD, SENT_NOTE } from './formStyles'

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
			<p role="status" className={SENT_NOTE}>
				<Check className="h-4 w-4" aria-hidden="true" /> {message}
			</p>
		)
	}

	return (
		<form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
			<div className="flex flex-col gap-3 sm:flex-row">
				<input
					name="email"
					type="email"
					required
					placeholder="Email on your account"
					aria-label="Email"
					className={`${FIELD} min-h-11 flex-1`}
				/>
				<button type="submit" disabled={status === 'loading'} className={DANGER_BUTTON}>
					{status === 'loading' ? 'Submitting…' : 'Request deletion'}
				</button>
			</div>
			{status === 'error' && (
				<p role="alert" className={ERROR_NOTE}>
					{message}
				</p>
			)}
		</form>
	)
}
