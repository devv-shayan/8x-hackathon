import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Auth guard for the Play Stats API (/api/dashboard/v1/*).
 *
 * The internal plays-dashboard calls these routes server-to-server with
 *   Authorization: Bearer <DASHBOARD_API_KEY>
 * where DASHBOARD_API_KEY is a long random secret shared between this app's env
 * (Vercel) and the dashboard's encrypted connection store.
 *
 * Returns a NextResponse to short-circuit with, or null when authorized. If
 * DASHBOARD_API_KEY is not set the API is considered disabled (503), so deploys
 * without the env var expose nothing.
 */
export function requireDashboardKey(req: NextRequest): NextResponse | null {
	const expected = process.env.DASHBOARD_API_KEY
	if (!expected) {
		return NextResponse.json(
			{ error: 'Dashboard API is not configured on this deployment' },
			{ status: 503 }
		)
	}

	const header = req.headers.get('authorization') ?? ''
	const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''

	if (!provided || !constantTimeEqual(provided, expected)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	return null
}

function constantTimeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a)
	const bufB = Buffer.from(b)
	if (bufA.length !== bufB.length) return false
	return timingSafeEqual(bufA, bufB)
}
