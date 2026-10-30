import NetInfo from '@react-native-community/netinfo'
import type { z } from 'zod'
import {
	endpoints,
	errorBodySchema,
	type Endpoint,
	type EndpointName,
	type ErrorBody,
	type ErrorCode
} from '@app/contract'
import { env } from './env'
import { log } from './logger'
import {
	currentAccessToken,
	endRejectedSession,
	isSupabaseEnabled,
	refreshedAccessToken
} from './supabase'
import { isOffline } from './useNetworkStatus'

/**
 * The app's one way to its data: a typed fetch over `/api/app/v1`, built from
 * `@app/contract`'s `endpoints` map (docs/rules/mobile-data.md).
 *
 *   const { items, next_cursor } = await api('listItems', { query: { limit: 20 } })
 *
 * - It sends the signed-in session's access token as `Authorization: Bearer …`
 *   (lib/supabase.ts refreshes it first when it has expired).
 * - It validates what it sends with the contract, and parses every response
 *   with it. A response that doesn't match is an error, never a partial result.
 * - It THROWS an ApiError on anything but a 2xx it could parse. A failed request
 *   is an error the screen shows (with its message, written for the person),
 *   never an empty list (docs/rules/error-handling.md).
 *
 * The failures it handles on purpose:
 *
 * - Not configured: no EXPO_PUBLIC_SITE_URL (or, for a signed-in route, no
 *   Supabase). `not_configured`, before any request. Screens say so plainly.
 * - Offline: fetch rejects and the phone has no connection. `offline`, at once,
 *   not after retries: the screen says so, and TanStack Query refetches when the
 *   connection comes back (lib/queryClient.ts). With a connection, the server is
 *   what couldn't be reached: `unreachable`, which is retried.
 * - Timeout: no answer in `timeoutMs` (15 s by default). `timeout`.
 * - 401: the server refused the token. One refresh and one retry settle a token
 *   that expired in flight; a second refusal means the session is over, so the
 *   app signs out of it on this device, tells the person once (onSessionExpired),
 *   and throws `unauthorized`. A 503 is never read as signed out: the server
 *   answers `unavailable` when it couldn't check the token at all.
 */

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Failures decided on the device, before or instead of a response. */
export type ClientErrorCode =
	| 'not_configured'
	| 'signed_out'
	| 'offline'
	| 'unreachable'
	| 'timeout'
	| 'invalid_response'
	| 'cancelled'

/**
 * The server's codes (`@app/contract`'s ERROR_CODES) and the device's own. A
 * string beyond both is possible, from a newer server: act on `status` then.
 */
export type ApiErrorCode = ErrorCode | ClientErrorCode | (string & {})

export class ApiError extends Error {
	readonly code: ApiErrorCode
	/** The HTTP status, or null when there was no response. */
	readonly status: number | null
	/** On a 400: which input failed. */
	readonly issues?: ErrorBody['error']['issues']
	/** For the developer, shown in development builds only: what to set up. */
	readonly hint?: string

	constructor(
		code: ApiErrorCode,
		message: string,
		options: { status?: number | null; issues?: ErrorBody['error']['issues']; hint?: string } = {}
	) {
		super(message)
		this.name = 'ApiError'
		this.code = code
		this.status = options.status ?? null
		this.issues = options.issues
		this.hint = options.hint
	}
}

const MESSAGES = {
	notConnected: "This version of the app isn't connected to its server yet.",
	signInNotSetUp: "Sign-in isn't set up in this version of the app yet.",
	signedOut: "You're signed out. Sign in again to see this.",
	offline: "You're offline. Check your connection, then try again.",
	unreachable: "We couldn't reach our server. Try again in a moment.",
	timeout: 'That took too long. Check your connection, then try again.',
	ourSide: 'Something went wrong on our side. Try again in a moment.',
	sessionExpired: 'Your session has expired. Sign in again.',
	notFound: "That doesn't exist, or it isn't yours.",
	invalid: "That didn't work. Try again.",
	cancelled: 'The request was cancelled.'
} as const

/** The message to show for any error a screen catches: the API's, or a plain fallback. */
export function errorMessage(error: unknown): string {
	return error instanceof ApiError ? error.message : MESSAGES.ourSide
}

/** The code of an ApiError, or null for anything else. */
export function errorCode(error: unknown): ApiErrorCode | null {
	return error instanceof ApiError ? error.code : null
}

// ─── Retries (TanStack Query's `retry`) ───────────────────────────────────────

const MAX_RETRIES = 2

/**
 * Retry what a second try can fix: a timeout, a server that couldn't be
 * reached, and the server's own failures. Not `offline` (a refetch on
 * reconnect does that), not a 4xx, not a response that broke the contract, and
 * not "not configured".
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
	if (failureCount >= MAX_RETRIES) return false
	if (!(error instanceof ApiError)) return false
	if (error.code === 'timeout' || error.code === 'unreachable') return true
	return error.status !== null && error.status >= 500 && error.code !== 'not_configured'
}

// ─── Session expiry ───────────────────────────────────────────────────────────

type Listener = () => void
const sessionExpiredListeners = new Set<Listener>()
let endingSession: Promise<void> | null = null

/** Called once each time the server ends a session this device held. */
export function onSessionExpired(listener: Listener): () => void {
	sessionExpiredListeners.add(listener)
	return () => {
		sessionExpiredListeners.delete(listener)
	}
}

// Several screens' requests can be refused at once: sign out, and tell the
// person, once.
function expireSession(): Promise<void> {
	endingSession ??= (async () => {
		try {
			await endRejectedSession()
			for (const listener of sessionExpiredListeners) listener()
		} finally {
			endingSession = null
		}
	})()
	return endingSession
}

// ─── Requests ─────────────────────────────────────────────────────────────────

type Endpoints = typeof endpoints
type InputOf<S> = S extends z.ZodType ? z.input<S> : never

type ParamsPart<E> = E extends { params: infer P } ? { params: InputOf<P> } : { params?: undefined }
type QueryPart<E> = E extends { query: infer Q }
	? object extends InputOf<Q>
		? { query?: InputOf<Q> }
		: { query: InputOf<Q> }
	: { query?: undefined }
type BodyPart<E> = E extends { body: infer B } ? { body: InputOf<B> } : { body?: undefined }

export type RequestOptions<N extends EndpointName> = ParamsPart<Endpoints[N]> &
	QueryPart<Endpoints[N]> &
	BodyPart<Endpoints[N]> & {
		/** TanStack Query's, so a query it cancels stops its request. */
		signal?: AbortSignal
		timeoutMs?: number
	}

export type ResponseOf<N extends EndpointName> = z.output<Endpoints[N]['response']>

/** Long enough for a slow mobile network; short enough that a spinner never spins forever. */
export const DEFAULT_TIMEOUT_MS = 15_000

export async function api<N extends EndpointName>(
	name: N,
	...[options]: object extends RequestOptions<N>
		? [options?: RequestOptions<N>]
		: [options: RequestOptions<N>]
): Promise<ResponseOf<N>> {
	const endpoint: Endpoint = endpoints[name]
	const route = `${endpoint.method} ${endpoint.path}`
	const opts = (options ?? {}) as {
		params?: Record<string, unknown>
		query?: Record<string, unknown>
		body?: unknown
		signal?: AbortSignal
		timeoutMs?: number
	}

	// Unset and REPLACE_ placeholders both arrive here as undefined (lib/env.ts).
	const siteUrl = env.EXPO_PUBLIC_SITE_URL
	if (!siteUrl) {
		throw new ApiError('not_configured', MESSAGES.notConnected, {
			hint: 'Set EXPO_PUBLIC_SITE_URL to the web app’s URL (apps/mobile/README.md, "Environment variables").'
		})
	}
	if (endpoint.auth === 'user' && !isSupabaseEnabled) {
		throw new ApiError('not_configured', MESSAGES.signInNotSetUp, {
			hint: 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (apps/mobile/README.md, "Environment variables").'
		})
	}

	const url = buildUrl(siteUrl, endpoint, route, opts.params, opts.query)
	const body = endpoint.body
		? JSON.stringify(validInput(endpoint.body, opts.body, route))
		: undefined

	let token: string | undefined
	if (endpoint.auth === 'user') token = tokenOrThrow(await currentAccessToken())

	const send = (bearer: string | undefined) =>
		sendOnce(url, endpoint.method, body, bearer, opts.signal, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)

	let res = await send(token)

	if (res.status === 401 && endpoint.auth === 'user') {
		const fresh = await refreshedAccessToken()
		if ('failure' in fresh && fresh.failure === 'offline') {
			throw new ApiError('offline', MESSAGES.offline)
		}
		if ('token' in fresh && fresh.token !== token) res = await send(fresh.token)
		if (res.status === 401 || 'failure' in fresh) {
			await expireSession()
			throw new ApiError('unauthorized', MESSAGES.sessionExpired, { status: 401 })
		}
	}

	if (!res.ok) throw await errorFrom(res)

	let json: unknown
	try {
		json = await res.json()
	} catch {
		// A wrong EXPO_PUBLIC_SITE_URL can answer 200 with a web page.
		log.error('API answered a success that is not JSON', { route, status: res.status })
		throw new ApiError('invalid_response', MESSAGES.ourSide, { status: res.status })
	}
	const parsed = endpoint.response.safeParse(json)
	if (!parsed.success) {
		log.error('API response failed its contract', {
			route,
			status: res.status,
			issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
		})
		throw new ApiError('invalid_response', MESSAGES.ourSide, { status: res.status })
	}
	return parsed.data as ResponseOf<N>
}

function tokenOrThrow(result: Awaited<ReturnType<typeof currentAccessToken>>): string {
	if ('token' in result) return result.token
	if (result.failure === 'offline') throw new ApiError('offline', MESSAGES.offline)
	throw new ApiError('signed_out', MESSAGES.signedOut)
}

// What the app sends is checked against the contract too: a request the
// server would refuse is a bug here, caught before it costs a round trip.
function validInput(schema: z.ZodType, value: unknown, route: string): unknown {
	const parsed = schema.safeParse(value)
	if (parsed.success) return parsed.data
	log.error('API request failed its contract; not sent', {
		route,
		issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
	})
	throw new ApiError('invalid_request', MESSAGES.invalid, {
		issues: parsed.error.issues.map((issue) => ({
			path: issue.path.join('.'),
			message: issue.message
		}))
	})
}

function buildUrl(
	siteUrl: string,
	endpoint: Endpoint,
	route: string,
	params: Record<string, unknown> | undefined,
	query: Record<string, unknown> | undefined
): string {
	let path: string = endpoint.path
	if (endpoint.params) {
		const valid = validInput(endpoint.params, params, route) as Record<string, unknown>
		path = path.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(String(valid[key])))
	}
	const search = new URLSearchParams()
	if (endpoint.query && query) {
		validInput(endpoint.query, query, route)
		// The values as given: the server coerces them with the same schema.
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined && value !== null) search.set(key, String(value))
		}
	}
	const qs = search.toString()
	return `${siteUrl.replace(/\/+$/, '')}${path}${qs ? `?${qs}` : ''}`
}

async function sendOnce(
	url: string,
	method: Endpoint['method'],
	body: string | undefined,
	bearer: string | undefined,
	outer: AbortSignal | undefined,
	timeoutMs: number
): Promise<Response> {
	if (outer?.aborted) throw new ApiError('cancelled', MESSAGES.cancelled)
	const controller = new AbortController()
	let timedOut = false
	const timer = setTimeout(() => {
		timedOut = true
		controller.abort()
	}, timeoutMs)
	const cancel = () => controller.abort()
	outer?.addEventListener('abort', cancel)

	const headers: Record<string, string> = { Accept: 'application/json' }
	if (bearer) headers.Authorization = `Bearer ${bearer}`
	if (body !== undefined) headers['Content-Type'] = 'application/json'

	try {
		return await fetch(url, { method, headers, body, signal: controller.signal })
	} catch {
		if (timedOut) throw new ApiError('timeout', MESSAGES.timeout)
		if (outer?.aborted) throw new ApiError('cancelled', MESSAGES.cancelled)
		// fetch rejects with the same TypeError for no network and for a server
		// that didn't answer; the device's own connection state tells them apart.
		throw (await deviceIsOffline())
			? new ApiError('offline', MESSAGES.offline)
			: new ApiError('unreachable', MESSAGES.unreachable)
	} finally {
		clearTimeout(timer)
		outer?.removeEventListener('abort', cancel)
	}
}

async function deviceIsOffline(): Promise<boolean> {
	try {
		return isOffline(await NetInfo.fetch())
	} catch {
		return false
	}
}

// Every v1 error is `{ error: { code, message } }`, and its message is written
// for the person. Anything else (a proxy's page, a platform error) gets a plain
// message chosen by status.
async function errorFrom(res: Response): Promise<ApiError> {
	const raw: unknown = await res.json().catch(() => null)
	const parsed = errorBodySchema.safeParse(raw)
	if (parsed.success) {
		const { code, message, issues } = parsed.data.error
		return new ApiError(code, message, { status: res.status, issues })
	}
	if (res.status === 401) {
		return new ApiError('unauthorized', MESSAGES.sessionExpired, { status: res.status })
	}
	if (res.status === 404) return new ApiError('not_found', MESSAGES.notFound, { status: 404 })
	if (res.status === 503) {
		return new ApiError('unavailable', MESSAGES.ourSide, { status: res.status })
	}
	if (res.status >= 500) return new ApiError('internal', MESSAGES.ourSide, { status: res.status })
	return new ApiError('invalid_request', MESSAGES.invalid, { status: res.status })
}
