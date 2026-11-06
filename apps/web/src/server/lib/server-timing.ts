import { AsyncLocalStorage } from 'node:async_hooks'
import { performance } from 'node:perf_hooks'

// Where a request's time goes, for the Server-Timing response header: the token check, the
// database and the AI calls (each summed, with a count) and the whole request. Recorded per request in
// AsyncLocalStorage, so concurrent requests on one instance never mix.
//
// Durations only: no table, query or user detail is ever put in the header.

type Spans = { auth: number; db: number; dbCalls: number; ai: number; aiCalls: number }

// Pinned to the realm (via a global Symbol), as the logger's context is, so the database
// client and the route wrapper share one store even if this module is loaded twice.
const STORAGE_KEY = Symbol.for('app.server-timing')
const realm = globalThis as unknown as Record<symbol, AsyncLocalStorage<Spans> | undefined>
const storage = (realm[STORAGE_KEY] ??= new AsyncLocalStorage<Spans>())

function round(ms: number) {
	return Math.round(ms * 10) / 10
}

/** Runs one request with fresh spans, and returns its result with the Server-Timing value. */
export async function withServerTiming<T>(
	fn: () => Promise<T>
): Promise<{ result: T; header: string }> {
	const spans: Spans = { auth: 0, db: 0, dbCalls: 0, ai: 0, aiCalls: 0 }
	const start = performance.now()
	const result = await storage.run(spans, fn)
	return { result, header: serverTimingHeader(spans, performance.now() - start) }
}

function calls(n: number) {
	return `${n} ${n === 1 ? 'call' : 'calls'}, summed`
}

/**
 * The header's value:
 * `auth;dur=…, db;dur=…;desc="N calls, summed", ai;dur=…;desc="N calls, summed", total;dur=…`.
 * `db` and `ai` each add up their calls, so calls that overlap can sum to more than `total`.
 * A db call is one Prisma operation, which may run several SQL statements; an ai call is one
 * Gemini request (with its one retry) or one Groq transcription or voice.
 */
export function serverTimingHeader(spans: Spans, totalMs: number): string {
	return [
		`auth;dur=${round(spans.auth)}`,
		`db;dur=${round(spans.db)};desc="${calls(spans.dbCalls)}"`,
		`ai;dur=${round(spans.ai)};desc="${calls(spans.aiCalls)}"`,
		`total;dur=${round(totalMs)}`
	].join(', ')
}

/** Times `fn` as the request's token check. Outside a request it just runs `fn`. */
export async function timeAuth<T>(fn: () => Promise<T>): Promise<T> {
	const spans = storage.getStore()
	if (!spans) return fn()
	const start = performance.now()
	try {
		return await fn()
	} finally {
		spans.auth += performance.now() - start
	}
}

/** Times `fn` as one AI call (Gemini or Groq). Outside a request it just runs `fn`. */
export async function timeAi<T>(fn: () => Promise<T>): Promise<T> {
	const spans = storage.getStore()
	if (!spans) return fn()
	const start = performance.now()
	try {
		return await fn()
	} finally {
		spans.ai += performance.now() - start
		spans.aiCalls += 1
	}
}

/** Adds one database call that took `ms` to the current request, if there is one. */
function recordQuery(ms: number) {
	const spans = storage.getStore()
	if (!spans) return
	spans.db += ms
	spans.dbCalls += 1
}

/**
 * The same thenable, timed from when it is awaited to when it settles. Lazy, as a Prisma query
 * is: nothing runs and no clock starts until `then` is called, so a query handed to a batch
 * `$transaction([...])` still runs inside that transaction (untimed). `catch` and `finally`
 * go through the timed `then`. Everything else is the original object's own.
 */
export function timedThenable<T extends object>(thenable: T): T {
	return new Proxy(thenable, {
		get(target, key) {
			if (key === 'then') {
				return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
					const start = performance.now()
					const done = () => recordQuery(performance.now() - start)
					return (target as unknown as PromiseLike<unknown>)
						.then(
							(value) => {
								done()
								return value
							},
							(error: unknown) => {
								done()
								throw error
							}
						)
						.then(onFulfilled, onRejected)
				}
			}
			if (key === 'catch') {
				return (onRejected?: (e: unknown) => unknown) =>
					(timedThenable(target) as unknown as PromiseLike<unknown>).then(undefined, onRejected)
			}
			if (key === 'finally') {
				return (onFinally?: () => void) =>
					(timedThenable(target) as unknown as Promise<unknown>).then(
						(value) => {
							onFinally?.()
							return value
						},
						(error: unknown) => {
							onFinally?.()
							throw error
						}
					)
			}
			const value: unknown = Reflect.get(target, key, target)
			return typeof value === 'function' ? value.bind(target) : value
		}
	})
}

function isThenable(value: unknown): value is object {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { then?: unknown }).then === 'function'
	)
}

/** Client methods that run a query or a transaction. */
const CLIENT_QUERIES = new Set([
	'$queryRaw',
	'$queryRawUnsafe',
	'$executeRaw',
	'$executeRawUnsafe',
	'$transaction'
])

/**
 * A database client whose every query (each model method, raw query and transaction) adds to
 * the current request's database time. Same type and behaviour as the client it wraps; a
 * transaction counts once, for its whole run.
 */
export function withQueryTiming<C extends object>(client: C): C {
	const delegates = new Map<PropertyKey, unknown>()
	const timeCalls = <T extends object>(target: T) =>
		new Proxy(target, {
			get(inner, key) {
				const value: unknown = Reflect.get(inner, key, inner)
				if (typeof value !== 'function') return value
				return (...args: unknown[]) => {
					const result: unknown = value.apply(inner, args)
					return isThenable(result) ? timedThenable(result) : result
				}
			}
		})

	return new Proxy(client, {
		get(target, key) {
			const value: unknown = Reflect.get(target, key, target)
			if (typeof key === 'string' && CLIENT_QUERIES.has(key) && typeof value === 'function') {
				return (...args: unknown[]) => {
					const result: unknown = value.apply(target, args)
					return isThenable(result) ? timedThenable(result) : result
				}
			}
			// A model delegate (`db.gap`, `db.topic`, …): time each of its methods.
			if (
				typeof key === 'string' &&
				!key.startsWith('$') &&
				!key.startsWith('_') &&
				typeof value === 'object' &&
				value !== null
			) {
				if (!delegates.has(key)) delegates.set(key, timeCalls(value))
				return delegates.get(key)
			}
			return typeof value === 'function' ? value.bind(target) : value
		}
	})
}
