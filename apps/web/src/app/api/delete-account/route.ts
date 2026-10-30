import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deleteAccount } from '@/server/account/delete-account'
import { ApiError } from '@/server/api/app-errors'
import { requireUser } from '@/server/auth/require-user'
import { leadStore } from '@/server/db/leads'
import { log } from '@/server/lib/logger'

export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/delete-account
 *
 * Three paths:
 *  1. Bearer token (the mobile app's in-app "Delete account", Apple 5.1.1(v)):
 *     `Authorization: Bearer <Supabase access token>`. The token is verified
 *     by Supabase and the user it belongs to is deleted immediately. Builds
 *     from before the app moved onto /api/app/v1 call this; newer ones call
 *     DELETE /api/app/v1/account. Both run requireUser() and deleteAccount(), and this
 *     path keeps its own response bodies for the builds already installed.
 *     It stays until no supported build calls it (docs/rules/mobile-data.md).
 *  2. Authenticated (a valid Supabase session — e.g. an in-app webview while
 *     logged in): the signed-in user is deleted immediately via the secret key.
 *     The on_auth_user_deleted trigger deletes their profile, and its foreign keys
 *     tear down the rest (prisma/schema/migrations/20260924000100_user_references_through_profiles).
 *  3. Unauthenticated request by { email, confirm: true } from the public page:
 *     records a deletion request in `contact_messages` (category 'deletion') for
 *     the team to process and confirm. We never reveal whether the email exists.
 */
export async function POST(req: NextRequest) {
	// ── Path 1: the app's bearer token ──
	// A request that carries a Bearer token is answered here and nowhere else.
	// Paths 2 and 3 answer 200 to things that are not a deletion (path 3 only
	// records a request), and the app would tell the person their account is
	// gone while it still exists.
	const authorization = req.headers.get('authorization')?.trim() ?? ''
	if (/^bearer\b/i.test(authorization)) {
		return deleteWithBearerToken(req)
	}

	// ── Path 2: authenticated self-service delete ──
	try {
		const server = await createServerSupabaseClient()
		const {
			data: { user }
		} = await server.auth.getUser()
		if (user) {
			await deleteAccount({ id: user.id, email: user.email ?? null })
			return NextResponse.json({ ok: true, message: 'Your account has been deleted.' })
		}
	} catch (err) {
		// If env isn't configured, fall through to the request path below.
		log.error('self-service deletion failed', { source: 'api/delete-account', err })
	}

	// ── Path 3: email-based deletion request ──
	let email = ''
	let confirm = false
	try {
		const body = await req.json()
		email = String(body?.email ?? '')
			.trim()
			.toLowerCase()
		confirm = Boolean(body?.confirm)
	} catch {
		return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
	}

	if (!EMAIL_RE.test(email) || !confirm) {
		return NextResponse.json(
			{ error: 'Enter the email on your account and confirm the request' },
			{ status: 400 }
		)
	}

	try {
		await leadStore.addContactMessage({
			name: 'Account deletion request',
			email,
			message: `Account deletion requested for ${email} via the public page.`,
			category: 'deletion'
		})
	} catch (err) {
		log.error('deletion request not recorded', { source: 'api/delete-account', err })
		// Still return success — never leak whether the account exists.
	}

	return NextResponse.json({
		ok: true,
		message: 'Your deletion request has been received. We will confirm by email within 30 days.'
	})
}

/**
 * Path 1. The same requireUser() and deleteAccount() as DELETE
 * /api/app/v1/account: the account deleted is whoever Supabase says the token
 * belongs to, never an id or email from the request.
 *
 * Only the response bodies differ, and they must not change: builds already
 * installed read them. A missing, malformed, expired or revoked token is a 401
 * and deletes nobody; Supabase unreachable is a 503; every other failure is a
 * 500, so the app shows it rather than signing the person out of an account
 * that still exists.
 */
async function deleteWithBearerToken(req: NextRequest) {
	try {
		const user = await requireUser(req)
		await deleteAccount(user)
		return NextResponse.json({ ok: true, message: 'Your account has been deleted.' })
	} catch (err) {
		if (err instanceof ApiError && err.code === 'unauthorized') {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (err instanceof ApiError && err.code === 'unavailable') {
			log.error('token check could not reach Supabase', {
				source: 'api/delete-account',
				err: err.cause ?? err
			})
			return NextResponse.json(
				{ error: 'Could not verify your session. Try again.' },
				{ status: 503 }
			)
		}
		log.error('app deletion failed', {
			source: 'api/delete-account',
			err: err instanceof ApiError ? (err.cause ?? err) : err
		})
		return NextResponse.json(
			{ error: 'Your account could not be deleted. Try again.' },
			{ status: 500 }
		)
	}
}
