'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { gaEvent } from '@/lib/analytics/client'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'
import { ERROR_NOTE, FIELD, PRIMARY_BUTTON, SENT_NOTE } from './formStyles'

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
			<p role="status" className={SENT_NOTE}>
				<Check className="h-4 w-4" aria-hidden="true" /> {message}
			</p>
		)
	}

	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<input
				name="name"
				required
				placeholder="Your name"
				aria-label="Your name"
				className={FIELD}
			/>
			<input
				name="email"
				type="email"
				required
				placeholder="you@email.com"
				aria-label="Email"
				className={FIELD}
			/>
			<textarea
				name="message"
				required
				rows={5}
				placeholder="How can we help?"
				aria-label="Message"
				className={FIELD}
			/>
			<button type="submit" disabled={status === 'loading'} className={PRIMARY_BUTTON}>
				<span aria-hidden="true">&gt;</span>
				{status === 'loading' ? 'Sending…' : 'Send message'}
			</button>
			{status === 'error' && (
				<p role="alert" className={ERROR_NOTE}>
					{message}
				</p>
			)}
		</form>
	)
}
