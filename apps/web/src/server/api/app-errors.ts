import { NextResponse } from 'next/server'
import { ERROR_CODES, type ErrorBody, type ErrorCode } from '@app/contract'

/**
 * An expected failure of an /api/app/v1 route: the caller did something the
 * route won't do (no session, a row that isn't theirs, a bad input). The route
 * wrapper turns it into `{ error: { code, message } }` with the code's status.
 *
 * `message` goes to the person, so it is written for them and carries nothing
 * internal. Put detail for the logs in `cause`.
 */
export class ApiError extends Error {
	readonly code: ErrorCode
	readonly status: number
	readonly issues?: ErrorBody['error']['issues']

	constructor(
		code: ErrorCode,
		message: string,
		options: { cause?: unknown; issues?: ErrorBody['error']['issues'] } = {}
	) {
		super(message, { cause: options.cause })
		this.name = 'ApiError'
		this.code = code
		this.status = ERROR_CODES[code]
		this.issues = options.issues
	}
}

/** Responses carrying a person's data, or an error, are never cached. */
export const NO_STORE = { 'Cache-Control': 'private, no-store' } as const

export function errorResponse(error: ApiError): NextResponse<ErrorBody> {
	const body: ErrorBody = {
		error: {
			code: error.code,
			message: error.message,
			...(error.issues ? { issues: error.issues } : {})
		}
	}
	return NextResponse.json(body, { status: error.status, headers: NO_STORE })
}
