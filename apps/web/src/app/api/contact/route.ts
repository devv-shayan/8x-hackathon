import { NextRequest, NextResponse } from 'next/server'
import { leadStore } from '@/server/db/leads'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** POST { name, email, message } → insert into `contact_messages`. */
export async function POST(req: NextRequest) {
	let name = '',
		email = '',
		message = ''
	try {
		const body = await req.json()
		name = String(body?.name ?? '').trim()
		email = String(body?.email ?? '')
			.trim()
			.toLowerCase()
		message = String(body?.message ?? '').trim()
	} catch {
		return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
	}

	if (!name || !EMAIL_RE.test(email) || message.length < 2) {
		return NextResponse.json(
			{ error: 'Please fill in your name, a valid email, and a message' },
			{ status: 400 }
		)
	}
	if (message.length > 5000) {
		return NextResponse.json({ error: 'Message is too long' }, { status: 400 })
	}

	try {
		await leadStore.addContactMessage({ name, email, message, category: 'general' })
		return NextResponse.json({ ok: true })
	} catch (err) {
		log.error('contact message failed', { source: 'api/contact', err })
		return NextResponse.json(
			{ error: 'Could not send your message. Please try again.' },
			{ status: 500 }
		)
	}
}
