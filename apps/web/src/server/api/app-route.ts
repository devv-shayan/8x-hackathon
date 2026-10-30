import { NextResponse, type NextRequest } from 'next/server'
import type { z } from 'zod'
import type { Endpoint } from '@app/contract'
import { log } from '@/server/lib/logger'
import { requireUser, type AppUser } from '@/server/auth/require-user'
import { ApiError, errorResponse, NO_STORE } from './app-errors'

// Every /api/app/v1 route is built here, from its @app/contract endpoint, so no
// route can skip a step (docs/rules/mobile-data.md):
//
//   1. auth: `user` endpoints run requireUser() on the bearer token first
//   2. input: path params, query string and JSON body parsed with the contract
//      (a bad path param is a 404; a bad query or body a 400 with its issues)
//   3. the handler, with the verified user and the parsed input
//   4. output: parsed with the contract's response schema BEFORE it is sent.
//      A handler that returns the wrong shape is a bug: 500, logged, and the
//      app opens its error state. A partial or malformed 200 is never sent.
//
// An ApiError becomes `{ error: { code, message } }` with its status; anything
// else thrown is a 500 with a generic message, and the detail goes to the log.

type Output<S> = S extends z.ZodType ? z.output<S> : undefined

export type AppRouteContext<E extends Endpoint> = {
	req: NextRequest
	user: E['auth'] extends 'user' ? AppUser : null
	params: Output<E extends { params: infer P } ? P : undefined>
	query: Output<E extends { query: infer Q } ? Q : undefined>
	body: Output<E extends { body: infer B } ? B : undefined>
}

export type AppRouteResult<E extends Endpoint> = {
	body: z.input<E['response']>
	/** Defaults to the endpoint's status. A create that found its row answers 200. */
	status?: 200 | 201
	/** Replaces the default `private, no-store`, e.g. on the public config route. */
	headers?: Record<string, string>
}

type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> }

export function createAppRoute<E extends Endpoint>(
	endpoint: E,
	handler: (ctx: AppRouteContext<E>) => Promise<AppRouteResult<E>>
) {
	return async function route(req: NextRequest, context: RouteContext): Promise<NextResponse> {
		try {
			const user = endpoint.auth === 'user' ? await requireUser(req) : null
			const params = endpoint.params
				? parseParams(endpoint.params, await context.params)
				: undefined
			const query = endpoint.query
				? parseInput(endpoint.query, Object.fromEntries(req.nextUrl.searchParams))
				: undefined
			const body = endpoint.body ? parseInput(endpoint.body, await readJson(req)) : undefined

			const result = await handler({ req, user, params, query, body } as AppRouteContext<E>)

			const output = endpoint.response.safeParse(result.body)
			if (!output.success) {
				log.error('app route response failed its contract; sent a 500 instead', {
					source: 'api/app/v1',
					route: `${endpoint.method} ${endpoint.path}`,
					issues: output.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
				})
				// Answered here, not thrown: the catch below would log it a second time.
				return errorResponse(
					new ApiError('internal', 'Something went wrong on our side. Try again.')
				)
			}
			return NextResponse.json(output.data, {
				status: result.status ?? endpoint.status,
				headers: result.headers ?? NO_STORE
			})
		} catch (error) {
			if (error instanceof ApiError) {
				if (error.status >= 500) {
					log.error('app route failed', {
						source: 'api/app/v1',
						route: `${endpoint.method} ${endpoint.path}`,
						code: error.code,
						err: error.cause ?? error
					})
				}
				return errorResponse(error)
			}
			log.error('app route threw', {
				source: 'api/app/v1',
				route: `${endpoint.method} ${endpoint.path}`,
				err: error
			})
			return errorResponse(new ApiError('internal', 'Something went wrong on our side. Try again.'))
		}
	}
}

function parseInput(schema: z.ZodType, raw: unknown): unknown {
	const parsed = schema.safeParse(raw)
	if (parsed.success) return parsed.data
	throw new ApiError('invalid_request', 'Some of what was sent is not valid.', {
		issues: parsed.error.issues.map((issue) => ({
			path: issue.path.join('.'),
			message: issue.message
		}))
	})
}

// A path parameter that can't be valid names nothing that exists: 404, like a
// row that isn't the caller's, so the two can't be told apart.
function parseParams(schema: z.ZodType, raw: unknown): unknown {
	const parsed = schema.safeParse(raw)
	if (parsed.success) return parsed.data
	throw notFound()
}

async function readJson(req: NextRequest): Promise<unknown> {
	try {
		return await req.json()
	} catch {
		throw new ApiError('invalid_request', 'Send a JSON body.')
	}
}

export function notFound() {
	return new ApiError('not_found', "That doesn't exist, or it isn't yours.")
}

/** A create whose device-generated id is already taken by a row the caller can't have. */
export function idConflict() {
	return new ApiError('conflict', 'That id is already in use. Try again with a new one.')
}
