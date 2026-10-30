import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { recordUserEvent, TRACKED_EVENTS } from '@/lib/analytics/record'
import { getRequestCountry } from '@/lib/geo'

export const runtime = 'nodejs'

/**
 * Per-event metadata the client may send, and which of those fields widen the
 * dedupe key.
 *
 * The client must NOT be able to choose the dedupe key: a caller sending a fresh
 * discriminator on every request would bypass dedupe entirely and write
 * unbounded rows. So the discriminator set is decided HERE, per event name, and
 * anything else in `metadata` is dropped. That also bounds an anonymous session
 * to at most one row per (event, discriminator value) per UTC day.
 *
 * ADD TO THIS when you register an event that fires once per *thing*. Without an
 * entry, the dedupe key is (visitor, name, day) alone: the first item a visitor
 * opens that day is recorded and every other one is silently dropped, so the
 * per-item breakdown reads as real data while being fiction.
 */
const EVENT_DISCRIMINATORS: Record<string, readonly string[]> = {
	plan_selected: ['plan'],
	upgrade_view: ['source'],
	checkout_started: ['plan'],
	store_badge_clicked: ['store'],
	cta_clicked: ['cta'],
	faq_opened: ['question']
}

const MAX_VALUE_LEN = 64

/** Keep only the declared discriminators, string-valued and length-capped. */
function sanitize(name: string, raw: unknown): Record<string, string> {
	const allowed = EVENT_DISCRIMINATORS[name]
	if (!allowed || typeof raw !== 'object' || raw === null) return {}
	const out: Record<string, string> = {}
	for (const key of allowed) {
		const v = (raw as Record<string, unknown>)[key]
		if (typeof v === 'string' && v.length > 0) out[key] = v.slice(0, MAX_VALUE_LEN)
	}
	return out
}

/**
 * First-party funnel beacon. Client components POST
 * { name, path, sessionId, metadata } here.
 *
 * Records signed-in AND anonymous visits. Anonymous rows carry `user_id: null`
 * and are identified by `metadata.session_id` — guests are most of the top of
 * funnel, and dropping them makes landing → signup conversion uncomputable.
 */
export async function POST(request: NextRequest) {
	let body: { name?: string; path?: string; sessionId?: string; metadata?: unknown }
	try {
		body = await request.json()
	} catch {
		return NextResponse.json({ ok: false }, { status: 400 })
	}

	const name = typeof body.name === 'string' ? body.name : ''
	if (!TRACKED_EVENTS.includes(name as (typeof TRACKED_EVENTS)[number])) {
		// Deliberately a 400 rather than a silent 200: an unregistered name is a
		// bug in the call site, and `npm run check:events` catches it before here.
		return NextResponse.json({ ok: false, error: 'unregistered_event' }, { status: 400 })
	}

	if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
		return NextResponse.json({ ok: true, skipped: 'not_configured' })
	}

	const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : ''

	const supabase = await createServerSupabaseClient()
	const {
		data: { user }
	} = await supabase.auth.getUser()

	// Anonymous rows need a session id: it is their only identity, the join key
	// back to analytics_pageviews, and what bounds how much one visitor can write.
	if (!user && !sessionId) return NextResponse.json({ ok: true, skipped: 'no_identity' })

	const metadata = sanitize(name, body.metadata)

	await recordUserEvent(user?.id ?? null, name, {
		path: typeof body.path === 'string' ? body.path.slice(0, 200) : undefined,
		sessionId: sessionId || undefined,
		metadata,
		// Every field the client may send is a discriminator by construction, so
		// this keeps per-item counts honest.
		dedupeMatch: metadata,
		// Edge geo of THIS request — fresher than the stored profile.
		// recordUserEvent falls back to the profile region when this is null.
		country: await getRequestCountry()
	})

	return NextResponse.json({ ok: true })
}
