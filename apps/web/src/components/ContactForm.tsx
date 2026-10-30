'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'

type Status = 'idle' | 'loading' | 'done' | 'error'

/** POSTs to /api/contact, which stores the message in `contact_messages`. */
export function ContactForm() {
	const [status, setStatus] = useState<Status>('idle')
	const [message, setMessage] = useState('')

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault()
		const form = new FormData(e.currentTarget)
		const payload = {
			name: String(form.get('name') ?? ''),
			email: String(form.get('email') ?? ''),
			message: String(form.get('message') ?? '')
		}
		setStatus('loading')
		try {
			const res = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
			gaEvent(FUNNEL_EVENTS.contactSubmitted)
			setStatus('done')
			setMessage('Thanks — we got your message and will reply by email.')
		} catch (err) {
			setStatus('error')
			setMessage(err instanceof Error ? err.message : 'Something went wrong')
		}
	}

	if (status === 'done') {
		return (
			<p
				role="status"
				className="flex items-center gap-2 rounded-input border border-brand-border bg-brand-dim px-5 py-4 text-sm font-medium text-ink"
			>
				<Check className="h-4 w-4 text-brand-ink" aria-hidden="true" /> {message}
			</p>
		)
	}

	const field =
		'w-full rounded-input border border-line-soft bg-well px-4 py-3 text-ink transition-colors duration-fast hover:border-line-active focus-visible:border-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus/40'

	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<input
				name="name"
				required
				placeholder="Your name"
				aria-label="Your name"
				className={field}
			/>
			<input
				name="email"
				type="email"
				required
				placeholder="you@email.com"
				aria-label="Email"
				className={field}
			/>
			<textarea
				name="message"
				required
				rows={5}
				placeholder="How can we help?"
				aria-label="Message"
				className={field}
			/>
			<button
				type="submit"
				disabled={status === 'loading'}
				className="inline-flex min-h-12 items-center justify-center rounded-button bg-brand px-6 font-semibold text-on-brand shadow-cta transition-[transform,background-color] duration-fast hover:bg-brand-hover active:scale-[0.96] disabled:opacity-60"
			>
				{status === 'loading' ? 'Sending…' : 'Send message'}
			</button>
			{status === 'error' && (
				<p role="alert" className="text-sm font-medium text-error-text">
					{message}
				</p>
			)}
		</form>
	)
}
